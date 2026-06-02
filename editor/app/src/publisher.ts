import { mergePages } from "@action-studio/editor-engine";
import type { Queryable } from "./db";
import * as repo from "./repo";
import { deployFiles } from "./vercel";

export type PublishMode = "preview" | "publish";
export interface PublishResult { url: string; deploymentId: string; }

const LOCK_TTL = 300;

export async function publish(db: Queryable, slug: string, mode: PublishMode): Promise<PublishResult> {
  const client = await repo.getClient(db, slug);
  if (!client) throw new Error(`Unknown client: ${slug}`);
  if (!client.vercel_project_id) throw new Error(`Client ${slug} has no Vercel project id`);

  if (!(await repo.acquireLock(db, slug, LOCK_TTL))) {
    throw new Error(`A publish is already in progress for ${slug}`);
  }
  try {
    if (mode === "publish") await repo.promoteOverrides(db, slug);
    const state = mode === "publish" ? "published" : "draft";
    const overrides = await repo.getOverrides(db, slug, state);
    const taggedPages = await repo.getTaggedPages(db, slug);
    const assets = await repo.getAssets(db, slug);

    const merged = mergePages(taggedPages.map((p) => ({ path: p.path, html: p.html })), overrides);

    const result = await deployFiles({
      projectId: client.vercel_project_id,
      projectName: `${slug}-site`,
      target: mode === "publish" ? "production" : undefined,
      files: merged.pages.map((p) => ({ path: p.path, content: p.html })),
      assets: assets.map((a) => ({ path: a.path, base64: a.base64 })),
    });
    return { url: result.url, deploymentId: result.id };
  } finally {
    await repo.releaseLock(db, slug);
  }
}
