import { z } from "zod";

export const FIELD_TYPES = ["text", "richtext", "image", "color", "link", "list"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const TIERS = [
  "Text only",
  "Text + Pictures",
  "Text + Pictures + Colours",
  "Everything",
  "custom",
] as const;
export type Tier = (typeof TIERS)[number];

export const LinkValueSchema = z.object({ label: z.string(), href: z.string() });
export type LinkValue = z.infer<typeof LinkValueSchema>;

export const ConstraintsSchema = z
  .object({
    maxLength: z.number().int().positive().optional(),
    palette: z.array(z.string()).optional(),
    maxFileSizeKb: z.number().int().positive().optional(),
    aspectRatio: z.string().optional(),
  })
  .optional();

export const FieldSchema = z.object({
  id: z.string().min(1),
  page: z.string().min(1),
  section: z.string(),
  label: z.string(),
  type: z.enum(FIELD_TYPES),
  // text/richtext/image/color → string; link → {label, href}
  value: z.union([z.string(), LinkValueSchema]),
  clientEditable: z.boolean(),
  constraints: ConstraintsSchema,
});
export type Field = z.infer<typeof FieldSchema>;

export const ManifestSchema = z.object({
  slug: z.string().min(1),
  tier: z.enum(TIERS),
  fields: z.array(FieldSchema),
});
export type Manifest = z.infer<typeof ManifestSchema>;

export const OverridesSchema = z.record(z.string(), z.union([z.string(), LinkValueSchema]));
export type Overrides = z.infer<typeof OverridesSchema>;

export function parseManifest(input: unknown): Manifest {
  return ManifestSchema.parse(input);
}
