#!/usr/bin/env node
import { Command } from "commander";
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { buildManifest } from "./manifest";
import { mergeSite } from "./merger";
import { TIERS, type Tier } from "./types";

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

program.parse();
