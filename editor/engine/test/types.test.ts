import { describe, it, expect } from "vitest";
import { FieldSchema, ManifestSchema, parseManifest } from "../src/types";

describe("FieldSchema", () => {
  it("accepts a valid text field", () => {
    const field = {
      id: "index__h1__1",
      page: "index.html",
      section: "Hero",
      label: "Main headline",
      type: "text",
      value: "Hello",
      clientEditable: true,
      constraints: { maxLength: 60 },
    };
    expect(FieldSchema.parse(field).id).toBe("index__h1__1");
  });

  it("accepts a link field whose value is {label, href}", () => {
    const field = {
      id: "index__a__1",
      page: "index.html",
      section: "Hero",
      label: "CTA",
      type: "link",
      value: { label: "Call now", href: "tel:3065551234" },
      clientEditable: false,
    };
    expect(FieldSchema.parse(field).type).toBe("link");
  });

  it("rejects an unknown field type", () => {
    expect(() =>
      FieldSchema.parse({
        id: "x", page: "p", section: "s", label: "l",
        type: "video", value: "v", clientEditable: true,
      })
    ).toThrow();
  });
});

describe("parseManifest", () => {
  it("round-trips a manifest with tier metadata", () => {
    const m = parseManifest({
      slug: "acme",
      tier: "Text + Pictures",
      fields: [{
        id: "index__p__1", page: "index.html", section: "About",
        label: "Intro", type: "text", value: "Hi", clientEditable: true,
      }],
    });
    expect(m.fields).toHaveLength(1);
    expect(m.tier).toBe("Text + Pictures");
  });
});
