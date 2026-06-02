import { describe, it, expect } from "vitest";
import { groupFields, visibleFields } from "../src/view";
import type { Manifest } from "@action-studio/editor-engine";

const m: Manifest = {
  slug: "acme", tier: "Text + Pictures",
  fields: [
    { id: "index__h1__1", page: "index.html", section: "Hero", label: "Headline", type: "text", value: "Hi", clientEditable: true },
    { id: "index__img__1", page: "index.html", section: "Hero", label: "Photo", type: "image", value: "a.jpg", clientEditable: true },
    { id: "color__primary", page: "index.html", section: "Brand Colors", label: "primary", type: "color", value: "#000", clientEditable: false },
    { id: "about__p__1", page: "about.html", section: "Story", label: "Intro", type: "text", value: "x", clientEditable: true },
  ],
};

describe("visibleFields", () => {
  it("client sees only clientEditable; operator sees all", () => {
    expect(visibleFields(m, "client").map((f) => f.id)).toEqual(["index__h1__1", "index__img__1", "about__p__1"]);
    expect(visibleFields(m, "operator")).toHaveLength(4);
  });
});

describe("groupFields", () => {
  it("groups by page then section, preserving order", () => {
    const g = groupFields(visibleFields(m, "client"));
    expect(g.map((p) => p.page)).toEqual(["index.html", "about.html"]);
    expect(g[0].sections.map((s) => s.section)).toEqual(["Hero"]);
    expect(g[0].sections[0].fields.map((f) => f.id)).toEqual(["index__h1__1", "index__img__1"]);
  });
});
