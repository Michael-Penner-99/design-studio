import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildPushPayload } from "../src/push";

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
});
