import { readFileSync } from "node:fs";
import { join } from "node:path";
import { htmlFiles } from "./fs-walk";
import { readColors } from "./colors";
import { tagPage } from "./tagger";

export interface EditorReadiness {
  pages: string[];
  pagesMissingColorBlock: string[];
  colorCount: number;
  linkFieldCount: number;
  ok: boolean;
}

/**
 * Scan a built site directory and report editor-readiness:
 * which pages lack the inline Tailwind color block, plus link/color field counts.
 * `ok` is false when any page is missing the color block.
 */
export function checkEditorReadiness(siteDir: string): EditorReadiness {
  const pages = htmlFiles(siteDir).sort();
  const pagesMissingColorBlock: string[] = [];
  let colorCount = 0;
  let linkFieldCount = 0;

  for (const rel of pages) {
    const html = readFileSync(join(siteDir, rel), "utf8");
    const colors = readColors(html);
    if (Object.keys(colors).length === 0) {
      pagesMissingColorBlock.push(rel);
    } else if (colorCount === 0) {
      colorCount = Object.keys(colors).length;
    }
    const { fields } = tagPage(rel, html);
    linkFieldCount += fields.filter((f) => f.type === "link").length;
  }

  return {
    pages,
    pagesMissingColorBlock,
    colorCount,
    linkFieldCount,
    ok: pagesMissingColorBlock.length === 0,
  };
}
