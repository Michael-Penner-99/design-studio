import { describe, it, expect } from "vitest";
import * as cheerio from "cheerio";
import { injectEditorEmbed } from "../src/embed-loader";

const page = `<!DOCTYPE html><html><head></head><body><h1>Hi</h1></body></html>`;

describe("injectEditorEmbed", () => {
  it("appends an idempotent loader that points at /embed.js with slug + editor base", () => {
    const out = injectEditorEmbed(page, { editorUrl: "https://editor.example.com", slug: "acme" });
    const $ = cheerio.load(out);
    const marker = $("[data-editor-embed]");
    expect(marker.length).toBe(1);
    expect(marker.attr("data-slug")).toBe("acme");
    expect(marker.attr("data-editor")).toBe("https://editor.example.com");
    expect(out).toContain("/embed.js");
    expect(out).toContain("location.hash==='#edit'");
  });

  it("trims a trailing slash on editorUrl", () => {
    const out = injectEditorEmbed(page, { editorUrl: "https://editor.example.com/", slug: "acme" });
    expect(out).toContain('"https://editor.example.com"');
    expect(out).not.toContain("example.com//embed.js");
  });

  it("is idempotent — re-injecting does not add a second loader", () => {
    const once = injectEditorEmbed(page, { editorUrl: "https://e.com", slug: "acme" });
    const twice = injectEditorEmbed(once, { editorUrl: "https://e.com", slug: "acme" });
    expect(cheerio.load(twice)("[data-editor-embed]").length).toBe(1);
  });
});
