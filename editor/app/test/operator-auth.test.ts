import { describe, it, expect } from "vitest";
import { operatorAuthorized } from "../src/session-request";

const op = { id: "s", username: "op", slug: null, role: "operator" } as const;
const client = { id: "s", username: "acme", slug: "acme", role: "client" } as const;

describe("operatorAuthorized", () => {
  it("allows a valid operator session", () => {
    expect(operatorAuthorized(op, null, undefined)).toBe(true);
  });
  it("allows a correct bearer token when configured", () => {
    expect(operatorAuthorized(null, "tok", "tok")).toBe(true);
  });
  it("denies a client session, wrong token, or missing config", () => {
    expect(operatorAuthorized(client, null, "tok")).toBe(false);
    expect(operatorAuthorized(null, "nope", "tok")).toBe(false);
    expect(operatorAuthorized(null, "tok", undefined)).toBe(false);
    expect(operatorAuthorized(null, null, undefined)).toBe(false);
  });
});
