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

  it("sets inner HTML for a data-rich element", () => {
    const html = `<html><body><div data-edit="index__div__1" data-rich>old</div></body></html>`;
    writeFileSync(join(src, "index.html"), html, "utf8");
    mergeSite({ siteDir: src, outDir: out, overrides: { "index__div__1": "<strong>bold</strong>" } });
    const result = readFileSync(join(out, "index.html"), "utf8");
    expect(result).toContain("<strong>bold</strong>");   // raw HTML, not &lt;strong&gt;
    expect(result).not.toContain("&lt;strong&gt;");
    rmSync(src, { recursive: true, force: true });
    rmSync(out, { recursive: true, force: true });
  });

  it("treats a malformed override id as an orphan instead of throwing", () => {
    const result = mergeSite({
      siteDir: src, outDir: out,
      overrides: { 'bad"id': "x" },
    });
    expect(result.orphans).toContain('bad"id');
    rmSync(src, { recursive: true, force: true });
    rmSync(out, { recursive: true, force: true });
  });

  it("rewrites color on every page including nested subdirs, and applies nested text overrides", () => {
    const page = (id: string) =>
      `<html><head><script>tailwind.config={theme:{extend:{colors:{primary:'#E5524F'}}}};</script></head>` +
      `<body><h1 data-edit="${id}__h1__1">Old</h1></body></html>`;
    writeFileSync(join(src, "index.html"), page("index"), "utf8");
    mkdirSync(join(src, "services"), { recursive: true });
    writeFileSync(join(src, "services", "plumbing.html"), page("services-plumbing"), "utf8");

    const result = mergeSite({
      siteDir: src, outDir: out,
      overrides: { "color__primary": "#0000FF", "services-plumbing__h1__1": "Nested!" },
    });

    expect(result.pages.length).toBe(2);
    expect(readFileSync(join(out, "index.html"), "utf8")).toContain("primary: '#0000FF'");
    const nested = readFileSync(join(out, "services", "plumbing.html"), "utf8");
    expect(nested).toContain("primary: '#0000FF'");
    expect(nested).toContain(">Nested!<");
    expect(result.applied).toContain("color__primary");
    expect(result.applied).toContain("services-plumbing__h1__1");
    rmSync(src, { recursive: true, force: true });
    rmSync(out, { recursive: true, force: true });
  });

  it("marks a color override as orphan when that color appears on no page", () => {
    // src already has the default index.html from beforeEach (no inline color block).
    const result = mergeSite({ siteDir: src, outDir: out, overrides: { "color__ghost": "#111111" } });
    expect(result.orphans).toContain("color__ghost");
    rmSync(src, { recursive: true, force: true });
    rmSync(out, { recursive: true, force: true });
  });
});
