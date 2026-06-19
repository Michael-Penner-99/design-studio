import { mergePages, injectEditorEmbed } from "@action-studio/editor-engine";
import type { Queryable } from "./db";
import * as repo from "./repo";
import { deployFiles, getDeploymentState } from "./vercel";

export type PublishMode = "preview" | "publish";
export interface PublishResult { url: string; deploymentId: string; }

const LOCK_TTL = 300;
const READY_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 2_000;

async function waitForReady(id: string): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  // First check is immediate; only sleep between subsequent checks.
  // (READY/ERROR are usually returned quickly for small static deploys.)
  while (true) {
    const state = await getDeploymentState(id);
    if (state === "READY") return;
    if (state === "ERROR" || state === "CANCELED") throw new Error(`Deployment ${id} failed: ${state}`);
    if (Date.now() >= deadline) throw new Error(`Deployment ${id} not ready within ${READY_TIMEOUT_MS}ms (last state: ${state})`);
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

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

    const editorUrl = process.env.EDITOR_PUBLIC_URL;
    const pages = editorUrl
      ? merged.pages.map((p) => ({ path: p.path, html: injectEditorEmbed(p.html, { editorUrl, slug }) }))
      : merged.pages;

    const result = await deployFiles({
      projectId: client.vercel_project_id,
      projectName: `${slug}-site`,
      target: mode === "publish" ? "production" : undefined,
      files: pages.map((p) => ({ path: p.path, content: p.html })),
      assets: assets.map((a) => ({ path: a.path, base64: a.base64 })),
    });
    await waitForReady(result.id);
    return { url: result.url, deploymentId: result.id };
  } finally {
    await repo.releaseLock(db, slug);
  }
}
