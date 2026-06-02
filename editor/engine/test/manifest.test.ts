import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildManifest } from "../src/manifest";

const SITE = join(__dirname, "fixtures", "site");

describe("buildManifest", () => {
  let out: string;
  beforeEach(() => { out = mkdtempSync(join(tmpdir(), "tagged-")); });

  it("discovers fields across all pages and writes tagged html to outDir", () => {
    const m = buildManifest({ slug: "acme", siteDir: SITE, outDir: out });
    const pages = m.fields.map((f) => f.page);
    expect(pages).toContain("index.html");
    expect(pages).toContain("about.html");
    expect(readdirSync(out).sort()).toEqual(["about.html", "index.html"]);
    rmSync(out, { recursive: true, force: true });
  });

  it("includes color fields from the inline tailwind block", () => {
    const m = buildManifest({ slug: "acme", siteDir: SITE, outDir: out });
    const colorIds = m.fields.filter((f) => f.type === "color").map((f) => f.id).sort();
    expect(colorIds).toEqual(["color__ink", "color__primary"]);
    const primary = m.fields.find((f) => f.id === "color__primary")!;
    expect(primary.value).toBe("#E5524F");
    rmSync(out, { recursive: true, force: true });
  });

  it("defaults the tier to 'Text only' and marks all fields clientEditable accordingly", () => {
    const m = buildManifest({ slug: "acme", siteDir: SITE, outDir: out });
    expect(m.tier).toBe("Text only");
    const colorField = m.fields.find((f) => f.type === "color")!;
    expect(colorField.clientEditable).toBe(false); // color not in 'Text only'
    const textField = m.fields.find((f) => f.type === "text")!;
    expect(textField.clientEditable).toBe(true);
    rmSync(out, { recursive: true, force: true });
  });
});
