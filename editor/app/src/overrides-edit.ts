import type { Manifest, Overrides } from "@action-studio/editor-engine";

export function canEditField(manifest: Manifest, role: "operator" | "client", fieldId: string): boolean {
  const field = manifest.fields.find((f) => f.id === fieldId);
  if (!field) return false;
  return role === "operator" || field.clientEditable;
}

export function applyFieldOverride(current: Overrides, fieldId: string, value: Overrides[string]): Overrides {
  return { ...current, [fieldId]: value };
}
