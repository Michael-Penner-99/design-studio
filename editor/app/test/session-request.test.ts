import { describe, it, expect } from "vitest";
import { authorizeSlug } from "../src/session-request";

describe("authorizeSlug", () => {
  it("allows operator any slug; client only their own", () => {
    expect(authorizeSlug({ id: "s", username: "op", slug: null, role: "operator" }, "acme")).toBe(true);
    expect(authorizeSlug({ id: "s", username: "acme", slug: "acme", role: "client" }, "acme")).toBe(true);
    expect(authorizeSlug({ id: "s", username: "acme", slug: "acme", role: "client" }, "other")).toBe(false);
  });
});
