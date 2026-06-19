import { describe, it, expect } from "vitest";
import { authorizeSlug, sessionFromRequest } from "../src/session-request";
import { makeTestDb } from "./helpers/pgmem";
import * as repo from "../src/repo";

describe("authorizeSlug", () => {
  it("allows operator any slug; client only their own", () => {
    expect(authorizeSlug({ id: "s", username: "op", slug: null, role: "operator" }, "acme")).toBe(true);
    expect(authorizeSlug({ id: "s", username: "acme", slug: "acme", role: "client" }, "acme")).toBe(true);
    expect(authorizeSlug({ id: "s", username: "acme", slug: "acme", role: "client" }, "other")).toBe(false);
  });
});

function fakeReq(opts: { cookie?: string; bearer?: string }) {
  return {
    cookies: { get: (_: string) => (opts.cookie ? { value: opts.cookie } : undefined) },
    headers: { get: (k: string) => (k.toLowerCase() === "authorization" && opts.bearer ? `Bearer ${opts.bearer}` : null) },
  } as any;
}

describe("sessionFromRequest bearer token", () => {
  it("resolves a session from the Authorization header when no cookie", async () => {
    const db = await makeTestDb();
    await repo.createSession(db, { id: "sess-1", username: "acme", slug: "acme", role: "client", expiresAt: new Date(Date.now() + 60000) });
    const s = await sessionFromRequest(db, fakeReq({ bearer: "sess-1" }));
    expect(s?.role).toBe("client");
    expect(s?.slug).toBe("acme");
  });

  it("returns null for an unknown bearer token", async () => {
    const db = await makeTestDb();
    expect(await sessionFromRequest(db, fakeReq({ bearer: "nope" }))).toBeNull();
  });

  it("prefers a valid cookie session", async () => {
    const db = await makeTestDb();
    await repo.createSession(db, { id: "cookie-1", username: "op", slug: null, role: "operator", expiresAt: new Date(Date.now() + 60000) });
    const s = await sessionFromRequest(db, fakeReq({ cookie: "cookie-1", bearer: "ignored" }));
    expect(s?.role).toBe("operator");
  });
});
