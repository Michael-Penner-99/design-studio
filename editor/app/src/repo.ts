import type { Queryable } from "./db";
import type { Manifest, Overrides } from "@action-studio/editor-engine";

export interface ClientRow {
  slug: string;
  display_name: string;
  vercel_project_id: string | null;
  custom_domain: string | null;
  permission_tier: string;
}

export interface UpsertClientInput {
  slug: string;
  displayName: string;
  vercelProjectId: string | null;
  customDomain: string | null;
  tier: string;
}

export async function upsertClient(db: Queryable, c: UpsertClientInput): Promise<void> {
  await db.query(
    `INSERT INTO clients (slug, display_name, vercel_project_id, custom_domain, permission_tier)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (slug) DO UPDATE SET
       display_name=EXCLUDED.display_name,
       vercel_project_id=EXCLUDED.vercel_project_id,
       custom_domain=EXCLUDED.custom_domain,
       permission_tier=EXCLUDED.permission_tier`,
    [c.slug, c.displayName, c.vercelProjectId, c.customDomain, c.tier]
  );
}

export async function getClient(db: Queryable, slug: string): Promise<ClientRow | null> {
  const { rows } = await db.query(
    `SELECT slug, display_name, vercel_project_id, custom_domain, permission_tier FROM clients WHERE slug=$1`,
    [slug]
  );
  return rows[0] ?? null;
}

export async function saveManifest(db: Queryable, slug: string, manifest: Manifest): Promise<void> {
  await db.query(
    `INSERT INTO manifests (slug, manifest, updated_at) VALUES ($1,$2, now())
     ON CONFLICT (slug) DO UPDATE SET manifest=EXCLUDED.manifest, updated_at=now()`,
    [slug, JSON.stringify(manifest)]
  );
}

export async function getManifest(db: Queryable, slug: string): Promise<Manifest | null> {
  const { rows } = await db.query(`SELECT manifest FROM manifests WHERE slug=$1`, [slug]);
  if (!rows[0]) return null;
  const m = rows[0].manifest;
  return typeof m === "string" ? JSON.parse(m) : m;
}

export interface TaggedPage { path: string; html: string; }

export async function saveTaggedPages(db: Queryable, slug: string, pages: TaggedPage[]): Promise<void> {
  await db.query(`DELETE FROM tagged_pages WHERE slug=$1`, [slug]);
  for (const p of pages) {
    await db.query(`INSERT INTO tagged_pages (slug, path, html) VALUES ($1,$2,$3)`, [slug, p.path, p.html]);
  }
}

export async function getTaggedPages(db: Queryable, slug: string): Promise<TaggedPage[]> {
  const { rows } = await db.query(`SELECT path, html FROM tagged_pages WHERE slug=$1 ORDER BY path`, [slug]);
  return rows.map((r) => ({ path: r.path, html: r.html }));
}

export async function saveOverrides(db: Queryable, slug: string, state: "draft" | "published", data: Overrides): Promise<void> {
  await db.query(
    `INSERT INTO overrides (slug, state, data, updated_at) VALUES ($1,$2,$3, now())
     ON CONFLICT (slug, state) DO UPDATE SET data=EXCLUDED.data, updated_at=now()`,
    [slug, state, JSON.stringify(data)]
  );
}

export async function getOverrides(db: Queryable, slug: string, state: "draft" | "published"): Promise<Overrides> {
  const { rows } = await db.query(`SELECT data FROM overrides WHERE slug=$1 AND state=$2`, [slug, state]);
  if (!rows[0]) return {};
  const d = rows[0].data;
  return typeof d === "string" ? JSON.parse(d) : d;
}
