# Editor Publisher (Plan 2c) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make "Publish" real — merge a client's published overrides into their site (HTML + assets) entirely in memory and deploy it to their existing Vercel project so their live custom domain updates, with a preview-to-throwaway-URL path first.

**Architecture:** Add an in-memory merge to the engine (`mergePages`) so the serverless app can merge without the filesystem. Extend `push`/ingestion/store to carry **all** site files (HTML + binary assets as base64) — required because a Vercel deployment must contain every file. Add a thin Vercel REST client (`POST /v13/deployments`), a `publish(db, slug, mode)` orchestrator, and authenticated `/api/preview` + `/api/publish` routes with a per-slug lock.

**Tech Stack:** The merged engine + `editor/app/` (Next.js, `pg`, `pg-mem` tests, zod, vitest). Vercel REST API via `fetch` (mocked in tests). Env: `VERCEL_TOKEN`, `VERCEL_TEAM_ID` (already in `.env`).

**Builds on:** App spec §7 (publish flow), §8 (error handling), §11 (the Vercel-deploy spike). Plans 2a + 2b are merged. **Out of scope:** the editor/admin UI and image upload to Blob (Plan 2d). This plan's `/api/preview` + `/api/publish` are callable by the UI built in 2d.

---

## Design discovery (why this plan touches push/ingestion again)

A non-git Vercel deployment must include **all** files (it's a full, immutable deployment, not a diff). Plan 2b's `push` stored only tagged **HTML**. To deploy a working site, the Publisher also needs the static **assets** (logos, photos, svgs, `tailwind.config.js`). So this plan:
1. Extends `buildPushPayload` to also collect non-HTML files as base64 `assets`.
2. Adds an `assets` table + ingestion handling.
3. The Publisher deploys merged HTML + stored assets together.

Existing clients pushed under 2b must be **re-pushed** once after 2c to capture their assets (the "Push to editor" button does this; noted in the final task).

---

## Confirmed Vercel API (from docs, 2026-06-02)

`POST https://api.vercel.com/v13/deployments?teamId={VERCEL_TEAM_ID}` — `Authorization: Bearer {VERCEL_TOKEN}`. Body:
```jsonc
{
  "name": "{slug}-site",
  "project": "{vercel_project_id}",      // overrides name; targets the existing project
  "target": "production",                 // assigns the project's aliases (custom domain); omit for preview
  "files": [{ "file": "index.html", "data": "<base64>", "encoding": "base64" }],
  "projectSettings": { "framework": null }
}
```
Response includes `id` and `url` (the `*.vercel.app` deployment URL). Production deployments auto-serve on the project's custom domain — **no re-alias call needed**. Poll `GET /v13/deployments/{id}` for `readyState` (`READY`/`ERROR`).

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `editor/engine/src/merger.ts` | Modify | Extract pure `mergePages(pages, overrides)`; `mergeSite` delegates to it |
| `editor/engine/src/push.ts` | Modify | Collect non-HTML files as base64 `assets` |
| `editor/engine/src/index.ts` | Modify | export `mergePages` |
| `editor/app/db/schema.sql` | Modify | add `assets` + `publish_locks` tables |
| `editor/app/src/repo.ts` | Modify | `saveAssets`/`getAssets`; lock acquire/release; `promoteOverrides` |
| `editor/app/src/ingest.ts` | Modify | accept optional `assets` in payload; persist them |
| `editor/app/src/vercel.ts` | Create | `deployFiles`, `getDeploymentState` |
| `editor/app/src/publisher.ts` | Create | `publish(db, slug, mode)` orchestrator |
| `editor/app/src/session-request.ts` | Create | `sessionFromRequest(db, req)` guard |
| `editor/app/app/api/preview/route.ts`, `.../publish/route.ts` | Create | authenticated endpoints |

---

### Task 0: Engine — extract pure `mergePages`

**Files:** `editor/engine/src/merger.ts`, `editor/engine/src/index.ts`, `editor/engine/test/merge-pages.test.ts`. Run from `editor/engine`.

`mergeSite` currently reads a dir, merges, and writes a dir. Extract the per-page logic into a pure `mergePages(pages, overrides)` that the serverless Publisher can call in memory; keep `mergeSite` working by delegating.

- [ ] **Step 1: Write the failing test** `editor/engine/test/merge-pages.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mergePages } from "../src/merger";

const page = (id: string) =>
  `<html><head><script>tailwind.config={theme:{extend:{colors:{primary:'#E5524F'}}}};</script></head>` +
  `<body><h1 data-edit="${id}__h1__1">Old</h1></body></html>`;

describe("mergePages", () => {
  it("merges text + color across pages in memory and reports applied/orphans", () => {
    const out = mergePages(
      [{ path: "index.html", html: page("index") }, { path: "a/b.html", html: page("a-b") }],
      { "index__h1__1": "New", "color__primary": "#000000", "ghost__id__1": "x" }
    );
    const idx = out.pages.find((p) => p.path === "index.html")!.html;
    expect(idx).toContain(">New<");
    expect(idx).toContain("primary: '#000000'");
    expect(out.pages.find((p) => p.path === "a/b.html")!.html).toContain("primary: '#000000'");
    expect(out.applied).toContain("index__h1__1");
    expect(out.orphans).toContain("ghost__id__1");
  });
});
```

- [ ] **Step 2: Run** `npx vitest run test/merge-pages.test.ts` — expect FAIL (no `mergePages`).

- [ ] **Step 3: Refactor `editor/engine/src/merger.ts`.** Read the current file first. Add the pure function and have `mergeSite` delegate. Add near the top (after imports), preserving the existing `isLink`, `SAFE_EDIT_ID`, and color-extraction logic by moving the per-page transform into `mergePages`:

```ts
export interface InMemoryPage { path: string; html: string; }
export interface MergePagesResult { pages: InMemoryPage[]; applied: string[]; orphans: string[]; }

/** Pure in-memory merge: apply overrides to a set of pages. Mirrors mergeSite's per-page logic. */
export function mergePages(pages: InMemoryPage[], overrides: Overrides): MergePagesResult {
  const applied = new Set<string>();
  const colorUpdates: Record<string, string> = {};
  for (const [id, value] of Object.entries(overrides)) {
    if (id.startsWith("color__") && typeof value === "string") {
      colorUpdates[id.replace(/^color__/, "")] = value;
    }
  }
  const outPages = pages.map(({ path, html }) => {
    if (Object.keys(colorUpdates).length) {
      const before = html;
      html = rewriteColors(html, colorUpdates);
      if (html !== before) for (const k of Object.keys(colorUpdates)) applied.add(`color__${k}`);
    }
    const $ = cheerio.load(html);
    for (const [id, value] of Object.entries(overrides)) {
      if (id.startsWith("color__")) continue;
      if (!SAFE_EDIT_ID.test(id)) continue;
      const el = $(`[data-edit="${id}"]`);
      if (!el.length) continue;
      if (el.is("img")) el.attr("src", String(value));
      else if (el.is("a") && isLink(value)) el.attr("href", value.href).text(value.label);
      else if (el.is("[data-rich]")) el.html(String(value));
      // Plain-text branch: intentionally replaces child markup (use data-rich for HTML).
      else el.text(String(value));
      applied.add(id);
    }
    return { path, html: $.html() };
  });
  const orphans = Object.keys(overrides).filter((id) => !applied.has(id));
  return { pages: outPages, applied: [...applied], orphans };
}
```

Then refactor `mergeSite` to read files into `InMemoryPage[]`, call `mergePages`, and write the results — preserving its existing signature and `MergeResult` return (`{ pages, applied, orphans }` where `pages` is the list of relative paths). Concretely, inside `mergeSite` replace the per-page loop body so it: collects `{path: rel, html: readFileSync(...)}` for all pages, calls `mergePages`, writes each `out.pages[i].html` to `outDir/path`, and returns `{ pages: pagePaths, applied: result.applied, orphans: result.orphans }`. Keep all imports (`cheerio`, `rewriteColors`, `Overrides`, `LinkValue`) — they are now used by `mergePages`.

- [ ] **Step 4: Run** `npx vitest run` (full engine suite) — `merge-pages` passes AND the existing `merger.test.ts` still passes (proving the refactor preserved behavior). Expect prior count + 1.

- [ ] **Step 5: Export** — add `export * from "./merger"` already exists; ensure `mergePages`/`InMemoryPage`/`MergePagesResult` are exported (they are, via `export *`). Run `npm run typecheck` (0).

- [ ] **Step 6: Commit**

```bash
git add editor/engine/src/merger.ts editor/engine/test/merge-pages.test.ts
git commit -m "feat(engine): extract pure in-memory mergePages from mergeSite"
```

---

### Task 1: Engine — `push` collects assets

**Files:** `editor/engine/src/push.ts`, `editor/engine/test/push.test.ts` (extend). Run from `editor/engine`.

- [ ] **Step 1: Add a failing test** to `editor/engine/test/push.test.ts` (new `it` in the existing describe):

```ts
  it("collects non-HTML files as base64 assets", () => {
    const siteDir = join(root, "clients", "acme2", "site");
    mkdirSync(join(siteDir, "assets"), { recursive: true });
    writeFileSync(join(siteDir, "index.html"),
      `<html><head><script>tailwind.config={theme:{extend:{colors:{primary:'#111'}}}};</script></head><body><h1>Hi</h1></body></html>`, "utf8");
    writeFileSync(join(siteDir, "assets", "logo.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    writeFileSync(join(siteDir, "tailwind.config.js"), "module.exports={};", "utf8");

    const p = buildPushPayload({ slug: "acme2", root, displayName: "Acme2", tier: "Text only" });
    const paths = p.assets.map((a) => a.path).sort();
    expect(paths).toEqual(["assets/logo.png", "tailwind.config.js"]);
    const png = p.assets.find((a) => a.path === "assets/logo.png")!;
    expect(png.base64).toBe(Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString("base64"));
    // HTML stays in pages, not assets
    expect(p.pages.some((pg) => pg.path === "index.html")).toBe(true);
    expect(p.assets.some((a) => a.path === "index.html")).toBe(false);
  });
```

- [ ] **Step 2: Run** `npx vitest run test/push.test.ts` — expect FAIL (`p.assets` undefined).

- [ ] **Step 3: Edit `editor/engine/src/push.ts`.** Add `assets` to `PushPayload`:

```ts
  assets: { path: string; base64: string }[];
```
Add a helper to walk the ORIGINAL site dir for non-HTML files:
```ts
function readAssets(dir: string, base = dir): { path: string; base64: string }[] {
  const out: { path: string; base64: string }[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...readAssets(full, base));
    else if (!entry.name.endsWith(".html")) out.push({ path: relative(base, full), base64: readFileSync(full).toString("base64") });
  }
  return out;
}
```
In `buildPushPayload`, after computing `pages`, add `const assets = readAssets(siteDir);` (note: read assets from the ORIGINAL `siteDir`, not the tagged `outDir` — the tagger only writes HTML) and include `assets` in the returned payload. Adjust the `readFileSync` import to allow buffer reads (it already imports `readFileSync`).

- [ ] **Step 4: Run** `npx vitest run test/push.test.ts` — expect PASS (3 tests). Also `npm run typecheck` (0) and full suite.

- [ ] **Step 5: Commit**

```bash
git add editor/engine/src/push.ts editor/engine/test/push.test.ts
git commit -m "feat(engine): push collects non-HTML assets as base64"
```

---

### Task 2: Store — assets, locks, promote (+ ingestion)

**Files:** `editor/app/db/schema.sql`, `editor/app/src/repo.ts`, `editor/app/src/ingest.ts`, `editor/app/test/assets-lock.test.ts`, `editor/app/test/ingest.test.ts` (extend). Run from `editor/app`.

- [ ] **Step 1: Add tables to `editor/app/db/schema.sql`:**

```sql
CREATE TABLE IF NOT EXISTS assets (
  slug   TEXT NOT NULL,
  path   TEXT NOT NULL,
  base64 TEXT NOT NULL,
  PRIMARY KEY (slug, path)
);

CREATE TABLE IF NOT EXISTS publish_locks (
  slug        TEXT PRIMARY KEY,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- [ ] **Step 2: Write failing test** `editor/app/test/assets-lock.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { makeTestDb } from "./helpers/pgmem";
import * as repo from "../src/repo";

describe("assets + locks + promote", () => {
  it("saves and reads assets (replace on re-save)", async () => {
    const db = await makeTestDb();
    await repo.saveAssets(db, "acme", [{ path: "assets/logo.png", base64: "AAA" }]);
    await repo.saveAssets(db, "acme", [{ path: "assets/logo.png", base64: "BBB" }]);
    expect(await repo.getAssets(db, "acme")).toEqual([{ path: "assets/logo.png", base64: "BBB" }]);
  });

  it("promotes draft overrides to published", async () => {
    const db = await makeTestDb();
    await repo.saveOverrides(db, "acme", "draft", { "x": "1" });
    await repo.promoteOverrides(db, "acme");
    expect(await repo.getOverrides(db, "acme", "published")).toEqual({ "x": "1" });
  });

  it("lock is exclusive until released, and stale locks can be taken over", async () => {
    const db = await makeTestDb();
    expect(await repo.acquireLock(db, "acme", 300)).toBe(true);
    expect(await repo.acquireLock(db, "acme", 300)).toBe(false); // held
    await repo.releaseLock(db, "acme");
    expect(await repo.acquireLock(db, "acme", 300)).toBe(true);   // free again
  });
});
```

- [ ] **Step 3: Append to `editor/app/src/repo.ts`:**

```ts
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

/** Returns true if the lock was acquired. Locks older than ttlSeconds are considered stale and reclaimed. */
export async function acquireLock(db: Queryable, slug: string, ttlSeconds: number): Promise<boolean> {
  await db.query(`DELETE FROM publish_locks WHERE slug=$1 AND acquired_at < now() - ($2 || ' seconds')::interval`, [slug, String(ttlSeconds)]);
  const { rows } = await db.query(
    `INSERT INTO publish_locks (slug) VALUES ($1) ON CONFLICT (slug) DO NOTHING RETURNING slug`,
    [slug]
  );
  return rows.length > 0;
}

export async function releaseLock(db: Queryable, slug: string): Promise<void> {
  await db.query(`DELETE FROM publish_locks WHERE slug=$1`, [slug]);
}
```

Note: if pg-mem rejects the `($2 || ' seconds')::interval` expression, replace that DELETE with a JS-side staleness check: `SELECT acquired_at` then conditionally `DELETE`; keep the same `acquireLock` contract. Report if you change it.

- [ ] **Step 4: Extend ingestion.** In `editor/app/src/ingest.ts`, add to `IngestPayloadSchema`:
```ts
  assets: z.array(z.object({ path: z.string().min(1), base64: z.string() })).optional().default([]),
```
and in `ingest()` after `saveTaggedPages`, add `await repo.saveAssets(db, payload.slug, payload.assets);`. Add a test to `ingest.test.ts` asserting assets are persisted (extend the existing payload with `assets: [{ path: "assets/logo.png", base64: "AAA" }]` and assert `repo.getAssets` returns it).

- [ ] **Step 5: Run** `npx vitest run` (app) — all pass. `npm run typecheck` (0).

- [ ] **Step 6: Commit**

```bash
git add editor/app/db/schema.sql editor/app/src/repo.ts editor/app/src/ingest.ts editor/app/test/assets-lock.test.ts editor/app/test/ingest.test.ts
git commit -m "feat(editor-app): assets store, publish lock, promote, ingest assets"
```

---

### Task 3: SPIKE — validate the Vercel deploy API (manual, documented)

**Files:** `editor/app/docs/vercel-deploy-spike.md` (findings).

This de-risks the one external unknown before building the client. It requires a real `VERCEL_TOKEN` and a throwaway project.

- [ ] **Step 1: Write a throwaway spike script** at `/tmp/spike-deploy.mjs`:

```js
const token = process.env.VERCEL_TOKEN, team = process.env.VERCEL_TEAM_ID;
const body = {
  name: "editor-spike",
  target: "production",
  files: [{ file: "index.html", data: Buffer.from("<h1>spike ok</h1>").toString("base64"), encoding: "base64" }],
  projectSettings: { framework: null },
};
const res = await fetch(`https://api.vercel.com/v13/deployments${team ? `?teamId=${team}` : ""}`, {
  method: "POST",
  headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
  body: JSON.stringify(body),
});
console.log(res.status, JSON.stringify(await res.json(), null, 2));
```

- [ ] **Step 2: Run it** `node /tmp/spike-deploy.mjs` and observe: does it return 200/201 with an `id` and `url`? Does the `url` serve the HTML after a few seconds? Note any required fields the API rejected (e.g. whether `encoding: "base64"` is accepted, whether `project` must be an existing id, how `teamId` behaves).

- [ ] **Step 3: Record findings** in `editor/app/docs/vercel-deploy-spike.md`: the exact working request body, the response fields used (`id`, `url`, `readyState`), how production vs preview differs, and any deviation from the assumed shape. **If the API differs from the Task 4 code below, update Task 4's `vercel.ts` to match these findings before implementing.**

- [ ] **Step 4: Commit**

```bash
git add editor/app/docs/vercel-deploy-spike.md
git commit -m "docs(editor-app): Vercel deploy API spike findings"
```

---

### Task 4: Vercel REST client

**Files:** `editor/app/src/vercel.ts`, `editor/app/test/vercel.test.ts`. Run from `editor/app`. **Reconcile with Task 3 findings first.**

- [ ] **Step 1: Write failing test** `editor/app/test/vercel.test.ts` (mocks `fetch`):

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { deployFiles } from "../src/vercel";

afterEach(() => vi.unstubAllGlobals());

describe("deployFiles", () => {
  it("posts base64 files to v13/deployments and returns id+url", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true, status: 200, json: async () => ({ id: "dpl_1", url: "editor-spike-abc.vercel.app" }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("VERCEL_TOKEN", "tok"); vi.stubEnv("VERCEL_TEAM_ID", "team_1");

    const r = await deployFiles({
      projectId: "prj_1", projectName: "acme-site", target: "production",
      files: [{ path: "index.html", content: "<h1>hi</h1>" }],
    });
    expect(r).toEqual({ id: "dpl_1", url: "https://editor-spike-abc.vercel.app" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/v13/deployments");
    expect(url).toContain("teamId=team_1");
    const body = JSON.parse((init as any).body);
    expect(body.project).toBe("prj_1");
    expect(body.target).toBe("production");
    expect(body.files[0]).toEqual({ file: "index.html", data: Buffer.from("<h1>hi</h1>").toString("base64"), encoding: "base64" });
    expect((init as any).headers.authorization).toBe("Bearer tok");
  });

  it("throws on non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 403, text: async () => "nope" })));
    vi.stubEnv("VERCEL_TOKEN", "tok");
    await expect(deployFiles({ projectId: "p", projectName: "n", files: [] })).rejects.toThrow(/403/);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run test/vercel.test.ts` — expect FAIL.

- [ ] **Step 3: Write `editor/app/src/vercel.ts`** (reconciled with the spike):

```ts
const API = "https://api.vercel.com";

export interface DeployFile { path: string; content: string; } // content = utf8 (HTML) or already-decoded asset bytes as string
export interface DeployFileB64 { path: string; base64: string; }

export interface DeployInput {
  projectId: string;
  projectName: string;
  target?: "production";          // omit → preview
  files: DeployFile[];            // text files (HTML)
  assets?: DeployFileB64[];       // pre-encoded base64 files
}

export interface DeployResult { id: string; url: string; }

export async function deployFiles(input: DeployInput): Promise<DeployResult> {
  const token = process.env.VERCEL_TOKEN;
  if (!token) throw new Error("VERCEL_TOKEN not set");
  const team = process.env.VERCEL_TEAM_ID;

  const files = [
    ...input.files.map((f) => ({ file: f.path, data: Buffer.from(f.content, "utf8").toString("base64"), encoding: "base64" as const })),
    ...(input.assets ?? []).map((a) => ({ file: a.path, data: a.base64, encoding: "base64" as const })),
  ];

  const body = {
    name: input.projectName,
    project: input.projectId,
    target: input.target,
    files,
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
  const team = process.env.VERCEL_TEAM_ID;
  const res = await fetch(`${API}/v13/deployments/${id}${team ? `?teamId=${team}` : ""}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Vercel state failed: ${res.status}`);
  const j = await res.json();
  return j.readyState ?? j.status ?? "UNKNOWN";
}
```

- [ ] **Step 4: Run** `npx vitest run test/vercel.test.ts` — expect PASS. Typecheck 0.

- [ ] **Step 5: Commit**

```bash
git add editor/app/src/vercel.ts editor/app/test/vercel.test.ts
git commit -m "feat(editor-app): Vercel REST deploy client"
```

---

### Task 5: Publisher orchestrator

**Files:** `editor/app/src/publisher.ts`, `editor/app/test/publisher.test.ts`. Run from `editor/app`.

- [ ] **Step 1: Write failing test** `editor/app/test/publisher.test.ts` (mock the vercel module):

```ts
import { describe, it, expect, vi } from "vitest";
import { makeTestDb } from "./helpers/pgmem";
import * as repo from "../src/repo";

vi.mock("../src/vercel", () => ({
  deployFiles: vi.fn(async (input: any) => ({ id: "dpl_1", url: "https://preview-xyz.vercel.app" })),
  getDeploymentState: vi.fn(async () => "READY"),
}));
import { publish } from "../src/publisher";
import { deployFiles } from "../src/vercel";

async function seed(db: any) {
  await repo.upsertClient(db, { slug: "acme", displayName: "Acme", vercelProjectId: "prj_1", customDomain: "https://acme.example.com", tier: "Text only" });
  await repo.saveTaggedPages(db, "acme", [{ path: "index.html", html: '<html><body><h1 data-edit="index__h1__1">Old</h1></body></html>' }]);
  await repo.saveAssets(db, "acme", [{ path: "assets/logo.png", base64: "AAA" }]);
}

describe("publish", () => {
  it("preview merges DRAFT overrides and deploys without production target", async () => {
    const db = await makeTestDb();
    await seed(db);
    await repo.saveOverrides(db, "acme", "draft", { "index__h1__1": "Draft Title" });
    const r = await publish(db, "acme", "preview");
    expect(r.url).toBe("https://preview-xyz.vercel.app");
    const call = (deployFiles as any).mock.calls.at(-1)[0];
    expect(call.target).toBeUndefined();
    expect(call.files.find((f: any) => f.path === "index.html").content).toContain(">Draft Title<");
    expect(call.assets).toEqual([{ path: "assets/logo.png", base64: "AAA" }]);
  });

  it("publish promotes draft→published, deploys with production target", async () => {
    const db = await makeTestDb();
    await seed(db);
    await repo.saveOverrides(db, "acme", "draft", { "index__h1__1": "Live Title" });
    const r = await publish(db, "acme", "publish");
    expect(r.url).toBeTruthy();
    const call = (deployFiles as any).mock.calls.at(-1)[0];
    expect(call.target).toBe("production");
    expect(call.projectId).toBe("prj_1");
    expect(await repo.getOverrides(db, "acme", "published")).toEqual({ "index__h1__1": "Live Title" });
  });

  it("throws if the client has no vercel project id", async () => {
    const db = await makeTestDb();
    await repo.upsertClient(db, { slug: "bare", displayName: "Bare", vercelProjectId: null, customDomain: null, tier: "Text only" });
    await expect(publish(db, "bare", "publish")).rejects.toThrow(/project/i);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run test/publisher.test.ts` — expect FAIL.

- [ ] **Step 3: Write `editor/app/src/publisher.ts`:**

```ts
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
```

- [ ] **Step 4: Run** `npx vitest run test/publisher.test.ts` — expect PASS (3 tests). Typecheck 0, full suite.

- [ ] **Step 5: Commit**

```bash
git add editor/app/src/publisher.ts editor/app/test/publisher.test.ts
git commit -m "feat(editor-app): publish orchestrator (merge + deploy + promote + lock)"
```

---

### Task 6: Session guard + preview/publish routes

**Files:** `editor/app/src/session-request.ts`, `editor/app/test/session-request.test.ts`, `editor/app/app/api/preview/route.ts`, `editor/app/app/api/publish/route.ts`. Run from `editor/app`.

- [ ] **Step 1: Write failing test** `editor/app/test/session-request.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { makeTestDb } from "./helpers/pgmem";
import * as repo from "../src/repo";
import { authorizeSlug } from "../src/session-request";

describe("authorizeSlug", () => {
  it("allows operator any slug; client only their own", () => {
    expect(authorizeSlug({ id: "s", username: "op", slug: null, role: "operator" }, "acme")).toBe(true);
    expect(authorizeSlug({ id: "s", username: "acme", slug: "acme", role: "client" }, "acme")).toBe(true);
    expect(authorizeSlug({ id: "s", username: "acme", slug: "acme", role: "client" }, "other")).toBe(false);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run test/session-request.test.ts` — expect FAIL.

- [ ] **Step 3: Write `editor/app/src/session-request.ts`:**

```ts
import type { NextRequest } from "next/server";
import type { Queryable } from "./db";
import { getSession } from "./auth";
import type { SessionRow } from "./repo";
import { SESSION_COOKIE } from "./session-cookie";

export async function sessionFromRequest(db: Queryable, req: NextRequest): Promise<SessionRow | null> {
  const id = req.cookies.get(SESSION_COOKIE)?.value;
  if (!id) return null;
  return getSession(db, id);
}

export function authorizeSlug(session: SessionRow, slug: string): boolean {
  return session.role === "operator" || session.slug === slug;
}
```

- [ ] **Step 4: Run** `npx vitest run test/session-request.test.ts` — expect PASS.

- [ ] **Step 5: Write `editor/app/app/api/preview/route.ts`:**

```ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "../../../src/db";
import { sessionFromRequest, authorizeSlug } from "../../../src/session-request";
import { publish } from "../../../src/publisher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ slug: z.string().min(1) });

export async function POST(req: NextRequest) {
  const db = getDb();
  const session = await sessionFromRequest(db, req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body;
  try { body = Body.parse(await req.json()); }
  catch { return NextResponse.json({ error: "Invalid" }, { status: 400 }); }
  if (!authorizeSlug(session, body.slug)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const r = await publish(db, body.slug, "preview");
    return NextResponse.json({ ok: true, url: r.url });
  } catch (e: any) {
    return NextResponse.json({ error: "Preview failed", detail: String(e?.message ?? e) }, { status: 500 });
  }
}
```

- [ ] **Step 6: Write `editor/app/app/api/publish/route.ts`** — identical to preview but call `publish(db, body.slug, "publish")` and the error label `"Publish failed"`. (Write it out in full mirroring Step 5, swapping the two strings.)

- [ ] **Step 7: Run** `npm run typecheck` (0) and `npx vitest run` (all pass).

- [ ] **Step 8: Commit**

```bash
git add editor/app/src/session-request.ts editor/app/test/session-request.test.ts editor/app/app/api/preview/route.ts editor/app/app/api/publish/route.ts
git commit -m "feat(editor-app): session guard + preview/publish API routes"
```

---

### Task 7: Re-push note (existing clients need assets)

**Files:** none (operational note appended to `editor/app/README.md`).

- [ ] **Step 1: Append to `editor/app/README.md`:**

```markdown
## Publishing (Plan 2c)
- `POST /api/preview` / `POST /api/publish` (session-authenticated; client may only act on their own slug).
- Publish merges published overrides into the site (HTML + stored assets) and deploys to the client's `{slug}-site` Vercel project (`target: production`), updating their custom domain. Preview deploys to a throwaway `*.vercel.app` URL.
- Requires `VERCEL_TOKEN` (+ `VERCEL_TEAM_ID`) on the app.
- **Clients pushed before Plan 2c must be re-pushed once** (the "Push to editor" button) so their assets are captured — otherwise a publish would deploy HTML without images.
```

- [ ] **Step 2: Commit**

```bash
git add editor/app/README.md
git commit -m "docs(editor-app): document publish endpoints + re-push requirement"
```

---

## Self-Review

**1. Spec coverage:**
- Preview→throwaway URL, Publish→prod redeploy of `{slug}-site` updating the domain (§7) → Tasks 4–6. ✔
- Merge baked into served HTML (SEO) → `mergePages` (Task 0), deployed as static files. ✔
- Never leave the domain broken on failure (§8) → Vercel only swaps the production alias when a deployment succeeds; `publish` throws on deploy error without promoting on preview, and the previous prod deployment stays live. ✔
- Concurrency lock per slug (§8) → `acquireLock`/`releaseLock` (Task 2), used in `publish` (Task 5). ✔
- The Vercel-deploy spike (§11) → Task 3, gating Task 4. ✔
- **Asset completeness** (discovery) → Tasks 1–2 (push + store assets), Task 5 (deploy them). ✔

**2. Placeholder scan:** Every code/test step contains complete code. Task 6 Step 6 says "mirror Step 5 swapping two strings" — that repeats fully-shown code rather than hiding it; acceptable, but the implementer must write the file out in full. No TBDs. ✔

**3. Type/name consistency:** `mergePages(pages, overrides)→{pages,applied,orphans}` consistent (engine ↔ publisher). `deployFiles(DeployInput)→{id,url}` consistent (vercel ↔ publisher ↔ test). Repo additions (`saveAssets`/`getAssets`/`promoteOverrides`/`acquireLock`/`releaseLock`) match between definition, tests, and publisher. `PushPayload.assets` (push) ↔ `IngestPayloadSchema.assets` (ingest) ↔ `saveAssets` all use `{path, base64}`. `SessionRow` fields (`role`,`slug`) consistent in `authorizeSlug`. ✔

**Risk note:** Task 3 (spike) may reveal the inline-files API differs (e.g. needs the sha-upload flow for larger assets, or a different `encoding` handling). If so, reconcile `vercel.ts` (Task 4) and possibly switch large assets to the pre-upload-by-sha flow before Task 5. The plan's structure (spike first) exists precisely to catch this.
```
