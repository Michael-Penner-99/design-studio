import { z } from "zod";
import { ManifestSchema } from "@action-studio/editor-engine";
import type { Queryable } from "./db";
import * as repo from "./repo";

export const IngestPayloadSchema = z.object({
  slug: z.string().min(1),
  displayName: z.string().min(1),
  vercelProjectId: z.string().nullable(),
  customDomain: z.string().nullable(),
  tier: z.string().min(1),
  manifest: ManifestSchema,
  pages: z.array(z.object({ path: z.string().min(1), html: z.string() })),
  assets: z.array(z.object({ path: z.string().min(1), blobUrl: z.string(), size: z.number().int() })).optional().default([]),
});
export type IngestPayload = z.infer<typeof IngestPayloadSchema>;

/** Persist a pushed client. Overrides are intentionally left untouched (re-push preserves live edits). */
export async function ingest(db: Queryable, payload: IngestPayload): Promise<void> {
  await repo.upsertClient(db, {
    slug: payload.slug,
    displayName: payload.displayName,
    vercelProjectId: payload.vercelProjectId,
    customDomain: payload.customDomain,
    tier: payload.tier,
  });
  await repo.saveManifest(db, payload.slug, payload.manifest);
  await repo.saveTaggedPages(db, payload.slug, payload.pages);
  await repo.saveAssets(db, payload.slug, payload.assets);
}
