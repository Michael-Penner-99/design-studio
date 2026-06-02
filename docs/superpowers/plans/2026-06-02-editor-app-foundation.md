# Editor App Foundation (Plan 2b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the hosted editor app's durable backbone — a Next.js app with a Postgres data layer, operator + per-client auth, an ingestion API, the engine `push` command, and a "Push to editor" button in the local `web/` operator app — so a built client site can be pushed to the cloud, stored durably, and its users can log in.

**Architecture:** A new Next.js 14 app at `editor/app/` (separate from the `web/` operator app), deployed to `editor.actiondesignstudio.com`. It depends on `@action-studio/editor-engine` (`file:../engine`) for tagging/schemas. Data lives in Postgres accessed through a thin `Queryable` interface so the repository layer is unit-tested with `pg-mem` (in-memory Postgres) and runs on `pg` (node-postgres) in production. Auth is minimal-custom: bcrypt password hashes + a server-side `sessions` table keyed by an httpOnly cookie. Ingestion is an operator-token-protected API; the engine gains a `push` command that assembles the payload from a local build, and `web/` gets a button that invokes it.

**Tech Stack:** Next.js 14 (App Router, `runtime = "nodejs"`), TypeScript, `pg`, `pg-mem` (tests), `bcryptjs`, `zod`, `vitest`. Imports the merged engine package.

**Builds on:** [App design spec](../specs/2026-06-02-client-site-editor-app-design.md) §§2–7 and the merged engine (`editor/engine/`). **Out of scope (later plans):** the Publisher / Vercel redeploy (Plan 2c), and the editor + admin UIs and image upload to Blob (Plan 2d). This plan stores tagged HTML in Postgres; image uploads come with the UI plan.

---

## Background the engineer needs

- The factory builds a site locally at `clients/{slug}/site/` and records the client's Vercel project in `clients/{slug}/deploy/manifest.json` (fields `site.vercel_project_id`, `site.preview_url` — the custom domain). These files are **gitignored** (local-only generated artifacts).
- The engine package (`editor/engine/`) already exports `buildManifest({slug, siteDir, outDir, tier})`, `ManifestSchema`/`parseManifest`, `checkEditorReadiness`, and a CLI. Plan 2b adds a `push` command to it.
- `web/` is the existing Next.js operator app (token-auth pattern: a `checkAuth` reading `Authorization: Bearer` / `x-*-token`; routes set `export const runtime = "nodejs"` and `export const dynamic = "force-dynamic"`). It runs locally (`npm run dev`) with filesystem access. The push button lives here.
- The hosted editor app is the **durable system of record** — if the operator's laptop dies, the repo is in GitHub and all editor data is in hosted Postgres.

---

## Data model (Postgres)

```sql
-- editor/app/db/schema.sql
CREATE TABLE IF NOT EXISTS clients (
  slug            TEXT PRIMARY KEY,
  display_name    TEXT NOT NULL,
  vercel_project_id TEXT,
  custom_domain   TEXT,
  permission_tier TEXT NOT NULL DEFAULT 'Text only',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS credentials (
  username      TEXT PRIMARY KEY,
  slug          TEXT,                 -- NULL for the operator account
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL,        -- 'operator' | 'client'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS manifests (
  slug       TEXT PRIMARY KEY,
  manifest   JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tagged_pages (
  slug TEXT NOT NULL,
  path TEXT NOT NULL,
  html TEXT NOT NULL,
  PRIMARY KEY (slug, path)
);

CREATE TABLE IF NOT EXISTS overrides (
  slug       TEXT NOT NULL,
  state      TEXT NOT NULL,           -- 'draft' | 'published'
  data       JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (slug, state)
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  username   TEXT NOT NULL,
  slug       TEXT,                    -- NULL for operator
  role       TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
```

---

## File Structure

| File | Responsibility |
|---|---|
| `editor/app/package.json`, `tsconfig.json`, `next.config.mjs`, `vitest.config.ts` | App scaffold |
| `editor/app/db/schema.sql` | Schema above |
| `editor/app/src/db.ts` | `Queryable` interface; `getDb()` (prod `pg` pool); `applySchema(db)` |
| `editor/app/test/helpers/pgmem.ts` | Build a `pg-mem` `Queryable` with schema applied (test helper) |
| `editor/app/src/repo.ts` | Repository functions over `Queryable` |
| `editor/app/src/auth.ts` | `hashPassword`/`verifyPassword`, `login`, `sessionFromCookie` |
| `editor/app/src/ingest.ts` | `IngestPayloadSchema` + `ingest(db, payload)` |
| `editor/app/app/api/ingest/route.ts` | Operator-token ingestion endpoint |
| `editor/app/app/api/admin/credentials/route.ts` | Operator-token: set a client password |
| `editor/app/app/api/auth/login/route.ts`, `.../logout/route.ts` | Login/logout cookie endpoints |
| `editor/engine/src/push.ts` | `buildPushPayload(opts)` |
| `editor/engine/src/cli.ts` | add `push` command |
| `web/app/clients/page.tsx`, `web/app/api/push/[slug]/route.ts` | "Push to editor" button + local exec route |

---

### Task 0: Scaffold the editor app

**Files:** `editor/app/package.json`, `editor/app/tsconfig.json`, `editor/app/next.config.mjs`, `editor/app/vitest.config.ts`, `editor/app/src/.gitkeep`

- [ ] **Step 1: Create `editor/app/package.json`**

```json
{
  "name": "@action-studio/editor-app",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@action-studio/editor-engine": "file:../engine",
    "bcryptjs": "^2.4.3",
    "next": "14.2.15",
    "pg": "^8.12.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/node": "^20.16.10",
    "@types/pg": "^8.11.10",
    "@types/react": "^18.3.11",
    "pg-mem": "^3.0.5",
    "typescript": "^5.6.2",
    "vitest": "^2.1.1"
  }
}
```

- [ ] **Step 2: Create `editor/app/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "jsx": "preserve",
    "noEmit": true,
    "plugins": [{ "name": "next" }]
  },
  "include": ["src", "app", "test", "next-env.d.ts"]
}
```

- [ ] **Step 3: Create `editor/app/next.config.mjs`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = { transpilePackages: ["@action-studio/editor-engine"] };
export default nextConfig;
```

- [ ] **Step 4: Create `editor/app/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["test/**/*.test.ts"], environment: "node" } });
```

- [ ] **Step 5: Create `editor/app/src/.gitkeep`** (empty file) and a `editor/app/.gitignore`:

```
node_modules/
.next/
```

- [ ] **Step 6: Install and typecheck**

Run: `cd editor/app && npm install && npm run typecheck`
Expected: install succeeds; `tsc --noEmit` exits 0 (no `.ts` files yet → trivially passes). If a listed version cannot resolve, pick the nearest valid published version and report it.

- [ ] **Step 7: Commit**

```bash
git add editor/app/package.json editor/app/tsconfig.json editor/app/next.config.mjs editor/app/vitest.config.ts editor/app/src/.gitkeep editor/app/.gitignore editor/app/package-lock.json
git commit -m "chore(editor-app): scaffold Next.js editor app"
```

---

### Task 1: DB layer (`Queryable`, schema, pg-mem test helper)

**Files:** `editor/app/db/schema.sql`, `editor/app/src/db.ts`, `editor/app/test/helpers/pgmem.ts`, `editor/app/test/db.test.ts`

- [ ] **Step 1: Create `editor/app/db/schema.sql`** — exactly the SQL from the "Data model" section above.

- [ ] **Step 2: Write the failing test** at `editor/app/test/db.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { makeTestDb } from "./helpers/pgmem";

describe("schema", () => {
  it("creates all tables and round-trips a row", async () => {
    const db = await makeTestDb();
    await db.query(
      "INSERT INTO clients (slug, display_name) VALUES ($1,$2)",
      ["acme", "Acme Co"]
    );
    const { rows } = await db.query("SELECT slug, permission_tier FROM clients WHERE slug=$1", ["acme"]);
    expect(rows[0]).toEqual({ slug: "acme", permission_tier: "Text only" });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd editor/app && npx vitest run test/db.test.ts`
Expected: FAIL — `Cannot find module './helpers/pgmem'`.

- [ ] **Step 4: Write `editor/app/src/db.ts`**

```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Pool } from "pg";

/** Minimal query surface shared by the production pg Pool and the pg-mem test pool. */
export interface Queryable {
  query(text: string, params?: unknown[]): Promise<{ rows: any[] }>;
}

let pool: Pool | undefined;
export function getDb(): Queryable {
  if (!pool) {
    const connectionString = process.env.POSTGRES_URL;
    if (!connectionString) throw new Error("POSTGRES_URL is not set");
    pool = new Pool({ connectionString });
  }
  return pool;
}

export function schemaSql(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return readFileSync(join(here, "..", "db", "schema.sql"), "utf8");
}

export async function applySchema(db: Queryable): Promise<void> {
  await db.query(schemaSql());
}
```

- [ ] **Step 5: Write `editor/app/test/helpers/pgmem.ts`**

```ts
import { newDb } from "pg-mem";
import type { Queryable } from "../../src/db";
import { schemaSql } from "../../src/db";

/** An in-memory Postgres with the schema applied, satisfying Queryable. */
export async function makeTestDb(): Promise<Queryable> {
  const mem = newDb();
  const { Pool } = mem.adapters.createPg();
  const pool = new Pool();
  await pool.query(schemaSql());
  return pool as unknown as Queryable;
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd editor/app && npx vitest run test/db.test.ts`
Expected: PASS. If `pg-mem` rejects any DDL (e.g. an unsupported type), simplify that column to a supported type and note it — keep `TEXT`, `JSONB`, `TIMESTAMPTZ`, `DEFAULT now()`, and `PRIMARY KEY`, which pg-mem supports.

- [ ] **Step 7: Commit**

```bash
git add editor/app/db/schema.sql editor/app/src/db.ts editor/app/test/helpers/pgmem.ts editor/app/test/db.test.ts
git commit -m "feat(editor-app): postgres schema + Queryable + pg-mem test harness"
```

---

### Task 2: Repository layer

**Files:** `editor/app/src/repo.ts`, `editor/app/test/repo.test.ts`

- [ ] **Step 1: Write the failing test** at `editor/app/test/repo.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { makeTestDb } from "./helpers/pgmem";
import * as repo from "../src/repo";

const manifest = { slug: "acme", tier: "Text only", fields: [] };

describe("repo", () => {
  it("upserts a client and reads it back", async () => {
    const db = await makeTestDb();
    await repo.upsertClient(db, { slug: "acme", displayName: "Acme", vercelProjectId: "prj_1", customDomain: "acme.example.com", tier: "Text only" });
    const c = await repo.getClient(db, "acme");
    expect(c?.display_name).toBe("Acme");
    expect(c?.vercel_project_id).toBe("prj_1");
  });

  it("saves and reads the manifest and tagged pages", async () => {
    const db = await makeTestDb();
    await repo.upsertClient(db, { slug: "acme", displayName: "Acme", vercelProjectId: null, customDomain: null, tier: "Text only" });
    await repo.saveManifest(db, "acme", manifest);
    await repo.saveTaggedPages(db, "acme", [{ path: "index.html", html: "<h1>hi</h1>" }]);
    expect((await repo.getManifest(db, "acme"))?.slug).toBe("acme");
    expect(await repo.getTaggedPages(db, "acme")).toEqual([{ path: "index.html", html: "<h1>hi</h1>" }]);
  });

  it("re-saving tagged pages replaces them (idempotent re-push)", async () => {
    const db = await makeTestDb();
    await repo.upsertClient(db, { slug: "acme", displayName: "Acme", vercelProjectId: null, customDomain: null, tier: "Text only" });
    await repo.saveTaggedPages(db, "acme", [{ path: "index.html", html: "<h1>v1</h1>" }]);
    await repo.saveTaggedPages(db, "acme", [{ path: "index.html", html: "<h1>v2</h1>" }]);
    const pages = await repo.getTaggedPages(db, "acme");
    expect(pages).toEqual([{ path: "index.html", html: "<h1>v2</h1>" }]);
  });

  it("preserves overrides across re-save (draft + published independent)", async () => {
    const db = await makeTestDb();
    await repo.upsertClient(db, { slug: "acme", displayName: "Acme", vercelProjectId: null, customDomain: null, tier: "Text only" });
    await repo.saveOverrides(db, "acme", "draft", { "index__h1__1": "Hello" });
    expect(await repo.getOverrides(db, "acme", "draft")).toEqual({ "index__h1__1": "Hello" });
    expect(await repo.getOverrides(db, "acme", "published")).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd editor/app && npx vitest run test/repo.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `editor/app/src/repo.ts`**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd editor/app && npx vitest run test/repo.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add editor/app/src/repo.ts editor/app/test/repo.test.ts
git commit -m "feat(editor-app): repository layer over Postgres"
```

---

### Task 3: Auth (hashing, credentials, sessions, login)

**Files:** `editor/app/src/auth.ts`, `editor/app/test/auth.test.ts` (extends `repo.ts` with credential + session helpers)

- [ ] **Step 1: Write the failing test** at `editor/app/test/auth.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { makeTestDb } from "./helpers/pgmem";
import * as repo from "../src/repo";
import { hashPassword, verifyPassword, login, getSession } from "../src/auth";

describe("auth", () => {
  it("hashes and verifies a password", async () => {
    const h = await hashPassword("s3cret");
    expect(h).not.toBe("s3cret");
    expect(await verifyPassword("s3cret", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
  });

  it("logs in a client and creates a retrievable session", async () => {
    const db = await makeTestDb();
    await repo.upsertClient(db, { slug: "acme", displayName: "Acme", vercelProjectId: null, customDomain: null, tier: "Text only" });
    await repo.setCredential(db, { username: "acme", slug: "acme", role: "client", passwordHash: await hashPassword("pw") });

    const ok = await login(db, "acme", "pw");
    expect(ok).not.toBeNull();
    expect(ok!.role).toBe("client");
    const session = await getSession(db, ok!.sessionId);
    expect(session?.slug).toBe("acme");

    expect(await login(db, "acme", "bad")).toBeNull();
    expect(await login(db, "nobody", "pw")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd editor/app && npx vitest run test/auth.test.ts`
Expected: FAIL — `setCredential` / `../src/auth` missing.

- [ ] **Step 3: Add credential + session helpers to `editor/app/src/repo.ts`** (append):

```ts
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
```

- [ ] **Step 4: Write `editor/app/src/auth.ts`**

```ts
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Queryable } from "./db";
import { findCredential, createSession, getSessionRow, type SessionRow } from "./repo";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export interface LoginResult { sessionId: string; role: string; slug: string | null; }

/** Returns a session on success, or null on bad username/password (no user enumeration). */
export async function login(db: Queryable, username: string, password: string, now: number = Date.now()): Promise<LoginResult | null> {
  const cred = await findCredential(db, username);
  if (!cred) return null;
  if (!(await verifyPassword(password, cred.password_hash))) return null;
  const sessionId = randomUUID();
  await createSession(db, {
    id: sessionId, username: cred.username, slug: cred.slug, role: cred.role,
    expiresAt: new Date(now + SESSION_TTL_MS),
  });
  return { sessionId, role: cred.role, slug: cred.slug };
}

export async function getSession(db: Queryable, sessionId: string): Promise<SessionRow | null> {
  return getSessionRow(db, sessionId);
}
```

Note: `login` takes `now` defaulting to `Date.now()` so tests are deterministic if needed; `getSessionRow` enforces `expires_at > now()` at the DB level.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd editor/app && npx vitest run test/auth.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add editor/app/src/auth.ts editor/app/src/repo.ts editor/app/test/auth.test.ts
git commit -m "feat(editor-app): bcrypt auth + server-side sessions"
```

---

### Task 4: Ingestion logic + API route

**Files:** `editor/app/src/ingest.ts`, `editor/app/test/ingest.test.ts`, `editor/app/app/api/ingest/route.ts`

- [ ] **Step 1: Write the failing test** at `editor/app/test/ingest.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { makeTestDb } from "./helpers/pgmem";
import { ingest, IngestPayloadSchema } from "../src/ingest";
import * as repo from "../src/repo";

const payload = {
  slug: "acme",
  displayName: "Acme",
  vercelProjectId: "prj_1",
  customDomain: "acme.example.com",
  tier: "Text only",
  manifest: { slug: "acme", tier: "Text only", fields: [
    { id: "index__h1__1", page: "index.html", section: "Hero", label: "Hi", type: "text", value: "Hi", clientEditable: true },
  ] },
  pages: [{ path: "index.html", html: '<h1 data-edit="index__h1__1">Hi</h1>' }],
};

describe("ingest", () => {
  it("validates a good payload", () => {
    expect(IngestPayloadSchema.parse(payload).slug).toBe("acme");
  });

  it("persists client, manifest, and tagged pages; preserves existing overrides", async () => {
    const db = await makeTestDb();
    await repo.upsertClient(db, { slug: "acme", displayName: "Old", vercelProjectId: null, customDomain: null, tier: "Text only" });
    await repo.saveOverrides(db, "acme", "published", { "index__h1__1": "Live" });

    await ingest(db, payload);

    expect((await repo.getClient(db, "acme"))?.display_name).toBe("Acme");
    expect((await repo.getManifest(db, "acme"))?.fields).toHaveLength(1);
    expect(await repo.getTaggedPages(db, "acme")).toHaveLength(1);
    // re-push must NOT wipe existing published overrides
    expect(await repo.getOverrides(db, "acme", "published")).toEqual({ "index__h1__1": "Live" });
  });

  it("rejects a payload with a bad manifest", () => {
    expect(() => IngestPayloadSchema.parse({ ...payload, manifest: { nope: true } })).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd editor/app && npx vitest run test/ingest.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `editor/app/src/ingest.ts`**

```ts
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
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd editor/app && npx vitest run test/ingest.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the API route `editor/app/app/api/ingest/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../src/db";
import { ingest, IngestPayloadSchema } from "../../../src/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(req: NextRequest): boolean {
  const expected = process.env.OPERATOR_TOKEN;
  if (!expected) return false;
  const got = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  return got === expected;
}

export async function POST(req: NextRequest) {
  if (!process.env.OPERATOR_TOKEN) {
    return NextResponse.json({ error: "OPERATOR_TOKEN not configured" }, { status: 500 });
  }
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let parsed;
  try {
    parsed = IngestPayloadSchema.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ error: "Invalid payload", detail: String(e) }, { status: 400 });
  }
  await ingest(getDb(), parsed);
  return NextResponse.json({ ok: true, slug: parsed.slug, pages: parsed.pages.length });
}
```

- [ ] **Step 6: Typecheck + full suite**

Run: `cd editor/app && npm run typecheck && npx vitest run`
Expected: typecheck exits 0; all tests pass (db + repo + auth + ingest).

- [ ] **Step 7: Commit**

```bash
git add editor/app/src/ingest.ts editor/app/test/ingest.test.ts editor/app/app/api/ingest/route.ts
git commit -m "feat(editor-app): ingestion logic + operator-token API route"
```

---

### Task 5: Admin credentials + auth login/logout routes

**Files:** `editor/app/app/api/admin/credentials/route.ts`, `editor/app/app/api/auth/login/route.ts`, `editor/app/app/api/auth/logout/route.ts`, `editor/app/src/session-cookie.ts`, `editor/app/test/session-cookie.test.ts`

- [ ] **Step 1: Write the failing test** at `editor/app/test/session-cookie.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { SESSION_COOKIE, sessionCookieOptions } from "../src/session-cookie";

describe("session cookie", () => {
  it("uses a stable name and secure httpOnly options", () => {
    expect(SESSION_COOKIE).toBe("editor_session");
    const o = sessionCookieOptions(1000);
    expect(o.httpOnly).toBe(true);
    expect(o.sameSite).toBe("lax");
    expect(o.path).toBe("/");
    expect(o.maxAge).toBe(1000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd editor/app && npx vitest run test/session-cookie.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `editor/app/src/session-cookie.ts`**

```ts
export const SESSION_COOKIE = "editor_session";

export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true as const,
    secure: true as const,
    sameSite: "lax" as const,
    path: "/" as const,
    maxAge: maxAgeSeconds,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd editor/app && npx vitest run test/session-cookie.test.ts`
Expected: PASS.

- [ ] **Step 5: Write `editor/app/app/api/admin/credentials/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "../../../../src/db";
import { setCredential } from "../../../../src/repo";
import { hashPassword } from "../../../../src/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  username: z.string().min(1),
  slug: z.string().min(1),
  password: z.string().min(8),
});

export async function POST(req: NextRequest) {
  const expected = process.env.OPERATOR_TOKEN;
  if (!expected) return NextResponse.json({ error: "OPERATOR_TOKEN not configured" }, { status: 500 });
  const got = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (got !== expected) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body;
  try { body = Body.parse(await req.json()); }
  catch (e) { return NextResponse.json({ error: "Invalid", detail: String(e) }, { status: 400 }); }

  await setCredential(getDb(), {
    username: body.username, slug: body.slug, role: "client",
    passwordHash: await hashPassword(body.password),
  });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 6: Write `editor/app/app/api/auth/login/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "../../../../src/db";
import { login } from "../../../../src/auth";
import { SESSION_COOKIE, sessionCookieOptions } from "../../../../src/session-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ username: z.string().min(1), password: z.string().min(1) });

export async function POST(req: NextRequest) {
  let body;
  try { body = Body.parse(await req.json()); }
  catch { return NextResponse.json({ error: "Invalid" }, { status: 400 }); }

  const result = await login(getDb(), body.username, body.password);
  if (!result) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });

  const res = NextResponse.json({ ok: true, role: result.role, slug: result.slug });
  res.cookies.set(SESSION_COOKIE, result.sessionId, sessionCookieOptions(60 * 60 * 24 * 14));
  return res;
}
```

- [ ] **Step 7: Write `editor/app/app/api/auth/logout/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../src/db";
import { deleteSession } from "../../../../src/repo";
import { SESSION_COOKIE } from "../../../../src/session-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const id = req.cookies.get(SESSION_COOKIE)?.value;
  if (id) await deleteSession(getDb(), id);
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
```

- [ ] **Step 8: Typecheck + full suite**

Run: `cd editor/app && npm run typecheck && npx vitest run`
Expected: typecheck 0; all tests pass.

- [ ] **Step 9: Commit**

```bash
git add editor/app/src/session-cookie.ts editor/app/test/session-cookie.test.ts editor/app/app/api/admin/credentials/route.ts editor/app/app/api/auth/login/route.ts editor/app/app/api/auth/logout/route.ts
git commit -m "feat(editor-app): admin credential + login/logout routes"
```

---

### Task 6: Engine `push` payload builder + CLI command

**Files:** `editor/engine/src/push.ts`, `editor/engine/test/push.test.ts`, `editor/engine/src/cli.ts`, `editor/engine/src/index.ts`

Run from `editor/engine`.

- [ ] **Step 1: Write the failing test** at `editor/engine/test/push.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildPushPayload } from "../src/push";

describe("buildPushPayload", () => {
  let root: string;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), "push-")); });

  it("tags the site and assembles a payload with project info from the deploy manifest", () => {
    const siteDir = join(root, "clients", "acme", "site");
    mkdirSync(siteDir, { recursive: true });
    writeFileSync(join(siteDir, "index.html"),
      `<html><head><script>tailwind.config={theme:{extend:{colors:{primary:'#111111'}}}};</script></head>` +
      `<body><h1>Acme</h1></body></html>`, "utf8");
    const deployDir = join(root, "clients", "acme", "deploy");
    mkdirSync(deployDir, { recursive: true });
    writeFileSync(join(deployDir, "manifest.json"), JSON.stringify({
      slug: "acme", site: { vercel_project_id: "prj_X", preview_url: "https://acme.actiondesignstudio.com" },
    }), "utf8");

    const p = buildPushPayload({ slug: "acme", root, displayName: "Acme Co", tier: "Text only" });
    expect(p.slug).toBe("acme");
    expect(p.displayName).toBe("Acme Co");
    expect(p.vercelProjectId).toBe("prj_X");
    expect(p.customDomain).toBe("https://acme.actiondesignstudio.com");
    expect(p.manifest.fields.some((f) => f.type === "color")).toBe(true);
    expect(p.pages.find((pg) => pg.path === "index.html")?.html).toContain("data-edit");
    rmSync(root, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd editor/engine && npx vitest run test/push.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `editor/engine/src/push.ts`**

```ts
import { readFileSync, mkdtempSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { buildManifest } from "./manifest";
import type { Manifest, Tier } from "./types";

export interface PushPayload {
  slug: string;
  displayName: string;
  vercelProjectId: string | null;
  customDomain: string | null;
  tier: string;
  manifest: Manifest;
  pages: { path: string; html: string }[];
}

export interface BuildPushPayloadOptions {
  slug: string;
  root: string;          // repo root containing clients/{slug}
  displayName: string;
  tier?: Tier;
}

function readDeployInfo(root: string, slug: string): { projectId: string | null; domain: string | null } {
  try {
    const m = JSON.parse(readFileSync(join(root, "clients", slug, "deploy", "manifest.json"), "utf8"));
    return { projectId: m?.site?.vercel_project_id ?? null, domain: m?.site?.preview_url ?? null };
  } catch {
    return { projectId: null, domain: null };
  }
}

function readAllPages(dir: string, base = dir): { path: string; html: string }[] {
  const out: { path: string; html: string }[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...readAllPages(full, base));
    else if (entry.name.endsWith(".html")) out.push({ path: relative(base, full), html: readFileSync(full, "utf8") });
  }
  return out;
}

export function buildPushPayload(opts: BuildPushPayloadOptions): PushPayload {
  const tier: Tier = opts.tier ?? "Text only";
  const siteDir = join(opts.root, "clients", opts.slug, "site");
  if (!statSync(siteDir).isDirectory()) throw new Error(`No site dir at ${siteDir}`);

  const outDir = mkdtempSync(join(tmpdir(), `push-tagged-${opts.slug}-`));
  const manifest = buildManifest({ slug: opts.slug, siteDir, outDir, tier });
  const pages = readAllPages(outDir);
  const { projectId, domain } = readDeployInfo(opts.root, opts.slug);

  return {
    slug: opts.slug,
    displayName: opts.displayName,
    vercelProjectId: projectId,
    customDomain: domain,
    tier,
    manifest,
    pages,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd editor/engine && npx vitest run test/push.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the `push` command to `editor/engine/src/cli.ts`** (import + command before `program.parse();`):

```ts
import { buildPushPayload } from "./push";
```
```ts
program
  .command("push")
  .argument("<slug>", "client slug under clients/")
  .requiredOption("--endpoint <url>", "editor app base URL, e.g. https://editor.actiondesignstudio.com")
  .requiredOption("--token <token>", "operator token (matches OPERATOR_TOKEN on the app)")
  .option("--root <root>", "repo root", process.cwd())
  .option("--name <displayName>", "client display name")
  .option("--tier <tier>", "initial permission tier", "Text only")
  .action(async (slug, opts) => {
    const payload = buildPushPayload({
      slug, root: opts.root, displayName: opts.name ?? slug, tier: opts.tier,
    });
    const res = await fetch(`${opts.endpoint.replace(/\/$/, "")}/api/ingest`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${opts.token}` },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error(`Push failed: ${res.status} ${await res.text()}`);
      process.exitCode = 1;
      return;
    }
    console.log(`Pushed ${slug}: ${payload.pages.length} pages, ${payload.manifest.fields.length} fields.`);
  });
```

- [ ] **Step 6: Export push from `editor/engine/src/index.ts`** — add `export * from "./push";`.

- [ ] **Step 7: Typecheck + full engine suite**

Run: `cd editor/engine && npm run typecheck && npx vitest run`
Expected: typecheck 0; all tests pass (prior 39 + push 1 = 40).

- [ ] **Step 8: Commit**

```bash
git add editor/engine/src/push.ts editor/engine/test/push.test.ts editor/engine/src/cli.ts editor/engine/src/index.ts
git commit -m "feat(engine): push command builds payload and uploads to the editor app"
```

---

### Task 7: "Push to editor" button in the operator app

**Files:** `web/app/clients/page.tsx`, `web/app/api/push/[slug]/route.ts`

This runs locally (the route shells out to the engine, which needs local files). Verification is manual/integration since it spawns a process and hits the hosted app.

- [ ] **Step 1: Write the local API route `web/app/api/push/[slug]/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const run = promisify(execFile);

// Operator app is run locally; this route only works where the repo + engine exist.
export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const slug = params.slug;
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }
  const endpoint = process.env.EDITOR_APP_URL;
  const token = process.env.OPERATOR_TOKEN;
  if (!endpoint || !token) {
    return NextResponse.json({ error: "EDITOR_APP_URL / OPERATOR_TOKEN not set" }, { status: 500 });
  }
  const repoRoot = join(process.cwd(), "..");           // web/ lives under the repo root
  const engineCli = join(repoRoot, "editor", "engine", "src", "cli.ts");
  try {
    const { stdout } = await run(
      "npx",
      ["tsx", engineCli, "push", slug, "--root", repoRoot, "--endpoint", endpoint, "--token", token],
      { cwd: repoRoot, env: process.env }
    );
    return NextResponse.json({ ok: true, output: stdout.trim() });
  } catch (e: any) {
    return NextResponse.json({ error: "Push failed", detail: String(e?.stderr ?? e) }, { status: 500 });
  }
}
```

- [ ] **Step 2: Write the clients page `web/app/clients/page.tsx`**

```tsx
"use client";
import { useState } from "react";

export default function ClientsPage() {
  const [slug, setSlug] = useState("");
  const [status, setStatus] = useState<string>("");

  async function push() {
    setStatus("Pushing…");
    const res = await fetch(`/api/push/${slug}`, { method: "POST" });
    const json = await res.json();
    setStatus(res.ok ? `✓ ${json.output ?? "Pushed"}` : `✗ ${json.error}: ${json.detail ?? ""}`);
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Push a client to the editor</h1>
      <p>Run this app locally. Enter a client slug (a folder under <code>clients/</code>) and push its built site to the hosted editor.</p>
      <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="windrosemechanical"
        style={{ padding: 8, width: 320 }} />
      <button onClick={push} disabled={!slug} style={{ marginLeft: 8, padding: "8px 16px" }}>
        Push to editor
      </button>
      <pre style={{ marginTop: 16 }}>{status}</pre>
    </main>
  );
}
```

- [ ] **Step 3: Typecheck the web app**

Run: `cd web && npm run typecheck`
Expected: exits 0. (No new deps; uses built-in `child_process`.)

- [ ] **Step 4: Manual integration verification (documented, not automated)**

With the hosted app running (or `editor/app` on `npm run dev` with `POSTGRES_URL`, `OPERATOR_TOKEN` set) and `web/` env having `EDITOR_APP_URL` + `OPERATOR_TOKEN`:
```
cd web && npm run dev
# open http://localhost:3000/clients, enter "windrosemechanical", click Push to editor
```
Expected: status shows `✓ Pushed windrosemechanical: N pages, M fields.`; the app's `clients`, `manifests`, and `tagged_pages` tables now contain the client. Record the result in the commit message.

- [ ] **Step 5: Commit**

```bash
git add web/app/clients/page.tsx web/app/api/push/[slug]/route.ts
git commit -m "feat(web): Push to editor button + local push route"
```

---

### Task 8: Wire env + docs

**Files:** `.env.example`, `editor/app/README.md`

- [ ] **Step 1: Add the new env vars to `.env.example`** (append, with comments):

```
# Editor app (Plan 2b)
POSTGRES_URL=                  # Vercel Postgres / Neon connection string (editor app)
OPERATOR_TOKEN=                # shared secret: ingestion + admin routes; also set in web/ for the push button
EDITOR_APP_URL=                # e.g. https://editor.actiondesignstudio.com (used by web/ push route)
```

- [ ] **Step 2: Write `editor/app/README.md`**

```markdown
# Editor App (hosted)

Durable system of record for the client site editor (Plan 2b).

## Env
- `POSTGRES_URL` — Postgres connection string.
- `OPERATOR_TOKEN` — bearer token for `/api/ingest` and `/api/admin/credentials`.

## Schema
Apply `db/schema.sql` to the database once (e.g. `psql "$POSTGRES_URL" -f db/schema.sql`).

## Endpoints
- `POST /api/ingest` (operator token) — receive a pushed client.
- `POST /api/admin/credentials` (operator token) — set a client's password.
- `POST /api/auth/login` / `POST /api/auth/logout` — session cookie.

Publisher (preview/publish) and UIs are added in Plans 2c / 2d.
```

- [ ] **Step 3: Verify**

Run: `grep -q OPERATOR_TOKEN /Users/michaelpenner/code/design-studio/.env.example && echo "env documented"`
Expected: prints `env documented`.

- [ ] **Step 4: Commit**

```bash
git add .env.example editor/app/README.md
git commit -m "docs(editor-app): document env + endpoints"
```

---

## Self-Review

**1. Spec coverage (app spec §§2–7, Plan 2b scope):**
- Hosted app + Postgres source of truth (§2, §4) → Tasks 0–2. ✔
- Auth: operator + per-client, bcrypt + signed/server session, no enumeration (§6) → Tasks 3, 5. ✔
- Ingestion via push, operator-token, preserves overrides on re-push (§3, §8) → Tasks 4, 6. ✔
- "Push to editor" button local in `web/`, never in client HTML (§3) → Task 7. ✔
- Tagged HTML stored durably (§5; Blob deferred) → Tasks 1–2, 4. ✔
- Publisher / preview-publish, editor + admin UI, image upload → **Plans 2c / 2d** (explicitly out of scope). ✔

**2. Placeholder scan:** Every code/test step contains complete code. No TBDs, no stray tokens. ✔

**3. Type/name consistency:** `Queryable` is used identically across `db.ts`, `repo.ts`, `auth.ts`, `ingest.ts`, and the test helper. Repo function names (`upsertClient`, `getClient`, `saveManifest`, `getManifest`, `saveTaggedPages`, `getTaggedPages`, `saveOverrides`, `getOverrides`, `setCredential`, `findCredential`, `createSession`, `getSessionRow`, `deleteSession`) match between definition, tests, and route handlers. `IngestPayload`/`PushPayload` field names align (`slug`, `displayName`, `vercelProjectId`, `customDomain`, `tier`, `manifest`, `pages[{path,html}]`) between `push.ts` (producer) and `ingest.ts` (consumer). `SESSION_COOKIE`/`sessionCookieOptions` consistent across login/logout. ✔

**Test count note:** Engine goes 39 → 40 (push). Editor app adds db(1)+repo(4)+auth(2)+ingest(3)+session-cookie(1) = 11 tests. Adjust expected counts if the baseline shifts.

**Spike note:** This plan deliberately contains no Vercel-deploy code — that is Plan 2c, which must begin with a spike to confirm the Vercel REST Deployments API shape before the Publisher is implemented.
```
