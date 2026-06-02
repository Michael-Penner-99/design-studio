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
});
