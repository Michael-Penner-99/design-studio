import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mergeSite } from "../src/merger";

const TAGGED = `<!DOCTYPE html><html><head><script>
tailwind.config = { theme: { extend: { colors: { primary: '#E5524F' } } } };
</script></head><body>
<h1 data-edit="index__h1__1">Old</h1>
<a data-edit="index__a__1" href="tel:1">Call</a>
<img data-edit="index__img__1" src="old.jpg">
</body></html>`;

describe("mergeSite", () => {
  let src: string, out: string;
  beforeEach(() => {
    src = mkdtempSync(join(tmpdir(), "src-"));
    out = mkdtempSync(join(tmpdir(), "out-"));
    writeFileSync(join(src, "index.html"), TAGGED, "utf8");
  });

  it("applies text, link, image, and color overrides", () => {
    mergeSite({
      siteDir: src, outDir: out,
      overrides: {
        "index__h1__1": "New Headline",
        "index__a__1": { label: "Call Today", href: "tel:999" },
        "index__img__1": "https://blob/new.jpg",
        "color__primary": "#000000",
      },
    });
    const html = readFileSync(join(out, "index.html"), "utf8");
    expect(html).toContain(">New Headline<");
    expect(html).toContain("tel:999");
    expect(html).toContain("Call Today");
    expect(html).toContain('src="https://blob/new.jpg"');
    expect(html).toContain("primary: '#000000'");
    rmSync(src, { recursive: true, force: true });
    rmSync(out, { recursive: true, force: true });
  });

  it("leaves fields without an override untouched", () => {
    mergeSite({ siteDir: src, outDir: out, overrides: {} });
    const html = readFileSync(join(out, "index.html"), "utf8");
    expect(html).toContain(">Old<");
    expect(html).toContain("old.jpg");
    rmSync(src, { recursive: true, force: true });
    rmSync(out, { recursive: true, force: true });
  });

  it("logs (does not throw) when an override id is missing in the html", () => {
    const result = mergeSite({ siteDir: src, outDir: out, overrides: { "ghost__id__9": "x" } });
    expect(result.orphans).toContain("ghost__id__9");
    rmSync(src, { recursive: true, force: true });
    rmSync(out, { recursive: true, force: true });
  });
});
