import { describe, it, expect } from "vitest";
import { makeTestDb } from "./helpers/pgmem";
import * as repo from "../src/repo";

describe("assets + locks + promote", () => {
  it("saves and reads assets (replace on re-save)", async () => {
    const db = await makeTestDb();
    await repo.saveAssets(db, "acme", [{ path: "assets/logo.png", blobUrl: "https://blob/aaa", size: 100 }]);
    await repo.saveAssets(db, "acme", [{ path: "assets/logo.png", blobUrl: "https://blob/bbb", size: 200 }]);
    expect(await repo.getAssets(db, "acme")).toEqual([{ path: "assets/logo.png", blob_url: "https://blob/bbb", size: 200 }]);
  });

  it("promotes draft overrides to published", async () => {
    const db = await makeTestDb();
    await repo.saveOverrides(db, "acme", "draft", { "x": "1" });
    await repo.promoteOverrides(db, "acme");
    expect(await repo.getOverrides(db, "acme", "published")).toEqual({ "x": "1" });
  });

  it("lock is exclusive until released, and stale locks can be taken over", async () => {
    const db = await makeTestDb();
    expect(await repo.acquireLock(db, "acme", 300)).toBe(true);
    expect(await repo.acquireLock(db, "acme", 300)).toBe(false);
    await repo.releaseLock(db, "acme");
    expect(await repo.acquireLock(db, "acme", 300)).toBe(true);
  });
});
