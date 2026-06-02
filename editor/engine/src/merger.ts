import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import * as cheerio from "cheerio";
import type { Overrides, LinkValue } from "./types";
import { rewriteColors } from "./colors";
import { htmlFiles } from "./fs-walk";

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

export interface InMemoryPage { path: string; html: string; }
export interface MergePagesResult { pages: InMemoryPage[]; applied: string[]; orphans: string[]; }

function isLink(v: unknown): v is LinkValue {
  return typeof v === "object" && v !== null && "href" in v;
}

/** Pure in-memory merge: apply overrides to a set of pages. Mirrors mergeSite's per-page logic. */
export function mergePages(pages: InMemoryPage[], overrides: Overrides): MergePagesResult {
  const applied = new Set<string>();
  const colorUpdates: Record<string, string> = {};
  for (const [id, value] of Object.entries(overrides)) {
    if (id.startsWith("color__") && typeof value === "string") {
      colorUpdates[id.replace(/^color__/, "")] = value;
    }
  }
  const outPages = pages.map(({ path, html }) => {
    if (Object.keys(colorUpdates).length) {
      const before = html;
      html = rewriteColors(html, colorUpdates);
      if (html !== before) for (const k of Object.keys(colorUpdates)) applied.add(`color__${k}`);
    }
    const $ = cheerio.load(html);
    for (const [id, value] of Object.entries(overrides)) {
      if (id.startsWith("color__")) continue;
      if (!SAFE_EDIT_ID.test(id)) continue;
      const el = $(`[data-edit="${id}"]`);
      if (!el.length) continue;
      if (el.is("img")) el.attr("src", String(value));
      else if (el.is("a") && isLink(value)) el.attr("href", value.href).text(value.label);
      else if (el.is("[data-rich]")) el.html(String(value));
      else el.text(String(value));
      applied.add(id);
    }
    return { path, html: $.html() };
  });
  const orphans = Object.keys(overrides).filter((id) => !applied.has(id));
  return { pages: outPages, applied: [...applied], orphans };
}

export function mergeSite(opts: MergeOptions): MergeResult {
  const rels = htmlFiles(opts.siteDir).sort();
  const pagesInput: InMemoryPage[] = rels.map((rel) => ({
    path: rel,
    html: readFileSync(join(opts.siteDir, rel), "utf8"),
  }));

  const result = mergePages(pagesInput, opts.overrides);

  for (const page of result.pages) {
    const dest = join(opts.outDir, page.path);
    mkdirSync(join(dest, ".."), { recursive: true });
    writeFileSync(dest, page.html, "utf8");
  }

  return { pages: rels, applied: result.applied, orphans: result.orphans };
}
