import { describe, it, expect } from "vitest";
import { SESSION_COOKIE, sessionCookieOptions } from "../src/session-cookie";

describe("session cookie", () => {
  it("uses a stable name and secure httpOnly options", () => {
    expect(SESSION_COOKIE).toBe("editor_session");
    const o = sessionCookieOptions(1000);
    expect(o.httpOnly).toBe(true);
    expect(o.sameSite).toBe("lax");
    expect(o.path).toBe("/");
    expect(o.maxAge).toBe(1000);
  });

  it("only marks the cookie secure in production", () => {
    const prev = process.env.NODE_ENV;
    try {
      (process.env as any).NODE_ENV = "production";
      expect(sessionCookieOptions(1).secure).toBe(true);
      (process.env as any).NODE_ENV = "development";
      expect(sessionCookieOptions(1).secure).toBe(false);
    } finally {
      (process.env as any).NODE_ENV = prev;
    }
  });
});
