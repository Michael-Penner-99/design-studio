import type { Field, FieldType, Manifest, Tier } from "./types";

const TEXTISH: FieldType[] = ["text", "richtext", "link", "list"];

export const TIER_TYPES: Record<Exclude<Tier, "custom">, FieldType[]> = {
  "Text only": TEXTISH,
  "Text + Pictures": [...TEXTISH, "image"],
  "Text + Pictures + Colours": [...TEXTISH, "image", "color"],
  "Everything": [...TEXTISH, "image", "color", "section"],
};

export function tierAllows(tier: Exclude<Tier, "custom">, type: FieldType): boolean {
  return TIER_TYPES[tier].includes(type);
}

export function applyTier(manifest: Manifest, tier: Exclude<Tier, "custom">): Manifest {
  return {
    ...manifest,
    tier,
    fields: manifest.fields.map((f) => ({ ...f, clientEditable: tierAllows(tier, f.type) })),
  };
}

export function resolveTierLabel(fields: Field[], tier: Exclude<Tier, "custom">): Tier {
  const diverges = fields.some((f) => f.clientEditable !== tierAllows(tier, f.type));
  return diverges ? "custom" : tier;
}
