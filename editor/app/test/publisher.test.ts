import { describe, it, expect, vi, afterEach } from "vitest";
import { makeTestDb } from "./helpers/pgmem";
import * as repo from "../src/repo";

vi.mock("../src/vercel", () => ({
  deployFiles: vi.fn(async (_input: any) => ({ id: "dpl_1", url: "https://preview-xyz.vercel.app" })),
  getDeploymentState: vi.fn(async () => "READY"),
}));
import { publish } from "../src/publisher";
import { deployFiles, getDeploymentState } from "../src/vercel";

afterEach(() => { vi.unstubAllGlobals(); });

async function seed(db: any) {
  await repo.upsertClient(db, { slug: "acme", displayName: "Acme", vercelProjectId: "prj_1", customDomain: "https://acme.example.com", tier: "Text only" });
  await repo.saveTaggedPages(db, "acme", [{ path: "index.html", html: '<html><body><h1 data-edit="index__h1__1">Old</h1></body></html>' }]);
  await repo.saveAssets(db, "acme", [{ path: "assets/logo.png", blobUrl: "https://blob/acme/logo.png", size: 3 }]);
}

describe("publish", () => {
  it("preview merges DRAFT overrides and deploys without production target", async () => {
    const db = await makeTestDb();
    await seed(db);
    await repo.saveOverrides(db, "acme", "draft", { "index__h1__1": "Draft Title" });
    vi.stubGlobal("fetch", vi.fn(async (_url: string) => ({
      ok: true, arrayBuffer: async () => new Uint8Array([65, 65, 65]).buffer,
    } as any)));
    const r = await publish(db, "acme", "preview");
    expect(r.url).toBe("https://preview-xyz.vercel.app");
    const call = (deployFiles as any).mock.calls.at(-1)[0];
    expect(call.target).toBeUndefined();
    const idx = call.files.find((f: any) => f.path === "index.html");
    expect(idx.bytes.toString("utf8")).toContain(">Draft Title<");
    const logo = call.files.find((f: any) => f.path === "assets/logo.png");
    expect(logo.bytes.toString("utf8")).toBe("AAA");
  });

  it("publish promotes draft→published, deploys with production target", async () => {
    const db = await makeTestDb();
    await seed(db);
    await repo.saveOverrides(db, "acme", "draft", { "index__h1__1": "Live Title" });
    vi.stubGlobal("fetch", vi.fn(async (_url: string) => ({
      ok: true, arrayBuffer: async () => new Uint8Array([65, 65, 65]).buffer,
    } as any)));
    const r = await publish(db, "acme", "publish");
    expect(r.url).toBeTruthy();
    const call = (deployFiles as any).mock.calls.at(-1)[0];
    expect(call.target).toBe("production");
    expect(call.projectId).toBe("prj_1");
    expect(await repo.getOverrides(db, "acme", "published")).toEqual({ "index__h1__1": "Live Title" });
  });

  it("throws when the deployment ends in ERROR state", async () => {
    const db = await makeTestDb();
    await seed(db);
    vi.stubGlobal("fetch", vi.fn(async (_url: string) => ({
      ok: true, arrayBuffer: async () => new Uint8Array([65, 65, 65]).buffer,
    } as any)));
    (getDeploymentState as any).mockResolvedValueOnce("ERROR");
    await expect(publish(db, "acme", "publish")).rejects.toThrow(/failed: ERROR/);
  });

  it("throws if the client has no vercel project id", async () => {
    const db = await makeTestDb();
    await repo.upsertClient(db, { slug: "bare", displayName: "Bare", vercelProjectId: null, customDomain: null, tier: "Text only" });
    await expect(publish(db, "bare", "publish")).rejects.toThrow(/project/i);
  });

  it("injects the editor embed loader into deployed pages when EDITOR_PUBLIC_URL is set", async () => {
    vi.stubEnv("EDITOR_PUBLIC_URL", "https://editor.example.com");
    vi.stubGlobal("fetch", vi.fn(async (_url: string) => ({
      ok: true, arrayBuffer: async () => new Uint8Array([65, 65, 65]).buffer,
    } as any)));
    const db = await makeTestDb();
    await seed(db);
    await publish(db, "acme", "publish");
    const call = (deployFiles as any).mock.calls.at(-1)[0];
    const idx = call.files.find((f: any) => f.path === "index.html").bytes.toString("utf8");
    expect(idx).toContain("data-editor-embed");
    expect(idx).toContain("https://editor.example.com");
    expect(idx).toContain("/embed.js");
    vi.unstubAllEnvs();
  });

  it("does not inject when EDITOR_PUBLIC_URL is unset", async () => {
    vi.stubEnv("EDITOR_PUBLIC_URL", "");
    vi.stubGlobal("fetch", vi.fn(async (_url: string) => ({
      ok: true, arrayBuffer: async () => new Uint8Array([65, 65, 65]).buffer,
    } as any)));
    const db = await makeTestDb();
    await seed(db);
    await publish(db, "acme", "publish");
    const call = (deployFiles as any).mock.calls.at(-1)[0];
    expect(call.files.find((f: any) => f.path === "index.html").bytes.toString("utf8")).not.toContain("data-editor-embed");
    vi.unstubAllEnvs();
  });
});
