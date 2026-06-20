import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildPushPayload, batchAssets } from "../src/push";

describe("buildPushPayload", () => {
  let root: string;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), "push-")); });

  it("tags the site and assembles a payload with project info from the deploy manifest", () => {
    const siteDir = join(root, "clients", "acme", "site");
    mkdirSync(siteDir, { recursive: true });
    writeFileSync(join(siteDir, "index.html"),
      `<html><head><script>tailwind.config={theme:{extend:{colors:{primary:'#111111'}}}};</script></head>` +
      `<body><h1>Acme</h1></body></html>`, "utf8");
    const deployDir = join(root, "clients", "acme", "deploy");
    mkdirSync(deployDir, { recursive: true });
    writeFileSync(join(deployDir, "manifest.json"), JSON.stringify({
      slug: "acme", site: { vercel_project_id: "prj_X", preview_url: "https://acme.actiondesignstudio.com" },
    }), "utf8");

    const p = buildPushPayload({ slug: "acme", root, displayName: "Acme Co", tier: "Text only" });
    expect(p.slug).toBe("acme");
    expect(p.displayName).toBe("Acme Co");
    expect(p.vercelProjectId).toBe("prj_X");
    expect(p.customDomain).toBe("https://acme.actiondesignstudio.com");
    expect(p.manifest.fields.some((f) => f.type === "color")).toBe(true);
    expect(p.pages.find((pg) => pg.path === "index.html")?.html).toContain("data-edit");
    rmSync(root, { recursive: true, force: true });
  });

  it("returns null project info when no deploy manifest exists", () => {
    const siteDir = join(root, "clients", "bare", "site");
    mkdirSync(siteDir, { recursive: true });
    writeFileSync(join(siteDir, "index.html"), `<html><body><h1>Bare</h1></body></html>`, "utf8");
    const p = buildPushPayload({ slug: "bare", root, displayName: "Bare", tier: "Text only" });
    expect(p.vercelProjectId).toBeNull();
    expect(p.customDomain).toBeNull();
    rmSync(root, { recursive: true, force: true });
  });

  it("collects non-HTML files as base64 assets", () => {
    const siteDir = join(root, "clients", "acme2", "site");
    mkdirSync(join(siteDir, "assets"), { recursive: true });
    writeFileSync(join(siteDir, "index.html"),
      `<html><head><script>tailwind.config={theme:{extend:{colors:{primary:'#111'}}}};</script></head><body><h1>Hi</h1></body></html>`, "utf8");
    writeFileSync(join(siteDir, "assets", "logo.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    writeFileSync(join(siteDir, "tailwind.config.js"), "module.exports={};", "utf8");

    const p = buildPushPayload({ slug: "acme2", root, displayName: "Acme2", tier: "Text only" });
    const paths = p.assets.map((a) => a.path).sort();
    expect(paths).toEqual(["assets/logo.png", "tailwind.config.js"]);
    const png = p.assets.find((a) => a.path === "assets/logo.png")!;
    expect(png.base64).toBe(Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString("base64"));
    expect(p.pages.some((pg) => pg.path === "index.html")).toBe(true);
    expect(p.assets.some((a) => a.path === "index.html")).toBe(false);
  });
});

describe("batchAssets", () => {
  it("groups assets so each batch's base64 size stays under the limit", () => {
    const a = (p: string, n: number) => ({ path: p, base64: "x".repeat(n) });
    const batches = batchAssets([a("1", 3), a("2", 3), a("3", 3)], 7);
    expect(batches.map((b) => b.map((x) => x.path))).toEqual([["1", "2"], ["3"]]);
  });
  it("puts a single oversized asset in its own batch", () => {
    const batches = batchAssets([{ path: "big", base64: "x".repeat(100) }], 10);
    expect(batches).toEqual([[{ path: "big", base64: "x".repeat(100) }]]);
  });
  it("returns no batches for no assets", () => {
    expect(batchAssets([], 10)).toEqual([]);
  });
});
