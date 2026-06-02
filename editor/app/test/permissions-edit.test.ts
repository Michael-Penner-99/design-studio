import { describe, it, expect } from "vitest";
import { applyPermissionChange } from "../src/permissions-edit";
import type { Manifest } from "@action-studio/editor-engine";

const m: Manifest = { slug: "acme", tier: "Text only", fields: [
  { id: "t", page: "p", section: "s", label: "t", type: "text", value: "x", clientEditable: true },
  { id: "c", page: "p", section: "s", label: "c", type: "color", value: "#000", clientEditable: false },
] };

describe("applyPermissionChange", () => {
  it("changing tier bulk-sets clientEditable by type", () => {
    const out = applyPermissionChange(m, { tier: "Text + Pictures + Colours" });
    expect(out.manifest.fields.every((f) => f.clientEditable)).toBe(true);
    expect(out.manifest.tier).toBe("Text + Pictures + Colours");
  });

  it("a per-field override that diverges flips the label to custom", () => {
    const out = applyPermissionChange(m, { tier: "Text only", perField: { c: true } });
    expect(out.manifest.fields.find((f) => f.id === "c")!.clientEditable).toBe(true);
    expect(out.manifest.tier).toBe("custom");
  });
});
