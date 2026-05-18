import { z } from "zod";

// Mirrors queue/{run-id}.json from docs/queue-contract.md
export const tradeHintSchema = z.enum([
  "roofing",
  "hvac",
  "plumbing",
  "electrical",
  "exteriors",
  "remodel",
]);

export const optionsSchema = z
  .object({
    skip_deploy: z.boolean().default(false),
    force_archetype: z.string().nullable().default(null),
    ai_image_provider: z.string().default("openai"),
  })
  .default({
    skip_deploy: false,
    force_archetype: null,
    ai_image_provider: "openai",
  });

// Public form input — what the client component posts to /api/runs.
// The discriminator is `mode`. Each variant has its own required fields.
export const newRunInputSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("url"),
    url: z.string().url("Must be a valid URL"),
    manual_notes: z.string().optional(),
    options: optionsSchema.optional(),
  }),
  z.object({
    mode: z.literal("name-and-reviews"),
    business_name: z.string().min(2, "Business name is required"),
    trade_hint: tradeHintSchema,
    primary_city: z.string().min(2, "City is required"),
    reviews_text: z.string().min(10, "Paste at least one review"),
    manual_notes: z.string().optional(),
    options: optionsSchema.optional(),
  }),
]);

export type NewRunInput = z.infer<typeof newRunInputSchema>;

// Full job spec written to queue/{run-id}.json
export const jobSpecSchema = z.object({
  run_id: z.string(),
  submitted_at: z.string(),
  submitted_by: z.string(),
  mode: z.enum(["url", "name-and-reviews"]),
  url: z.string().optional(),
  business_name: z.string().optional(),
  trade_hint: tradeHintSchema.optional(),
  primary_city: z.string().optional(),
  reviews_text: z.string().optional(),
  manual_notes: z.string().optional(),
  options: z.object({
    skip_deploy: z.boolean(),
    force_archetype: z.string().nullable(),
    ai_image_provider: z.string(),
  }),
});

export type JobSpec = z.infer<typeof jobSpecSchema>;

// Run status — what runs/{run-id}.json looks like
export const phaseStatusSchema = z.object({
  name: z.string(),
  status: z.enum(["pending", "running", "completed", "halted"]),
  started_at: z.string().optional().nullable(),
  completed_at: z.string().optional().nullable(),
});

export const runStatusSchema = z.object({
  run_id: z.string(),
  slug: z.string().optional().nullable(),
  mode: z.enum(["url", "name-and-reviews"]),
  url: z.string().optional().nullable(),
  business_name: z.string().optional().nullable(),
  started_at: z.string(),
  updated_at: z.string().optional().nullable(),
  status: z.enum(["queued", "running", "completed", "halted"]),
  current_phase: z.number().int().min(0).max(8).optional().nullable(),
  phases: z.record(z.string(), phaseStatusSchema).optional().default({}),
  outputs: z
    .object({
      site_url: z.string().nullable().optional(),
      sales_walkthrough_url: z.string().nullable().optional(),
      proposal_pdf_path: z.string().nullable().optional(),
    })
    .optional()
    .nullable(),
  halt_reason: z.string().nullable().optional(),
  halt_phase: z.number().int().nullable().optional(),
});

export type RunStatus = z.infer<typeof runStatusSchema>;
export type PhaseStatus = z.infer<typeof phaseStatusSchema>;

export const PHASE_NAMES: Record<string, string> = {
  "1": "Discovery",
  "2": "Capture",
  "3": "Brand DNA",
  "4": "Strategy",
  "5": "Build",
  "6": "Quality",
  "7": "Sales-Ready",
  "8": "Deploy & Handoff",
};
