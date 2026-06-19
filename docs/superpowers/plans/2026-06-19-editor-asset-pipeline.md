# Editor Asset Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make editor ingest and publish work for sites of any realistic size by moving asset bytes to Blob and deploying via Vercel's two-step SHA-upload flow, keeping each client site self-contained.

**Architecture:** Asset bytes live in Vercel Blob, not Postgres. `push` sends manifest+pages to `/api/ingest` and asset bytes to `/api/ingest/assets` in ≤3.5MB batches (→ Blob). Publish reads page HTML from Postgres + asset bytes from Blob, uploads every file to Vercel `POST /v2/files` (keyed by SHA1, deduped), then creates the deployment referencing files by `{file, sha, size}`. No request ever carries the whole site.

**Tech Stack:** TypeScript, Next.js 14 (App Router), Postgres (`pg`/`pg-mem`), `@vercel/blob`, Vercel REST API (`/v2/files`, `/v13/deployments`), node `crypto`, vitest (+ jsdom), the `@action-studio/editor-engine` package.

## Global Constraints

- **Self-contained hosting:** deployments go to each client's own Vercel project; assets are served from that deployment, not a CDN. Custom domains (e.g. `saskair.ca`) are attached manually in Vercel — out of scope.
- **Vercel `/v2/files` contract (confirmed against docs 2026-06-19):** `POST https://api.vercel.com/v2/files?teamId=<team>`, body = raw file bytes, headers `Authorization: Bearer <VERCEL_TOKEN>`, `Content-Type: application/octet-stream`, `x-vercel-digest: <sha1-hex>` (≤40 chars), `Content-Length: <size>`. Success = 200 (body empty or `{urls}`). Then `POST /v13/deployments` with `files: [{ file, sha, size }]`.
- **Batch limit:** `MAX_ASSET_BATCH_BYTES = 3_500_000` (base64 length), to stay under Vercel's ~4.5MB inbound body cap after JSON overhead.
- **Asset Blob keys:** `clients/{slug}/assets/{sanitized-path}`, `access: "public"`.
- **`assets` table shape:** `(slug TEXT, path TEXT, blob_url TEXT, size INTEGER, PRIMARY KEY (slug, path))` — base64 column removed.
- **Tests:** engine via `npm test` in `editor/engine`; app via `npm test` in `editor/app`. New backend logic lives in `editor/app/src/*` and is unit-tested there; routes stay thin.
- **Run engine commands from `editor/engine`; app commands from `editor/app`.**

---

### Task 1: `vercel.ts` — SHA-upload deploy flow

**Files:**
- Modify: `editor/app/src/vercel.ts`
- Modify: `editor/app/test/vercel.test.ts`

**Interfaces:**
- Produces: `sha1(bytes: Buffer): string` (hex). `deployFiles(input: { projectId: string; projectName: string; target?: "production"; files: { path: string; bytes: Buffer }[] }): Promise<{ id: string; url: string }>` — uploads each file via `POST /v2/files` then creates the deployment by SHA. `getDeploymentState` unchanged.

- [ ] **Step 1: Read the current file + test** to preserve the deployment-body shape (`name`, `project`, `target`, `projectSettings`) and the `url` normalization. Note the existing `test/vercel.test.ts` asserts the old inlined-files body — those assertions will be replaced.

- [ ] **Step 2: Write the failing test** — replace `editor/app/test/vercel.test.ts` with:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { sha1, deployFiles } from "../src/vercel";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("sha1", () => {
  it("matches known vectors", () => {
    expect(sha1(Buffer.from(""))).toBe("da39a3ee5e6b4b0d3255bfef95601890afd80709");
    expect(sha1(Buffer.from("abc"))).toBe("a9993e364706816aba3e25717850c26c9cd0d89d");
  });
});

describe("deployFiles (SHA upload)", () => {
  it("uploads each file to /v2/files then creates a deployment referencing shas", async () => {
    vi.stubEnv("VERCEL_TOKEN", "tok");
    vi.stubEnv("VERCEL_TEAM_ID", "team_1");
    const calls: any[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: any) => {
      calls.push({ url, init });
      if (url.includes("/v2/files")) return { ok: true, status: 200, json: async () => ({}) } as any;
      return { ok: true, status: 200, json: async () => ({ id: "dpl_1", url: "x.vercel.app" }) } as any;
    }));

    const r = await deployFiles({
      projectId: "prj_1", projectName: "acme-site", target: "production",
      files: [
        { path: "index.html", bytes: Buffer.from("abc") },
        { path: "assets/logo.webp", bytes: Buffer.from("logo-bytes") },
      ],
    });
    expect(r).toEqual({ id: "dpl_1", url: "https://x.vercel.app" });

    const uploads = calls.filter((c) => c.url.includes("/v2/files"));
    expect(uploads).toHaveLength(2);
    expect(uploads[0].url).toContain("teamId=team_1");
    expect(uploads[0].init.headers["x-vercel-digest"]).toBe("a9993e364706816aba3e25717850c26c9cd0d89d");
    expect(uploads[0].init.method).toBe("POST");

    const deploy = calls.find((c) => c.url.includes("/v13/deployments"));
    const body = JSON.parse(deploy.init.body);
    expect(body.project).toBe("prj_1");
    expect(body.target).toBe("production");
    expect(body.files).toEqual([
      { file: "index.html", sha: "a9993e364706816aba3e25717850c26c9cd0d89d", size: 3 },
      { file: "assets/logo.webp", sha: sha1(Buffer.from("logo-bytes")), size: Buffer.from("logo-bytes").length },
    ]);
  });

  it("retries a file upload once on 5xx then fails", async () => {
    vi.stubEnv("VERCEL_TOKEN", "tok");
    let n = 0;
    vi.stubGlobal("fetch", vi.fn(async () => { n++; return { ok: false, status: 500, text: async () => "boom" } as any; }));
    await expect(deployFiles({ projectId: "p", projectName: "s", files: [{ path: "a", bytes: Buffer.from("x") }] }))
      .rejects.toThrow(/file upload failed/i);
    expect(n).toBe(2); // initial + one retry
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd editor/app && npx vitest run test/vercel.test.ts`
Expected: FAIL — `sha1` not exported / `deployFiles` signature mismatch.

- [ ] **Step 4: Rewrite `editor/app/src/vercel.ts`:**

```ts
import { createHash } from "node:crypto";

const API = "https://api.vercel.com";

export interface DeployFile { path: string; bytes: Buffer; }
export interface DeployInput {
  projectId: string;
  projectName: string;
  target?: "production";
  files: DeployFile[];
}
export interface DeployResult { id: string; url: string; }

export function sha1(bytes: Buffer): string {
  return createHash("sha1").update(bytes).digest("hex");
}

async function uploadFile(bytes: Buffer, sha: string): Promise<void> {
  const token = process.env.VERCEL_TOKEN;
  if (!token) throw new Error("VERCEL_TOKEN not set");
  const team = process.env.VERCEL_TEAM_ID;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`${API}/v2/files${team ? `?teamId=${team}` : ""}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/octet-stream",
        "x-vercel-digest": sha,
        "content-length": String(bytes.length),
      },
      body: bytes,
    });
    if (res.ok) return;
    if (res.status >= 500 && attempt === 0) continue;
    throw new Error(`Vercel file upload failed: ${res.status} ${await res.text()}`);
  }
}

export async function deployFiles(input: DeployInput): Promise<DeployResult> {
  const token = process.env.VERCEL_TOKEN;
  if (!token) throw new Error("VERCEL_TOKEN not set");
  const team = process.env.VERCEL_TEAM_ID;

  const fileRefs: { file: string; sha: string; size: number }[] = [];
  for (const f of input.files) {
    const sha = sha1(f.bytes);
    await uploadFile(f.bytes, sha);
    fileRefs.push({ file: f.path, sha, size: f.bytes.length });
  }

  const body = {
    name: input.projectName,
    project: input.projectId,
    target: input.target,
    files: fileRefs,
    projectSettings: { framework: null },
  };
  const res = await fetch(`${API}/v13/deployments${team ? `?teamId=${team}` : ""}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Vercel deploy failed: ${res.status} ${await res.text()}`);
  const j = await res.json();
  return { id: j.id, url: j.url.startsWith("http") ? j.url : `https://${j.url}` };
}

export async function getDeploymentState(id: string): Promise<string> {
  const token = process.env.VERCEL_TOKEN;
  if (!token) throw new Error("VERCEL_TOKEN not set");
  const team = process.env.VERCEL_TEAM_ID;
  const res = await fetch(`${API}/v13/deployments/${id}${team ? `?teamId=${team}` : ""}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Vercel state failed: ${res.status}`);
  const j = await res.json();
  return j.readyState ?? j.status ?? "UNKNOWN";
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd editor/app && npx vitest run test/vercel.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add editor/app/src/vercel.ts editor/app/test/vercel.test.ts
git commit -m "feat(editor-app): vercel SHA-upload deploy flow (removes 4.5MB deploy cap)"
```

---

### Task 2: `assets` schema + repo (Blob refs, not base64)

**Files:**
- Modify: `editor/app/db/schema.sql`
- Modify: `editor/app/src/repo.ts`
- Modify: `editor/app/test/repo.test.ts`
- Modify: `editor/app/test/assets-lock.test.ts` (if it references the old asset shape)

**Interfaces:**
- Produces: `AssetRow { path: string; blob_url: string; size: number }`. `saveAssets(db, slug, assets: { path: string; blobUrl: string; size: number }[]): Promise<void>` (replace-all). `upsertAsset(db, slug, a: { path: string; blobUrl: string; size: number }): Promise<void>`. `getAssets(db, slug): Promise<AssetRow[]>`.

- [ ] **Step 1: Update the schema** — in `editor/app/db/schema.sql`, replace the `assets` table definition:

```sql
CREATE TABLE IF NOT EXISTS assets (
  slug     TEXT NOT NULL,
  path     TEXT NOT NULL,
  blob_url TEXT NOT NULL,
  size     INTEGER NOT NULL,
  PRIMARY KEY (slug, path)
);
```

- [ ] **Step 2: Write the failing test** — replace the asset round-trip test in `editor/app/test/repo.test.ts` (find the existing `saveAssets`/`getAssets` test; if none, add this) with:

```ts
  it("saves, upserts, and reads assets as blob refs", async () => {
    const db = await makeTestDb();
    await repo.saveAssets(db, "acme", [
      { path: "assets/a.webp", blobUrl: "https://blob/a", size: 10 },
      { path: "assets/b.webp", blobUrl: "https://blob/b", size: 20 },
    ]);
    expect(await repo.getAssets(db, "acme")).toEqual([
      { path: "assets/a.webp", blob_url: "https://blob/a", size: 10 },
      { path: "assets/b.webp", blob_url: "https://blob/b", size: 20 },
    ]);
    await repo.upsertAsset(db, "acme", { path: "assets/a.webp", blobUrl: "https://blob/a2", size: 11 });
    const rows = await repo.getAssets(db, "acme");
    expect(rows.find((r) => r.path === "assets/a.webp")).toEqual({ path: "assets/a.webp", blob_url: "https://blob/a2", size: 11 });
  });
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd editor/app && npx vitest run test/repo.test.ts`
Expected: FAIL — `upsertAsset` undefined / shape mismatch.

- [ ] **Step 4: Update `editor/app/src/repo.ts`** — replace the `AssetRow` interface and `saveAssets`/`getAssets`, and add `upsertAsset`:

```ts
export interface AssetRow { path: string; blob_url: string; size: number; }

export async function saveAssets(db: Queryable, slug: string, assets: { path: string; blobUrl: string; size: number }[]): Promise<void> {
  await db.query(`DELETE FROM assets WHERE slug=$1`, [slug]);
  for (const a of assets) {
    await db.query(`INSERT INTO assets (slug, path, blob_url, size) VALUES ($1,$2,$3,$4)`, [slug, a.path, a.blobUrl, a.size]);
  }
}

export async function upsertAsset(db: Queryable, slug: string, a: { path: string; blobUrl: string; size: number }): Promise<void> {
  await db.query(
    `INSERT INTO assets (slug, path, blob_url, size) VALUES ($1,$2,$3,$4)
     ON CONFLICT (slug, path) DO UPDATE SET blob_url=EXCLUDED.blob_url, size=EXCLUDED.size`,
    [slug, a.path, a.blobUrl, a.size]
  );
}

export async function getAssets(db: Queryable, slug: string): Promise<AssetRow[]> {
  const { rows } = await db.query(`SELECT path, blob_url, size FROM assets WHERE slug=$1 ORDER BY path`, [slug]);
  return rows.map((r) => ({ path: r.path, blob_url: r.blob_url, size: r.size }));
}
```

- [ ] **Step 5: Fix any other test that seeds assets with the old shape** — run the full suite to find breakages:

Run: `cd editor/app && npm test`
Expected: failures only in tests that call `saveAssets` with `{ path, base64 }` (e.g. `test/assets-lock.test.ts`). For each, change the seed to `{ path, blobUrl: "https://blob/x", size: N }` and update any assertion that read `base64`. (Do NOT touch `publisher.test.ts` yet — Task 5 owns it; if it fails here on the asset shape, leave it failing and note it; it will be rewritten in Task 5.)

- [ ] **Step 6: Run the suite** (publisher.test may be red until Task 5)

Run: `cd editor/app && npx vitest run test/repo.test.ts test/assets-lock.test.ts`
Expected: PASS for these two.

- [ ] **Step 7: Commit**

```bash
git add editor/app/db/schema.sql editor/app/src/repo.ts editor/app/test/repo.test.ts editor/app/test/assets-lock.test.ts
git commit -m "feat(editor-app): assets table stores blob refs (blob_url+size), not base64"
```

---

### Task 3: ingest split — drop assets from `/api/ingest`, add `/api/ingest/assets`

**Files:**
- Modify: `editor/app/src/ingest.ts`
- Create: `editor/app/src/ingest-assets.ts`
- Create test: `editor/app/test/ingest-assets.test.ts`
- Modify test: `editor/app/test/ingest.test.ts`
- Modify: `editor/app/app/api/ingest/route.ts` (only if it references the removed `assets` field)
- Create: `editor/app/app/api/ingest/assets/route.ts`

**Interfaces:**
- Consumes: `repo.upsertAsset` (Task 2).
- Produces: `assetBlobKey(slug, path): string`. `ingestAssets(db, put, slug, assets: { path: string; base64: string }[]): Promise<number>` where `put: (key: string, bytes: Buffer) => Promise<{ url: string }>`. `/api/ingest/assets` route (operator-token gated).

- [ ] **Step 1: Write the failing test** — create `editor/app/test/ingest-assets.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { makeTestDb } from "./helpers/pgmem";
import * as repo from "../src/repo";
import { assetBlobKey, ingestAssets } from "../src/ingest-assets";

describe("assetBlobKey", () => {
  it("namespaces by slug under assets/ and sanitizes", () => {
    expect(assetBlobKey("acme", "assets/logo.webp")).toBe("clients/acme/assets/assets/logo.webp");
    expect(assetBlobKey("acme", "weird path!.png")).toBe("clients/acme/assets/weird_path_.png");
  });
});

describe("ingestAssets", () => {
  it("puts each asset to blob and upserts a ref with size", async () => {
    const db = await makeTestDb();
    await repo.upsertClient(db, { slug: "acme", displayName: "Acme", vercelProjectId: null, customDomain: null, tier: "Everything" });
    const put = vi.fn(async (key: string) => ({ url: `https://blob/${key}` }));
    const n = await ingestAssets(db, put, "acme", [
      { path: "assets/a.webp", base64: Buffer.from("aaaa").toString("base64") },
      { path: "assets/b.webp", base64: Buffer.from("bb").toString("base64") },
    ]);
    expect(n).toBe(2);
    expect(put).toHaveBeenCalledTimes(2);
    const rows = await repo.getAssets(db, "acme");
    expect(rows).toEqual([
      { path: "assets/a.webp", blob_url: "https://blob/clients/acme/assets/assets/a.webp", size: 4 },
      { path: "assets/b.webp", blob_url: "https://blob/clients/acme/assets/assets/b.webp", size: 2 },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd editor/app && npx vitest run test/ingest-assets.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `editor/app/src/ingest-assets.ts`:**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd editor/app && npx vitest run test/ingest-assets.test.ts`
Expected: PASS.

- [ ] **Step 5: Drop `assets` from the main ingest** — in `editor/app/src/ingest.ts`, remove the `assets` field from `IngestPayloadSchema` and remove the `repo.saveAssets(...)` call from `ingest()`. The function now persists client + manifest + pages only. Update `editor/app/test/ingest.test.ts`: remove any `assets` from the payload it builds and drop assertions about persisted assets (assets are covered by `ingest-assets.test.ts`).

- [ ] **Step 6: Create the assets route** — `editor/app/app/api/ingest/assets/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { put } from "@vercel/blob";
import { getDb } from "../../../../src/db";
import { ingestAssets } from "../../../../src/ingest-assets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  slug: z.string().min(1),
  assets: z.array(z.object({ path: z.string().min(1), base64: z.string() })),
});

function authorized(req: NextRequest): boolean {
  const expected = process.env.OPERATOR_TOKEN;
  if (!expected) return false;
  const got = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  return got === expected;
}

export async function POST(req: NextRequest) {
  if (!process.env.OPERATOR_TOKEN) return NextResponse.json({ error: "OPERATOR_TOKEN not configured" }, { status: 500 });
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body;
  try { body = Body.parse(await req.json()); }
  catch (e) { return NextResponse.json({ error: "Invalid payload", detail: String(e) }, { status: 400 }); }

  const blobPut = async (key: string, bytes: Buffer) => {
    const r = await put(key, bytes, { access: "public", addRandomSuffix: false });
    return { url: r.url };
  };
  const count = await ingestAssets(getDb(), blobPut, body.slug, body.assets);
  return NextResponse.json({ ok: true, count });
}
```

- [ ] **Step 7: Run the affected suites**

Run: `cd editor/app && npx vitest run test/ingest-assets.test.ts test/ingest.test.ts && npm run typecheck`
Expected: PASS; 0 type errors.

- [ ] **Step 8: Commit**

```bash
git add editor/app/src/ingest.ts editor/app/src/ingest-assets.ts editor/app/test/ingest-assets.test.ts editor/app/test/ingest.test.ts editor/app/app/api/ingest
git commit -m "feat(editor-app): split ingest — assets go to Blob via /api/ingest/assets"
```

---

### Task 4: engine `push` — asset batching

**Files:**
- Modify: `editor/engine/src/push.ts`
- Modify: `editor/engine/src/cli.ts`
- Modify: `editor/engine/test/push.test.ts`

**Interfaces:**
- Produces: `batchAssets(assets: { path: string; base64: string }[], maxBytes: number): { path: string; base64: string }[][]`. `buildPushPayload(...)` now returns `{ slug, displayName, vercelProjectId, customDomain, tier, manifest, pages, assets: { path: string; base64: string }[] }` (assets carried separately, not inside the main ingest body).

- [ ] **Step 1: Read** `editor/engine/src/push.ts` and `editor/engine/test/push.test.ts` to preserve `buildPushPayload`'s existing reads (pages, manifest, deploy info). The only change: assets stay a separate `{path, base64}[]` and a new `batchAssets` helper is added.

- [ ] **Step 2: Write the failing test** — add to `editor/engine/test/push.test.ts`:

```ts
import { batchAssets } from "../src/push";

describe("batchAssets", () => {
  it("groups assets so each batch's base64 size stays under the limit", () => {
    const a = (p: string, n: number) => ({ path: p, base64: "x".repeat(n) });
    const batches = batchAssets([a("1", 3), a("2", 3), a("3", 3)], 7);
    expect(batches.map((b) => b.map((x) => x.path))).toEqual([["1", "2"], ["3"]]);
  });
  it("puts a single oversized asset in its own batch", () => {
    const batches = batchAssets([{ path: "big", base64: "x".repeat(100) }], 10);
    expect(batches).toEqual([[{ path: "big", base64: "x".repeat(100) }]]);
  });
  it("returns no batches for no assets", () => {
    expect(batchAssets([], 10)).toEqual([]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd editor/engine && npx vitest run test/push.test.ts`
Expected: FAIL — `batchAssets` not exported.

- [ ] **Step 4: Add `batchAssets` to `editor/engine/src/push.ts`** (keep `buildPushPayload`'s asset reading as `{path, base64}`; it already builds `assets`):

```ts
export function batchAssets(
  assets: { path: string; base64: string }[], maxBytes: number
): { path: string; base64: string }[][] {
  const batches: { path: string; base64: string }[][] = [];
  let cur: { path: string; base64: string }[] = [];
  let curSize = 0;
  for (const a of assets) {
    const sz = a.base64.length;
    if (cur.length && curSize + sz > maxBytes) { batches.push(cur); cur = []; curSize = 0; }
    cur.push(a);
    curSize += sz;
  }
  if (cur.length) batches.push(cur);
  return batches;
}
```

Confirm `buildPushPayload` returns `assets` as `{ path, base64 }[]` (it already reads assets this way via `readAssets`). No change needed to its body beyond ensuring `assets` is in the returned object.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd editor/engine && npx vitest run test/push.test.ts`
Expected: PASS.

- [ ] **Step 6: Update the CLI push action** — in `editor/engine/src/cli.ts`, change the `push` action so the main ingest POST omits assets, then posts asset batches:

```ts
    const payload = buildPushPayload({
      slug, root: opts.root, displayName: opts.name ?? slug, tier: validateTier(opts.tier),
    });
    const base = opts.endpoint.replace(/\/$/, "");
    const headers = { "content-type": "application/json", authorization: `Bearer ${token}` };

    const ingestRes = await fetch(`${base}/api/ingest`, {
      method: "POST", headers,
      body: JSON.stringify({
        slug: payload.slug, displayName: payload.displayName,
        vercelProjectId: payload.vercelProjectId, customDomain: payload.customDomain,
        tier: payload.tier, manifest: payload.manifest, pages: payload.pages,
      }),
    });
    if (!ingestRes.ok) { console.error(`Push failed: ${ingestRes.status} ${await ingestRes.text()}`); process.exitCode = 1; return; }

    const MAX_ASSET_BATCH_BYTES = 3_500_000;
    const batches = batchAssets(payload.assets, MAX_ASSET_BATCH_BYTES);
    for (let i = 0; i < batches.length; i++) {
      const res = await fetch(`${base}/api/ingest/assets`, {
        method: "POST", headers, body: JSON.stringify({ slug: payload.slug, assets: batches[i] }),
      });
      if (!res.ok) { console.error(`Asset batch ${i + 1}/${batches.length} failed: ${res.status} ${await res.text()}`); process.exitCode = 1; return; }
    }
    console.log(`Pushed ${payload.slug}: ${payload.pages.length} pages, ${payload.manifest.fields.length} fields, ${payload.assets.length} assets in ${batches.length} batch(es).`);
```

Add `batchAssets` to the import from `./push`.

- [ ] **Step 7: Run engine suite + typecheck**

Run: `cd editor/engine && npm run typecheck && npm test`
Expected: 0 type errors; all PASS.

- [ ] **Step 8: Commit**

```bash
git add editor/engine/src/push.ts editor/engine/src/cli.ts editor/engine/test/push.test.ts
git commit -m "feat(engine): push assets to /api/ingest/assets in size-bounded batches"
```

---

### Task 5: `publisher.ts` — source assets from Blob, deploy via SHA flow

**Files:**
- Modify: `editor/app/src/publisher.ts`
- Modify: `editor/app/test/publisher.test.ts`
- Modify: `editor/app/app/api/publish/route.ts` (add `maxDuration`)

**Interfaces:**
- Consumes: new `deployFiles({ files: { path, bytes }[] })` (Task 1), `repo.getAssets` returning `{ path, blob_url, size }` (Task 2).

- [ ] **Step 1: Read** `editor/app/src/publisher.ts` and `editor/app/test/publisher.test.ts`. The publisher test mocks `../src/vercel` (`deployFiles`, `getDeploymentState`) and seeds `saveAssets`. It currently asserts `call.files.find(...).content` and `call.assets`. These change: files now carry `bytes`, assets are folded into `files`, and asset bytes come from `fetch(blob_url)`.

- [ ] **Step 2: Write the failing test** — replace `editor/app/test/publisher.test.ts`'s `seed` helper and the two content-asserting tests so assets are blob refs and deploy receives `files` with bytes:

```ts
// at top, after the vercel mock, add a fetch stub for blob downloads:
import { afterEach } from "vitest";
afterEach(() => { vi.unstubAllGlobals(); });

async function seed(db: any) {
  await repo.upsertClient(db, { slug: "acme", displayName: "Acme", vercelProjectId: "prj_1", customDomain: "https://acme.example.com", tier: "Text only" });
  await repo.saveTaggedPages(db, "acme", [{ path: "index.html", html: '<html><body><h1 data-edit="index__h1__1">Old</h1></body></html>' }]);
  await repo.saveAssets(db, "acme", [{ path: "assets/logo.png", blobUrl: "https://blob/acme/logo.png", size: 3 }]);
}

// In each test that calls publish(), stub global fetch so blob downloads return bytes:
vi.stubGlobal("fetch", vi.fn(async (url: string) => ({
  ok: true, arrayBuffer: async () => new Uint8Array([65, 65, 65]).buffer,  // "AAA"
} as any)));
```

Update the "preview merges DRAFT overrides" assertions:

```ts
    const call = (deployFiles as any).mock.calls.at(-1)[0];
    expect(call.target).toBeUndefined();
    const idx = call.files.find((f: any) => f.path === "index.html");
    expect(idx.bytes.toString("utf8")).toContain(">Draft Title<");
    const logo = call.files.find((f: any) => f.path === "assets/logo.png");
    expect(logo.bytes.toString("utf8")).toBe("AAA");
```

Keep the production-target test (assert `call.target === "production"` and `call.projectId === "prj_1"`), the ERROR-state test, and the no-project-id test as-is. Remove the old `call.assets` assertion. (The embed-injection tests from the prior plan still apply — update their assertion to read `call.files.find(p => p.path==="index.html").bytes.toString("utf8")` instead of `.content`.)

- [ ] **Step 3: Run test to verify it fails**

Run: `cd editor/app && npx vitest run test/publisher.test.ts`
Expected: FAIL — publisher still passes `assets` / `content`.

- [ ] **Step 4: Update `editor/app/src/publisher.ts`** — replace the deploy assembly (the block from `const assets = await repo.getAssets(...)` through the `deployFiles({...})` call):

```ts
    const taggedPages = await repo.getTaggedPages(db, slug);
    const assetRows = await repo.getAssets(db, slug);

    const merged = mergePages(taggedPages.map((p) => ({ path: p.path, html: p.html })), overrides);

    const editorUrl = process.env.EDITOR_PUBLIC_URL;
    const pages = editorUrl
      ? merged.pages.map((p) => ({ path: p.path, html: injectEditorEmbed(p.html, { editorUrl, slug }) }))
      : merged.pages;

    const pageFiles = pages.map((p) => ({ path: p.path, bytes: Buffer.from(p.html, "utf8") }));
    const assetFiles = await Promise.all(
      assetRows.map(async (a) => {
        const res = await fetch(a.blob_url);
        if (!res.ok) throw new Error(`asset unavailable: ${a.path} (${res.status})`);
        return { path: a.path, bytes: Buffer.from(await res.arrayBuffer()) };
      })
    );

    const result = await deployFiles({
      projectId: client.vercel_project_id,
      projectName: `${slug}-site`,
      target: mode === "publish" ? "production" : undefined,
      files: [...pageFiles, ...assetFiles],
    });
```

- [ ] **Step 5: Add `maxDuration` to the publish route** — in `editor/app/app/api/publish/route.ts`, add near the other route config exports:

```ts
export const maxDuration = 300;
```

- [ ] **Step 6: Run test to verify it passes + full suite + typecheck**

Run: `cd editor/app && npx vitest run test/publisher.test.ts`
Expected: PASS.
Run: `cd editor/app && npm run typecheck && npm test`
Expected: 0 type errors; ALL tests green (this is the task that re-greens the suite after Task 2's deferred publisher breakage).

- [ ] **Step 7: Commit**

```bash
git add editor/app/src/publisher.ts editor/app/test/publisher.test.ts editor/app/app/api/publish/route.ts
git commit -m "feat(editor-app): publisher sources assets from Blob, deploys via SHA flow"
```

---

### Task 6: onboarding wrapper + docs

**Files:**
- Create: `scripts/onboard-editor-client.sh`
- Modify: `editor/app/README.md`

**Interfaces:** none (operator tooling + docs).

- [ ] **Step 1: Create `scripts/onboard-editor-client.sh`** (repo root):

```bash
#!/usr/bin/env bash
set -euo pipefail
# Onboard a built factory client into the editor end-to-end.
# Usage: OPERATOR_TOKEN=… POSTGRES_URL=… VERCEL_TOKEN=… VERCEL_TEAM_ID=… EDITOR_BASE=… \
#        scripts/onboard-editor-client.sh <slug> "<Display Name>" [tier]
SLUG="${1:?slug required}"; NAME="${2:?display name required}"; TIER="${3:-Everything}"
: "${OPERATOR_TOKEN:?}"; : "${POSTGRES_URL:?}"; : "${VERCEL_TOKEN:?}"; : "${VERCEL_TEAM_ID:?}"; : "${EDITOR_BASE:?}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "1/5 push (tag + ingest pages/assets)…"
( cd "$ROOT/editor/engine" && npx tsx src/cli.ts push "$SLUG" --endpoint "$EDITOR_BASE" --token "$OPERATOR_TOKEN" --root "$ROOT" --name "$NAME" --tier "$TIER" )

PROJECT_ID="$(node -e "console.log(require('$ROOT/clients/$SLUG/site/.vercel/project.json').projectId)")"
PROJECT_NAME="$(node -e "console.log(require('$ROOT/clients/$SLUG/site/.vercel/project.json').projectName)")"
ORIGIN="https://$PROJECT_NAME.vercel.app"

echo "2/5 set project id + origin in DB…"
( cd "$ROOT/editor/app" && node -e "const{Pool}=require('pg');(async()=>{const p=new Pool({connectionString:process.env.POSTGRES_URL});await p.query('UPDATE clients SET vercel_project_id=\$2, custom_domain=\$3 WHERE slug=\$1',['$SLUG','$PROJECT_ID','$ORIGIN']);await p.end()})()" )

echo "3/5 set client password…"
CPW="$(node -e "const c=require('crypto');const w=['River','Cedar','Slate','Birch','Onyx','Pine'];console.log(w[c.randomInt(w.length)]+'-'+w[c.randomInt(w.length)]+'-'+c.randomInt(1000,9999))")"
curl -fsS -X POST "$EDITOR_BASE/api/admin/credentials" -H "authorization: Bearer $OPERATOR_TOKEN" -H 'content-type: application/json' \
  -d "{\"username\":\"$SLUG\",\"slug\":\"$SLUG\",\"password\":\"$CPW\"}" >/dev/null

echo "4/5 disable Vercel deployment protection on $PROJECT_NAME…"
curl -fsS -X PATCH "https://api.vercel.com/v9/projects/$PROJECT_NAME?teamId=$VERCEL_TEAM_ID" \
  -H "authorization: Bearer $VERCEL_TOKEN" -H 'content-type: application/json' -d '{"ssoProtection":null}' >/dev/null

echo "5/5 publish (re-deploy with loader)…"
OP_TOKEN_SESSION="$(curl -fsS -X POST "$EDITOR_BASE/api/auth/login" -H 'content-type: application/json' \
  -d "{\"username\":\"${OPERATOR_USERNAME:-michael}\",\"password\":\"${OPERATOR_PASSWORD:?set OPERATOR_PASSWORD}\"}" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>process.stdout.write(JSON.parse(d).token))")"
curl -fsS -X POST "$EDITOR_BASE/api/publish" -H "authorization: Bearer $OP_TOKEN_SESSION" -H 'content-type: application/json' -d "{\"slug\":\"$SLUG\"}" >/dev/null

echo ""
echo "DONE. Invite:"
echo "  Edit link: $ORIGIN/?edit"
echo "  Username:  $SLUG"
echo "  Password:  $CPW"
```

- [ ] **Step 2: Make it executable + document** — `chmod +x scripts/onboard-editor-client.sh`, and append to `editor/app/README.md` a short "Onboarding a client" section showing the env vars and the one-line invocation, noting that custom domains are attached manually in Vercel afterward.

- [ ] **Step 3: Verify the script parses** (no client onboarded here — that's rollout):

Run: `bash -n scripts/onboard-editor-client.sh && echo "syntax ok"`
Expected: `syntax ok`.

- [ ] **Step 4: Commit**

```bash
git add scripts/onboard-editor-client.sh editor/app/README.md
git commit -m "chore(editor): one-command client onboarding wrapper + docs"
```

---

## Self-Review

**Spec coverage:**
- SHA-upload deploy (removes deploy cap) → Task 1. ✔
- Assets in Blob, not Postgres (schema + repo) → Task 2. ✔
- Ingest split (`/api/ingest` minus assets, `/api/ingest/assets` to Blob) → Task 3. ✔
- Engine batching (≤3.5MB) → Task 4. ✔
- Publisher sources from Blob + new deploy + `maxDuration` → Task 5. ✔
- Onboarding wrapper → Task 6. ✔
- Migration (capstone re-ingest) → Rollout (controller-executed, below). ✔

**Placeholder scan:** No TBD/TODO; every code step carries complete code; commands have expected output. ✔

**Type/name consistency:** `deployFiles({ files: { path, bytes }[] })` consistent across vercel.ts, its test, and publisher.ts. `saveAssets`/`upsertAsset` take `{ path, blobUrl, size }`; `getAssets`/`AssetRow` return `{ path, blob_url, size }` — consistent across repo, ingest-assets, publisher. `batchAssets(assets, maxBytes)` and `buildPushPayload(...).assets: {path, base64}[]` consistent across engine + cli. `ingestAssets(db, put, slug, assets)` matches the route and its test. ✔

**Cross-task ordering note:** Task 2 changes `saveAssets`, which makes `publisher.test.ts` red until Task 5 rewrites it. This is called out explicitly in Task 2 Step 5 and Task 5 Step 6 (the suite goes fully green at the end of Task 5). Run tasks in order.

## Rollout (controller-executed after all tasks pass)

1. `ALTER` the live Supabase `assets` table to the new shape (drop `base64`, add `blob_url TEXT`, `size INTEGER`) — or `DROP TABLE assets` then re-apply `schema.sql` (capstone is the only client with assets; it will be re-ingested).
2. Prebuilt-deploy the editor app (`vercel build --prod && vercel deploy --prebuilt --prod`).
3. Re-ingest capstone via the onboarding wrapper (or just `push`), verify a capstone publish still works and images load.
4. Onboard saskair via the wrapper; verify `?edit` login, an image swap, Preview, and Publish on the live `saskair-site.vercel.app`.
```
