#!/usr/bin/env node
import { Command } from "commander";
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { buildManifest } from "./manifest";
import { mergeSite } from "./merger";
import { TIERS, type Tier } from "./types";
import { checkEditorReadiness } from "./readiness";
import { buildPushPayload, batchAssets } from "./push";

const program = new Command();
program.name("editor-engine").description("Action Studio client-site editor engine");

// "custom" is a computed label, not a selectable input tier.
const INPUT_TIERS = TIERS.filter((t) => t !== "custom");

function validateTier(tier: string): Tier {
  if (!(INPUT_TIERS as readonly string[]).includes(tier)) {
    program.error(`invalid --tier "${tier}". Valid tiers: ${INPUT_TIERS.join(", ")}`);
  }
  return tier as Tier;
}

program
  .command("tag")
  .argument("<siteDir>", "directory of built HTML")
  .argument("<outDir>", "directory to write tagged HTML + editable.json")
  .requiredOption("--slug <slug>", "client slug")
  .option("--tier <tier>", "initial permission tier", "Text only")
  .action((siteDir, outDir, opts) => {
    mkdirSync(outDir, { recursive: true });
    const manifest = buildManifest({ slug: opts.slug, siteDir, outDir, tier: validateTier(opts.tier) });
    writeFileSync(join(outDir, "editable.json"), JSON.stringify(manifest, null, 2), "utf8");
    console.log(`Tagged ${manifest.fields.length} fields → ${outDir}/editable.json`);
  });

program
  .command("merge")
  .argument("<siteDir>", "tagged site dir")
  .argument("<outDir>", "output dir")
  .requiredOption("--overrides <file>", "overrides JSON file")
  .action((siteDir, outDir, opts) => {
    const overrides = JSON.parse(readFileSync(opts.overrides, "utf8"));
    const result = mergeSite({ siteDir, outDir, overrides });
    console.log(`Applied ${result.applied.length} overrides across ${result.pages.length} pages.`);
    if (result.orphans.length) console.warn(`Orphan ids (no match): ${result.orphans.join(", ")}`);
  });

program
  .command("retrofit")
  .argument("<slug>", "client slug under clients/")
  .option("--root <root>", "repo root", process.cwd())
  .option("--tier <tier>", "initial permission tier", "Text only")
  .action((slug, opts) => {
    const siteDir = join(opts.root, "clients", slug, "site");
    const outDir = join(opts.root, "clients", slug, "editor", "tagged");
    mkdirSync(outDir, { recursive: true });
    const manifest = buildManifest({ slug, siteDir, outDir, tier: validateTier(opts.tier) });
    writeFileSync(join(opts.root, "clients", slug, "editor", "editable.json"),
      JSON.stringify(manifest, null, 2), "utf8");
    console.log(`Retrofitted ${slug}: ${manifest.fields.length} fields.`);
  });

program
  .command("check")
  .argument("<siteDir>", "built site dir to check for editor-readiness")
  .action((siteDir) => {
    const r = checkEditorReadiness(siteDir);
    console.log(
      `Editor-readiness: ${r.pages.length} pages, ${r.colorCount} colors, ${r.linkFieldCount} link fields.`
    );
    if (!r.ok) {
      console.error(
        `NOT ready — ${r.pagesMissingColorBlock.length} page(s) missing the color block: ${r.pagesMissingColorBlock.join(", ")}`
      );
      process.exitCode = 1;
      return;
    }
    console.log("ok");
  });

program
  .command("push")
  .argument("<slug>", "client slug under clients/")
  .requiredOption("--endpoint <url>", "editor app base URL, e.g. https://editor.actiondesignstudio.com")
  .option("--token <token>", "operator token (falls back to OPERATOR_TOKEN env)")
  .option("--root <root>", "repo root", process.cwd())
  .option("--name <displayName>", "client display name")
  .option("--tier <tier>", "initial permission tier", "Text only")
  .action(async (slug, opts) => {
    const token = opts.token ?? process.env.OPERATOR_TOKEN;
    if (!token) {
      console.error("Operator token required: pass --token or set OPERATOR_TOKEN.");
      process.exitCode = 1;
      return;
    }
    const payload = buildPushPayload({
      slug, root: opts.root, displayName: opts.name ?? slug, tier: validateTier(opts.tier),
    });
    const base = opts.endpoint.replace(/\/$/, "");
    const headers = { "content-type": "application/json", authorization: `Bearer ${token}` };

    const ingestRes = await fetch(`${base}/api/ingest`, {
      method: "POST", headers,
      body: JSON.stringify({
        slug: payload.slug, displayName: payload.displayName,
        vercelProjectId: payload.vercelProjectId, customDomain: payload.customDomain,
        tier: payload.tier, manifest: payload.manifest, pages: payload.pages,
      }),
    });
    if (!ingestRes.ok) { console.error(`Push failed: ${ingestRes.status} ${await ingestRes.text()}`); process.exitCode = 1; return; }

    const MAX_ASSET_BATCH_BYTES = 3_500_000;
    const batches = batchAssets(payload.assets, MAX_ASSET_BATCH_BYTES);
    for (let i = 0; i < batches.length; i++) {
      const res = await fetch(`${base}/api/ingest/assets`, {
        method: "POST", headers, body: JSON.stringify({ slug: payload.slug, assets: batches[i] }),
      });
      if (!res.ok) { console.error(`Asset batch ${i + 1}/${batches.length} failed: ${res.status} ${await res.text()}`); process.exitCode = 1; return; }
    }
    console.log(`Pushed ${payload.slug}: ${payload.pages.length} pages, ${payload.manifest.fields.length} fields, ${payload.assets.length} assets in ${batches.length} batch(es).`);
  });

program.parse();
