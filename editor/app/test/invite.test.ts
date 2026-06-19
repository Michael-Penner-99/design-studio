import { describe, it, expect } from "vitest";
import { buildInvite } from "../src/invite";

describe("buildInvite", () => {
  it("includes link, username, and password in the text", () => {
    const { text } = buildInvite({ link: "https://acme.actiondesignstudio.com/?edit", username: "acme", password: "s3cret88" });
    expect(text).toContain("https://acme.actiondesignstudio.com/?edit");
    expect(text).toContain("acme");
    expect(text).toContain("s3cret88");
  });

  it("produces a mailto: with encoded subject and body", () => {
    const { mailto } = buildInvite({ link: "https://x/?edit", username: "u", password: "p" });
    expect(mailto.startsWith("mailto:?subject=")).toBe(true);
    expect(mailto).toContain("body=");
    expect(mailto).toContain(encodeURIComponent("https://x/?edit"));
  });
});
