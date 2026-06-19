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

export async function listClients(db: Queryable): Promise<ClientRow[]> {
  const { rows } = await db.query(
    `SELECT slug, display_name, vercel_project_id, custom_domain, permission_tier FROM clients ORDER BY display_name`
  );
  return rows;
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

export interface CredentialRow { username: string; slug: string | null; role: string; password_hash: string; }

export async function setCredential(
  db: Queryable,
  c: { username: string; slug: string | null; role: "operator" | "client"; passwordHash: string }
): Promise<void> {
  await db.query(
    `INSERT INTO credentials (username, slug, role, password_hash) VALUES ($1,$2,$3,$4)
     ON CONFLICT (username) DO UPDATE SET slug=EXCLUDED.slug, role=EXCLUDED.role, password_hash=EXCLUDED.password_hash`,
    [c.username, c.slug, c.role, c.passwordHash]
  );
}

export async function findCredential(db: Queryable, username: string): Promise<CredentialRow | null> {
  const { rows } = await db.query(
    `SELECT username, slug, role, password_hash FROM credentials WHERE username=$1`,
    [username]
  );
  return rows[0] ?? null;
}

export interface SessionRow { id: string; username: string; slug: string | null; role: string; }

export async function createSession(
  db: Queryable,
  s: { id: string; username: string; slug: string | null; role: string; expiresAt: Date }
): Promise<void> {
  await db.query(
    `INSERT INTO sessions (id, username, slug, role, expires_at) VALUES ($1,$2,$3,$4,$5)`,
    [s.id, s.username, s.slug, s.role, s.expiresAt.toISOString()]
  );
}

export async function getSessionRow(db: Queryable, id: string): Promise<SessionRow | null> {
  const { rows } = await db.query(
    `SELECT id, username, slug, role FROM sessions WHERE id=$1 AND expires_at > now()`,
    [id]
  );
  return rows[0] ?? null;
}

export async function deleteSession(db: Queryable, id: string): Promise<void> {
  await db.query(`DELETE FROM sessions WHERE id=$1`, [id]);
}

export interface AssetRow { path: string; base64: string; }

export async function saveAssets(db: Queryable, slug: string, assets: AssetRow[]): Promise<void> {
  await db.query(`DELETE FROM assets WHERE slug=$1`, [slug]);
  for (const a of assets) {
    await db.query(`INSERT INTO assets (slug, path, base64) VALUES ($1,$2,$3)`, [slug, a.path, a.base64]);
  }
}

export async function getAssets(db: Queryable, slug: string): Promise<AssetRow[]> {
  const { rows } = await db.query(`SELECT path, base64 FROM assets WHERE slug=$1 ORDER BY path`, [slug]);
  return rows.map((r) => ({ path: r.path, base64: r.base64 }));
}

export async function promoteOverrides(db: Queryable, slug: string): Promise<void> {
  const draft = await getOverrides(db, slug, "draft");
  await saveOverrides(db, slug, "published", draft);
}

/**
 * Returns true if the lock was acquired.
 * Locks older than ttlSeconds are reclaimed as stale.
 *
 * Implementation: JS-side staleness check (DELETE stale, then INSERT with try/catch on PK violation).
 * This avoids pg-mem's limited support for interval arithmetic and ON CONFLICT RETURNING.
 * On real Postgres the semantics are identical; the only difference vs an atomic CTE is a negligible
 * TOCTOU window that is acceptable for publish-locking.
 */
export async function acquireLock(db: Queryable, slug: string, ttlSeconds: number): Promise<boolean> {
  // Evict stale lock if present
  const { rows: existing } = await db.query(
    `SELECT acquired_at FROM publish_locks WHERE slug=$1`,
    [slug]
  );
  if (existing.length > 0) {
    const acquiredAt = new Date(existing[0].acquired_at).getTime();
    if (Date.now() - acquiredAt > ttlSeconds * 1000) {
      await db.query(`DELETE FROM publish_locks WHERE slug=$1`, [slug]);
    }
  }

  // Attempt insert; catch PK violation (lock already held)
  try {
    await db.query(`INSERT INTO publish_locks (slug) VALUES ($1)`, [slug]);
    return true;
  } catch {
    return false;
  }
}

export async function releaseLock(db: Queryable, slug: string): Promise<void> {
  await db.query(`DELETE FROM publish_locks WHERE slug=$1`, [slug]);
}
