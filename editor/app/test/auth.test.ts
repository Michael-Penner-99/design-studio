import { describe, it, expect, vi, afterEach } from "vitest";
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

describe("env-based operator login", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("logs in the env operator and creates an operator session", async () => {
    const db = await makeTestDb();
    const hash = await hashPassword("oppass");
    vi.stubEnv("OPERATOR_USERNAME", "michael");
    vi.stubEnv("OPERATOR_PASSWORD_HASH", hash);
    const r = await login(db, "michael", "oppass");
    expect(r).not.toBeNull();
    expect(r!.role).toBe("operator");
    expect(r!.slug).toBeNull();
    const session = await getSession(db, r!.sessionId);
    expect(session?.role).toBe("operator");
  });

  it("rejects a wrong operator password", async () => {
    const db = await makeTestDb();
    vi.stubEnv("OPERATOR_USERNAME", "michael");
    vi.stubEnv("OPERATOR_PASSWORD_HASH", await hashPassword("oppass"));
    expect(await login(db, "michael", "wrong")).toBeNull();
  });

  it("still logs in a DB client when env operator is set", async () => {
    const db = await makeTestDb();
    vi.stubEnv("OPERATOR_USERNAME", "michael");
    vi.stubEnv("OPERATOR_PASSWORD_HASH", await hashPassword("oppass"));
    const { setCredential, upsertClient } = await import("../src/repo");
    await upsertClient(db, { slug: "acme", displayName: "Acme", vercelProjectId: null, customDomain: null, tier: "Text only" });
    await setCredential(db, { username: "acme", slug: "acme", role: "client", passwordHash: await hashPassword("pw") });
    const r = await login(db, "acme", "pw");
    expect(r!.role).toBe("client");
    expect(r!.slug).toBe("acme");
  });
});
