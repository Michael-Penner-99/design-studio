import { describe, it, expect } from "vitest";
import { makeTestDb } from "./helpers/pgmem";
import type { Manifest } from "@action-studio/editor-engine";
import * as repo from "../src/repo";

const manifest: Manifest = { slug: "acme", tier: "Text only", fields: [] };

describe("repo", () => {
  it("upserts a client and reads it back", async () => {
    const db = await makeTestDb();
    await repo.upsertClient(db, { slug: "acme", displayName: "Acme", vercelProjectId: "prj_1", customDomain: "acme.example.com", tier: "Text only" });
    const c = await repo.getClient(db, "acme");
    expect(c?.display_name).toBe("Acme");
    expect(c?.vercel_project_id).toBe("prj_1");
  });

  it("lists clients ordered by display name", async () => {
    const db = await makeTestDb();
    await repo.upsertClient(db, { slug: "zebra", displayName: "Zebra Co", vercelProjectId: null, customDomain: null, tier: "Text only" });
    await repo.upsertClient(db, { slug: "acme", displayName: "Acme", vercelProjectId: null, customDomain: null, tier: "Everything" });
    const list = await repo.listClients(db);
    expect(list.map((c) => c.slug)).toEqual(["acme", "zebra"]);
  });

  it("saves and reads the manifest and tagged pages", async () => {
    const db = await makeTestDb();
    await repo.upsertClient(db, { slug: "acme", displayName: "Acme", vercelProjectId: null, customDomain: null, tier: "Text only" });
    await repo.saveManifest(db, "acme", manifest);
    await repo.saveTaggedPages(db, "acme", [{ path: "index.html", html: "<h1>hi</h1>" }]);
    expect((await repo.getManifest(db, "acme"))?.slug).toBe("acme");
    expect(await repo.getTaggedPages(db, "acme")).toEqual([{ path: "index.html", html: "<h1>hi</h1>" }]);
  });

  it("re-saving tagged pages replaces them (idempotent re-push)", async () => {
    const db = await makeTestDb();
    await repo.upsertClient(db, { slug: "acme", displayName: "Acme", vercelProjectId: null, customDomain: null, tier: "Text only" });
    await repo.saveTaggedPages(db, "acme", [{ path: "index.html", html: "<h1>v1</h1>" }]);
    await repo.saveTaggedPages(db, "acme", [{ path: "index.html", html: "<h1>v2</h1>" }]);
    expect(await repo.getTaggedPages(db, "acme")).toEqual([{ path: "index.html", html: "<h1>v2</h1>" }]);
  });

  it("preserves overrides across re-save (draft + published independent)", async () => {
    const db = await makeTestDb();
    await repo.upsertClient(db, { slug: "acme", displayName: "Acme", vercelProjectId: null, customDomain: null, tier: "Text only" });
    await repo.saveOverrides(db, "acme", "draft", { "index__h1__1": "Hello" });
    expect(await repo.getOverrides(db, "acme", "draft")).toEqual({ "index__h1__1": "Hello" });
    expect(await repo.getOverrides(db, "acme", "published")).toEqual({});
  });

  it("saves, upserts, and reads assets as blob refs", async () => {
    const db = await makeTestDb();
    await repo.saveAssets(db, "acme", [
      { path: "assets/a.webp", blobUrl: "https://blob/a", size: 10 },
      { path: "assets/b.webp", blobUrl: "https://blob/b", size: 20 },
    ]);
    expect(await repo.getAssets(db, "acme")).toEqual([
      { path: "assets/a.webp", blob_url: "https://blob/a", size: 10 },
      { path: "assets/b.webp", blob_url: "https://blob/b", size: 20 },
    ]);
    await repo.upsertAsset(db, "acme", { path: "assets/a.webp", blobUrl: "https://blob/a2", size: 11 });
    const rows = await repo.getAssets(db, "acme");
    expect(rows.find((r) => r.path === "assets/a.webp")).toEqual({ path: "assets/a.webp", blob_url: "https://blob/a2", size: 11 });
  });
});
