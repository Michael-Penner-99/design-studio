import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, relative } from "node:path";
import type { Field, Manifest, Tier } from "./types";
import { tagPage } from "./tagger";
import { readColors } from "./colors";
import { colorId } from "./ids";
import { applyTier } from "./permissions";

export interface BuildManifestOptions {
  slug: string;
  siteDir: string;
  outDir: string;
  tier?: Tier;
}

function htmlFiles(dir: string, base = dir): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...htmlFiles(full, base));
    else if (entry.name.endsWith(".html")) out.push(relative(base, full));
  }
  return out;
}

export function buildManifest(opts: BuildManifestOptions): Manifest {
  const tier: Tier = opts.tier ?? "Text only";
  const effectiveTier = tier === "custom" ? "Text only" : tier;
  const fields: Field[] = [];
  let colorsCaptured = false;

  for (const rel of htmlFiles(opts.siteDir).sort()) {
    const src = readFileSync(join(opts.siteDir, rel), "utf8");
    const { html, fields: pageFields } = tagPage(rel, src);

    const destPath = join(opts.outDir, rel);
    mkdirSync(join(destPath, ".."), { recursive: true });
    writeFileSync(destPath, html, "utf8");

    for (const f of pageFields) fields.push({ ...f, clientEditable: false });

    if (!colorsCaptured) {
      const colors = readColors(src);
      const names = Object.keys(colors);
      if (names.length) {
        colorsCaptured = true;
        for (const name of names) {
          fields.push({
            id: colorId(name), page: rel, section: "Brand Colors",
            label: name, type: "color", value: colors[name], clientEditable: false,
          });
        }
      }
    }
  }

  return applyTier({ slug: opts.slug, tier: effectiveTier, fields }, effectiveTier);
}
