import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkEditorReadiness } from "../src/readiness";

const withColors = (cta = false) =>
  `<!DOCTYPE html><html><head><script>` +
  `tailwind.config={theme:{extend:{colors:{primary:'#E5524F'}}}};` +
  `</script></head><body>` +
  (cta ? `<a data-cta href="tel:1">Call</a>` : `<h1>Hi</h1>`) +
  `</body></html>`;
const noColors = `<!DOCTYPE html><html><head></head><body><p>Hi</p></body></html>`;

describe("checkEditorReadiness", () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "ready-")); });

  it("flags pages that lack the inline color block", () => {
    writeFileSync(join(dir, "index.html"), withColors(), "utf8");
    writeFileSync(join(dir, "reviews.html"), noColors, "utf8");
    const r = checkEditorReadiness(dir);
    expect(r.pages.sort()).toEqual(["index.html", "reviews.html"]);
    expect(r.pagesMissingColorBlock).toEqual(["reviews.html"]);
    expect(r.ok).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });

  it("reports ok with link + color counts when every page has the block", () => {
    writeFileSync(join(dir, "index.html"), withColors(true), "utf8");
    mkdirSync(join(dir, "services"), { recursive: true });
    writeFileSync(join(dir, "services", "a.html"), withColors(false), "utf8");
    const r = checkEditorReadiness(dir);
    expect(r.pagesMissingColorBlock).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.colorCount).toBe(1);
    expect(r.linkFieldCount).toBe(1);
    rmSync(dir, { recursive: true, force: true });
  });
});
