import { applyTier, resolveTierLabel, type Manifest, type Tier } from "@action-studio/editor-engine";

export interface PermissionChange {
  tier: Exclude<Tier, "custom">;
  perField?: Record<string, boolean>;
}

export function applyPermissionChange(manifest: Manifest, change: PermissionChange): { manifest: Manifest } {
  const tiered = applyTier(manifest, change.tier);
  const fields = tiered.fields.map((f) =>
    change.perField && f.id in change.perField ? { ...f, clientEditable: change.perField[f.id] } : f
  );
  const label = resolveTierLabel(fields, change.tier);
  return { manifest: { ...tiered, tier: label, fields } };
}
