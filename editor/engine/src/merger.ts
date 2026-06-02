import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, relative } from "node:path";
import * as cheerio from "cheerio";
import type { Overrides, LinkValue } from "./types";
import { rewriteColors } from "./colors";

// Edit ids the engine generates are limited to this charset; anything else
// (e.g. an id containing a quote) is skipped so it cannot break the selector.
const SAFE_EDIT_ID = /^[A-Za-z0-9_-]+$/;

export interface MergeOptions {
  siteDir: string;
  outDir: string;
  overrides: Overrides;
}

export interface MergeResult {
  pages: string[];
  applied: string[];
  orphans: string[];
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

function isLink(v: unknown): v is LinkValue {
  return typeof v === "object" && v !== null && "href" in v;
}

export function mergeSite(opts: MergeOptions): MergeResult {
  const applied = new Set<string>();
  const colorUpdates: Record<string, string> = {};
  for (const [id, value] of Object.entries(opts.overrides)) {
    if (id.startsWith("color__") && typeof value === "string") {
      colorUpdates[id.replace(/^color__/, "")] = value;
    }
  }

  const pages = htmlFiles(opts.siteDir).sort();
  for (const rel of pages) {
    let html = readFileSync(join(opts.siteDir, rel), "utf8");
    if (Object.keys(colorUpdates).length) {
      const before = html;
      html = rewriteColors(html, colorUpdates);
      if (html !== before) for (const k of Object.keys(colorUpdates)) applied.add(`color__${k}`);
    }

    const $ = cheerio.load(html);
    for (const [id, value] of Object.entries(opts.overrides)) {
      if (id.startsWith("color__")) continue;
      if (!SAFE_EDIT_ID.test(id)) continue;
      const el = $(`[data-edit="${id}"]`);
      if (!el.length) continue;
      if (el.is("img")) {
        el.attr("src", String(value));
      } else if (el.is("a") && isLink(value)) {
        el.attr("href", value.href).text(value.label);
      } else if (el.is("[data-rich]")) {
        el.html(String(value));
      } else {
        el.text(String(value));
      }
      applied.add(id);
    }

    const dest = join(opts.outDir, rel);
    mkdirSync(join(dest, ".."), { recursive: true });
    writeFileSync(dest, $.html(), "utf8");
  }

  const orphans = Object.keys(opts.overrides).filter((id) => !applied.has(id));
  return { pages, applied: [...applied], orphans };
}
