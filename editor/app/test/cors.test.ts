import { describe, it, expect } from "vitest";
import { parseAllowedOrigins, corsHeaders } from "../src/cors";

describe("cors", () => {
  it("parses a comma list, trimming blanks", () => {
    expect(parseAllowedOrigins(" https://a.com, https://b.com ,")).toEqual(["https://a.com", "https://b.com"]);
    expect(parseAllowedOrigins(undefined)).toEqual([]);
  });

  it("echoes an allowed origin with method + header grants", () => {
    const h = corsHeaders("https://a.com", ["https://a.com"]);
    expect(h["Access-Control-Allow-Origin"]).toBe("https://a.com");
    expect(h["Access-Control-Allow-Headers"]).toContain("authorization");
    expect(h["Access-Control-Allow-Methods"]).toContain("PUT");
  });

  it("returns no headers for a disallowed origin", () => {
    expect(corsHeaders("https://evil.com", ["https://a.com"])).toEqual({});
  });

  it("supports wildcard", () => {
    expect(corsHeaders("https://anything.com", ["*"])["Access-Control-Allow-Origin"]).toBe("https://anything.com");
  });
});
