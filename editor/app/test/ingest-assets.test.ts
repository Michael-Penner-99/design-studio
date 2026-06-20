import { describe, it, expect, vi } from "vitest";
import { makeTestDb } from "./helpers/pgmem";
import * as repo from "../src/repo";
import { assetBlobKey, ingestAssets } from "../src/ingest-assets";

describe("assetBlobKey", () => {
  it("namespaces by slug under assets/ and sanitizes", () => {
    expect(assetBlobKey("acme", "assets/logo.webp")).toBe("clients/acme/assets/assets/logo.webp");
    expect(assetBlobKey("acme", "weird path!.png")).toBe("clients/acme/assets/weird_path_.png");
  });
});

describe("ingestAssets", () => {
  it("puts each asset to blob and upserts a ref with size", async () => {
    const db = await makeTestDb();
    await repo.upsertClient(db, { slug: "acme", displayName: "Acme", vercelProjectId: null, customDomain: null, tier: "Everything" });
    const put = vi.fn(async (key: string) => ({ url: `https://blob/${key}` }));
    const n = await ingestAssets(db, put, "acme", [
      { path: "assets/a.webp", base64: Buffer.from("aaaa").toString("base64") },
      { path: "assets/b.webp", base64: Buffer.from("bb").toString("base64") },
    ]);
    expect(n).toBe(2);
    expect(put).toHaveBeenCalledTimes(2);
    const rows = await repo.getAssets(db, "acme");
    expect(rows).toEqual([
      { path: "assets/a.webp", blob_url: "https://blob/clients/acme/assets/assets/a.webp", size: 4 },
      { path: "assets/b.webp", blob_url: "https://blob/clients/acme/assets/assets/b.webp", size: 2 },
    ]);
  });
});
