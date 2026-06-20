import { describe, it, expect } from "vitest";
import { makeTestDb } from "./helpers/pgmem";
import { ingest, IngestPayloadSchema } from "../src/ingest";
import * as repo from "../src/repo";

const payload = {
  slug: "acme",
  displayName: "Acme",
  vercelProjectId: "prj_1",
  customDomain: "acme.example.com",
  tier: "Text only",
  manifest: { slug: "acme", tier: "Text only" as const, fields: [
    { id: "index__h1__1", page: "index.html", section: "Hero", label: "Hi", type: "text" as const, value: "Hi", clientEditable: true },
  ] },
  pages: [{ path: "index.html", html: '<h1 data-edit="index__h1__1">Hi</h1>' }],
};

describe("ingest", () => {
  it("validates a good payload", () => {
    expect(IngestPayloadSchema.parse(payload).slug).toBe("acme");
  });

  it("persists client, manifest, and tagged pages; preserves existing overrides", async () => {
    const db = await makeTestDb();
    await repo.upsertClient(db, { slug: "acme", displayName: "Old", vercelProjectId: null, customDomain: null, tier: "Text only" });
    await repo.saveOverrides(db, "acme", "published", { "index__h1__1": "Live" });

    await ingest(db, payload);

    expect((await repo.getClient(db, "acme"))?.display_name).toBe("Acme");
    expect((await repo.getManifest(db, "acme"))?.fields).toHaveLength(1);
    expect(await repo.getTaggedPages(db, "acme")).toHaveLength(1);
    expect(await repo.getOverrides(db, "acme", "published")).toEqual({ "index__h1__1": "Live" });
  });

  it("rejects a payload with a bad manifest", () => {
    expect(() => IngestPayloadSchema.parse({ ...payload, manifest: { nope: true } })).toThrow();
  });

});
