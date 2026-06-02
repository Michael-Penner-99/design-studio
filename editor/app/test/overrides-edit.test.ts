import { describe, it, expect } from "vitest";
import { canEditField, applyFieldOverride } from "../src/overrides-edit";
import type { Manifest } from "@action-studio/editor-engine";

const m: Manifest = { slug: "acme", tier: "Text only", fields: [
  { id: "a", page: "p", section: "s", label: "A", type: "text", value: "x", clientEditable: true },
  { id: "b", page: "p", section: "s", label: "B", type: "color", value: "#000", clientEditable: false },
] };

describe("canEditField", () => {
  it("client can edit only clientEditable fields; operator any known field", () => {
    expect(canEditField(m, "client", "a")).toBe(true);
    expect(canEditField(m, "client", "b")).toBe(false);
    expect(canEditField(m, "operator", "b")).toBe(true);
    expect(canEditField(m, "operator", "unknown")).toBe(false);
  });
});

describe("applyFieldOverride", () => {
  it("merges one field into the existing override map", () => {
    expect(applyFieldOverride({ a: "1" }, "x", "2")).toEqual({ a: "1", x: "2" });
  });
});
