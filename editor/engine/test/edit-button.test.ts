import { describe, it, expect } from "vitest";
import * as cheerio from "cheerio";
import { injectOperatorEditButton } from "../src/edit-button";

const page = `<!DOCTYPE html><html><head></head><body><h1>Hi</h1></body></html>`;

describe("injectOperatorEditButton", () => {
  it("appends a hidden anchor linking to /admin/{slug} plus a reveal script", () => {
    const out = injectOperatorEditButton(page, { editorUrl: "https://editor.example.com", slug: "acme" });
    const $ = cheerio.load(out);
    const a = $("[data-op-edit]");
    expect(a.length).toBe(1);
    expect(a.attr("href")).toBe("https://editor.example.com/admin/acme");
    expect(a.attr("hidden")).not.toBeUndefined();
    expect(out).toContain("location.hash==='#edit'");
  });

  it("trims a trailing slash on editorUrl", () => {
    const out = injectOperatorEditButton(page, { editorUrl: "https://editor.example.com/", slug: "acme" });
    expect(cheerio.load(out)("[data-op-edit]").attr("href")).toBe("https://editor.example.com/admin/acme");
  });

  it("is idempotent — re-injecting does not add a second button", () => {
    const once = injectOperatorEditButton(page, { editorUrl: "https://e.com", slug: "acme" });
    const twice = injectOperatorEditButton(once, { editorUrl: "https://e.com", slug: "acme" });
    expect(cheerio.load(twice)("[data-op-edit]").length).toBe(1);
  });
});
