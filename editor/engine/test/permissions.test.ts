import { describe, it, expect } from "vitest";
import { applyTier, resolveTierLabel, TIER_TYPES } from "../src/permissions";
import type { Manifest } from "../src/types";

function manifest(): Manifest {
  return {
    slug: "acme", tier: "Text only",
    fields: [
      { id: "t1", page: "p", section: "s", label: "t", type: "text", value: "x", clientEditable: false },
      { id: "i1", page: "p", section: "s", label: "i", type: "image", value: "x", clientEditable: false },
      { id: "c1", page: "p", section: "s", label: "c", type: "color", value: "#000", clientEditable: false },
    ],
  };
}

describe("applyTier", () => {
  it("Text + Pictures enables text and image but not color", () => {
    const m = applyTier(manifest(), "Text + Pictures");
    const byId = Object.fromEntries(m.fields.map((f) => [f.id, f.clientEditable]));
    expect(byId).toEqual({ t1: true, i1: true, c1: false });
    expect(m.tier).toBe("Text + Pictures");
  });

  it("Text + Pictures + Colours enables all three", () => {
    const m = applyTier(manifest(), "Text + Pictures + Colours");
    expect(m.fields.every((f) => f.clientEditable)).toBe(true);
  });

  it("Everything enables all editable types", () => {
    const m = applyTier(manifest(), "Everything");
    expect(m.fields.every((f) => f.clientEditable)).toBe(true);
  });
});

describe("resolveTierLabel", () => {
  it("returns the tier when all fields match the tier defaults", () => {
    const m = applyTier(manifest(), "Text + Pictures");
    expect(resolveTierLabel(m.fields, "Text + Pictures")).toBe("Text + Pictures");
  });

  it("returns 'custom' when a field diverges from its tier default", () => {
    const m = applyTier(manifest(), "Text + Pictures");
    m.fields.find((f) => f.id === "c1")!.clientEditable = true; // color on, but tier says off
    expect(resolveTierLabel(m.fields, "Text + Pictures")).toBe("custom");
  });
});
