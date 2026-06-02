import { readdirSync } from "node:fs";
import { join, relative } from "node:path";

/** Recursively list .html files under `dir`, returned as paths relative to `dir`. */
export function htmlFiles(dir: string, base = dir): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...htmlFiles(full, base));
    else if (entry.name.endsWith(".html")) out.push(relative(base, full));
  }
  return out;
}
