import type { Queryable } from "./db";
import * as repo from "./repo";

export type BlobPut = (key: string, bytes: Buffer) => Promise<{ url: string }>;

export function assetBlobKey(slug: string, path: string): string {
  const safe = path.replace(/[^a-zA-Z0-9._/-]/g, "_");
  return `clients/${slug}/assets/${safe}`;
}

export async function ingestAssets(
  db: Queryable, put: BlobPut, slug: string, assets: { path: string; base64: string }[]
): Promise<number> {
  for (const a of assets) {
    const bytes = Buffer.from(a.base64, "base64");
    const { url } = await put(assetBlobKey(slug, a.path), bytes);
    await repo.upsertAsset(db, slug, { path: a.path, blobUrl: url, size: bytes.length });
  }
  return assets.length;
}
