import { describe, it, expect } from "vitest";
import { makeTestDb } from "./helpers/pgmem";
import * as repo from "../src/repo";
import { hashPassword, verifyPassword, login, getSession } from "../src/auth";

describe("auth", () => {
  it("hashes and verifies a password", async () => {
    const h = await hashPassword("s3cret");
    expect(h).not.toBe("s3cret");
    expect(await verifyPassword("s3cret", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
  });

  it("logs in a client and creates a retrievable session", async () => {
    const db = await makeTestDb();
    await repo.upsertClient(db, { slug: "acme", displayName: "Acme", vercelProjectId: null, customDomain: null, tier: "Text only" });
    await repo.setCredential(db, { username: "acme", slug: "acme", role: "client", passwordHash: await hashPassword("pw") });

    const ok = await login(db, "acme", "pw");
    expect(ok).not.toBeNull();
    expect(ok!.role).toBe("client");
    const session = await getSession(db, ok!.sessionId);
    expect(session?.slug).toBe("acme");

    expect(await login(db, "acme", "bad")).toBeNull();
    expect(await login(db, "nobody", "pw")).toBeNull();
  });
});
