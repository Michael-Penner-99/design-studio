# Editor Asset Pipeline — Design Spec

**Date:** 2026-06-19
**Status:** Approved (brainstorming) — ready for implementation plan
**Author:** Action Studio

---

## Problem

The editor cannot onboard or publish real-sized client sites. Both the **ingest** path (engine `push` → `POST /api/ingest`) and the **deploy** path ([`vercel.ts` `deployFiles`](../../editor/app/src/vercel.ts)) inline *every file and image as base64 in a single HTTP request*. Vercel caps request bodies at ~4.5MB. Sask Air Solutions has **9.1MB of image assets** (a project photo gallery), which base64-encodes to ~12MB — so `push` fails with `FUNCTION_PAYLOAD_TOO_LARGE`, and even if it didn't, publish would fail the same way. Capstone only worked because it is tiny (6 small assets). Assets are also stored as base64 in Postgres, which bloats Supabase as clients are added.

## Goal

Make ingest and publish work for sites of any realistic size, keeping each client site **self-contained** (served from its own Vercel project / domain), and keeping Supabase lean (asset *bytes* live in Blob, not Postgres). After this lands, onboarding any built client is a repeatable, size-independent operation.

## Non-goals

- **No CDN/shared asset hosting.** Assets stay on each client's own Vercel deployment (decided: self-contained).
- **No custom-domain automation.** Attaching `saskair.ca` to a client's Vercel project + DNS stays a manual dashboard/registrar step. The design stays fully compatible with custom domains (the `?edit` editor already works on any origin because CORS is `*` and auth is bearer-token, no cookies).
- **No change to the editing experience** (`?edit`, overrides, permissions) — only how bytes move during ingest and publish.
- **No HTML-page chunking.** Page HTML is text and small (saskair ≈ 1MB total); it stays in one `/api/ingest` request. Chunking pages is a future concern if a site ever exceeds the cap on HTML alone.

---

## What exists today (the two chokepoints)

1. **Ingest:** `editor-engine push` builds `{ manifest, pages[], assets[] (base64) }` and POSTs it once to `/api/ingest`, which writes `tagged_pages` and `assets` (base64 column) to Postgres. → single-request cap.
2. **Deploy:** `publisher.publish()` reads pages + assets (base64) from Postgres and calls `deployFiles`, which inlines all of them base64 into one `POST /v13/deployments`. → single-request cap.

Reused unchanged: `mergePages`, `injectEditorEmbed`, the lock/promote/readiness logic in `publisher`, the editor's existing Blob store and `@vercel/blob`.

---

## Architecture: Blob-backed assets + Vercel SHA-upload deploys

Vercel supports a **two-step deployment**: upload each file's bytes to `POST /v2/files` (header `x-vercel-digest: <sha1-hex>`; Vercel stores by content hash and **dedups** — identical bytes upload once ever, repeats short-circuit), then create the deployment with `files: [{ file, sha, size }]`. No request ever carries the whole site. We use this for publish, and we move asset *bytes* out of Postgres into Blob.

```
INGEST
  engine: tag site → buildManifest, read pages (HTML), read assets (bytes)
  POST /api/ingest            { slug, displayName, vercelProjectId, customDomain, tier, manifest, pages }   (no asset bytes)
  POST /api/ingest/assets ×N  { slug, assets:[{path, base64}] }   batched ≤ ~3.5MB → each put to Blob, upsert asset ref

PUBLISH
  pages(Postgres) + overrides → mergePages → injectEditorEmbed
  assets: read refs (Blob URLs) from Postgres → fetch bytes from Blob
  deployFiles: for each file (page bytes + asset bytes) → POST /v2/files (by sha, deduped)
               → POST /v13/deployments with files:[{file, sha, size}]
```

---

## Components

### 1. `editor/app/src/vercel.ts` — SHA-upload deploy

Replace the single inlined POST with a two-step flow. New shape:

- `sha1(bytes: Buffer): string` — hex digest.
- `uploadFile(bytes: Buffer): Promise<{ sha: string; size: number }>` — `POST https://api.vercel.com/v2/files?teamId=…` with the raw bytes as body and headers `x-vercel-digest: <sha>`, `Content-Length`. Treats 200 (and "already uploaded") as success; retries once on 5xx.
- `deployFiles(input)` where `input.files: { path: string; bytes: Buffer }[]` (pages and assets unified as bytes). It uploads every file via `uploadFile`, collects `{ file: path, sha, size }`, then `POST /v13/deployments` with that list. Returns `{ id, url }` as today.
- `getDeploymentState` unchanged.

### 2. Asset storage → Blob (schema change)

`assets` table changes from `(slug, path, base64)` to `(slug, path, blob_url, size)`.
- `repo.saveAssets(db, slug, assets: {path, blobUrl, size}[])` — replace-all (existing semantics).
- `repo.upsertAsset(db, slug, {path, blobUrl, size})` — single upsert (used by batched ingest).
- `repo.getAssets(db, slug): {path, blob_url, size}[]`.
- `db/schema.sql` updated; a migration drops the old `base64` column and adds `blob_url`, `size`.

### 3. Ingest split

- **`/api/ingest`** (existing): drop `assets` from `IngestPayloadSchema`; it now persists client + manifest + pages only. Still operator-token gated.
- **`POST /api/ingest/assets`** (new): body `{ slug, assets: [{ path, base64 }] }`, operator-token gated. For each asset: decode base64, `put(blobKey(slug, path), bytes, { access: "public" })` to Blob, `repo.upsertAsset`. Idempotent (re-push overwrites). Returns `{ ok, count }`.
- **`editor/engine/src/push.ts` / `cli.ts`**: after the main ingest POST, read asset bytes, group into batches whose base64 size stays under a safe limit (`MAX_ASSET_BATCH_BYTES`, ~3.5MB), and POST each batch to `/api/ingest/assets`. `buildPushPayload` no longer needs to inline assets into the main payload; it returns pages + manifest + a separate asset list (path + bytes).

### 4. `editor/app/src/publisher.ts`

After `mergePages` + `injectEditorEmbed`, build the deploy file list:
- pages → `{ path, bytes: Buffer.from(html, "utf8") }`
- assets → for each ref, `fetch(blob_url)` → `Buffer` → `{ path, bytes }`
Then call the new `deployFiles`. Lock/promote/readiness unchanged. Outbound fetch + upload from the serverless function is not subject to the 4.5MB inbound cap; set a generous `maxDuration` on the publish route.

### 5. Onboarding wrapper (repeatability)

A documented `scripts/onboard-editor-client.sh <slug> "<Display Name>" [tier]` that runs the full sequence end-to-end so every built client onboards with one command: engine `push` → set `vercel_project_id`/`custom_domain` in the DB → set a client password → disable Vercel Deployment Protection on the client project → `/api/publish` → print the copy-paste invite. Reads `OPERATOR_TOKEN`, `POSTGRES_URL`, `VERCEL_TOKEN`, `VERCEL_TEAM_ID`, and the editor base URL from the environment.

---

## Data shapes

- Ingest main payload: `{ slug, displayName, vercelProjectId, customDomain, tier, manifest, pages: [{path, html}] }`.
- Ingest assets payload: `{ slug, assets: [{ path, base64 }] }` (batched).
- `assets` row: `{ slug, path, blob_url, size }`.
- `deployFiles` input file: `{ path, bytes: Buffer }`; deployment file ref: `{ file, sha, size }`.

---

## Error handling

| Case | Behavior |
|---|---|
| `/v2/files` transient 5xx | retry once; then fail the publish with Vercel's status. |
| Deployment reports a missing file SHA | shouldn't occur (we upload first); surface Vercel's error verbatim. |
| Asset batch ingest fails mid-run | idempotent — re-running `push` re-uploads/overwrites; no partial-corruption (refs upsert by `(slug, path)`). |
| Blob fetch fails at publish | fail the publish with a clear "asset unavailable: {path}" message; don't deploy a site with missing images. |
| Publish function timeout on a first large publish | set `maxDuration` high enough; subsequent publishes are mostly deduped no-ops. |

---

## Schema migration

Only capstone currently has rows in `assets` (old base64 column). Plan: alter the `assets` table (drop `base64`, add `blob_url`, `size`) and **re-ingest capstone** (tiny) so its assets land in Blob. No other clients are in the editor. Applied via the existing `apply-schema.mjs` path plus a one-off `ALTER TABLE`.

---

## Testing

**Engine**
- Batching: assets are grouped so each batch's base64 size ≤ `MAX_ASSET_BATCH_BYTES`; a single oversized asset still goes in its own batch; ordering preserved.
- `buildPushPayload` returns pages + manifest + asset list (path + bytes), no base64 in the main payload.

**App (backend)**
- `vercel.ts`: with mocked fetch, `deployFiles` calls `/v2/files` once per unique file with the correct `x-vercel-digest`, then `/v13/deployments` with the `{file,sha,size}` list; `sha1` matches known vectors; 5xx retry path.
- `/api/ingest/assets`: operator-gated; decodes base64, calls Blob `put` per asset, upserts refs; idempotent on re-post.
- `/api/ingest`: rejects the old `assets` field gone — persists client/manifest/pages only.
- `repo`: `saveAssets`/`upsertAsset`/`getAssets` round-trip `{path, blob_url, size}` (pg-mem).
- `publisher`: assets sourced from Blob (mock fetch) and passed to `deployFiles`; merge/inject/lock unchanged (existing tests updated for the new `deployFiles` signature).

---

## Rollout

1. Land the schema change; `ALTER` the live Supabase `assets` table.
2. Deploy the editor app (prebuilt) with the new ingest/deploy code.
3. Re-ingest capstone (assets → Blob); verify a capstone publish still works.
4. Onboard saskair via the wrapper; verify `?edit`, image edit, Preview, Publish end-to-end on the live site.

---

## Open items for the implementation plan

- Exact `MAX_ASSET_BATCH_BYTES` (default ~3.5MB to stay safely under 4.5MB after JSON overhead).
- `maxDuration` value for the publish route (start at 300s if the plan allows; otherwise the platform max).
- Whether `/v2/files` needs the upload to also be associated to the project/team explicitly (confirm against Vercel API during the spike in Task 1).
