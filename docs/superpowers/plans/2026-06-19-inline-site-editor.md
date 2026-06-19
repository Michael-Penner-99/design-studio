# Inline Site Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the link-away form editor with click-to-edit inline editing that mounts on the live site via `?edit`, plus admin/client credential management and a copy-paste client invite.

**Architecture:** The factory bakes a tiny loader script into every page; on `?edit` it lazy-loads `embed.js` from the editor app. The embed shows a login overlay, authenticates via a bearer token (Authorization header, cross-origin safe), then makes manifest-tagged elements editable in place and drives the existing Save/Preview/Publish APIs. Backend gains bearer-token auth, CORS, a manifest endpoint, an operator credential seeded into the DB (so the admin can change their own password), and a change-password endpoint. The admin panel gains a client-invite block.

**Tech Stack:** TypeScript, Next.js 14 (App Router), Postgres (`pg` / `pg-mem` in tests), bcryptjs, cheerio, zod, vitest (+ jsdom, @testing-library/react), esbuild (new, for bundling the embed).

## Global Constraints

- **Two roles only:** `operator` (global admin, one credential) and `client` (per-slug). Server is the permission gate; UI is convenience.
- **No third-party cookies:** the embed authenticates with `Authorization: Bearer <sessionId>`; cookie auth remains for the same-origin app.
- **No email provider:** invites are copy-paste / `mailto:` only.
- **Clients cannot self-change passwords.** Only the admin changes passwords.
- **Min password length: 8** (matches existing `/api/admin/credentials`).
- **Reuse existing helpers; do not duplicate logic.** `visibleFields`, `canEditField`, `setCredential`, `publish`, `mergePages` already exist and are used as-is.
- **Tagger attribute is `data-edit="<fieldId>"`** (confirmed by `editor/app/test/publisher.test.ts`).
- **Tests:** engine via `npm test` in `editor/engine`; app via `npm test` in `editor/app`. Both use vitest. New backend logic goes in `editor/app/src/*` and is unit-tested there (routes are thin and not unit-tested, per existing convention).
- **Working directory for all engine commands:** `editor/engine`. For all app commands: `editor/app`.

---

### Task 1: Engine — replace the edit button with an embed loader

**Files:**
- Rename/Create: `editor/engine/src/embed-loader.ts` (replaces `editor/engine/src/edit-button.ts`)
- Delete: `editor/engine/src/edit-button.ts`
- Modify: `editor/engine/src/index.ts:11`
- Rename/Create test: `editor/engine/test/embed-loader.test.ts` (replaces `editor/engine/test/edit-button.test.ts`)
- Modify: `editor/app/src/publisher.ts:1,45`
- Modify: `editor/app/test/publisher.test.ts:56-76`

**Interfaces:**
- Produces: `injectEditorEmbed(html: string, opts: { editorUrl: string; slug: string }): string` — appends an idempotent inline loader (marker attribute `data-editor-embed`) before `</body>`. On `?edit`/`#edit` the loader injects `<script src="{editorUrl}/embed.js" data-slug data-editor defer>`.

- [ ] **Step 1: Write the failing test** — create `editor/engine/test/embed-loader.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import * as cheerio from "cheerio";
import { injectEditorEmbed } from "../src/embed-loader";

const page = `<!DOCTYPE html><html><head></head><body><h1>Hi</h1></body></html>`;

describe("injectEditorEmbed", () => {
  it("appends an idempotent loader that points at /embed.js with slug + editor base", () => {
    const out = injectEditorEmbed(page, { editorUrl: "https://editor.example.com", slug: "acme" });
    const $ = cheerio.load(out);
    const marker = $("[data-editor-embed]");
    expect(marker.length).toBe(1);
    expect(marker.attr("data-slug")).toBe("acme");
    expect(marker.attr("data-editor")).toBe("https://editor.example.com");
    expect(out).toContain("/embed.js");
    expect(out).toContain("location.hash==='#edit'");
  });

  it("trims a trailing slash on editorUrl", () => {
    const out = injectEditorEmbed(page, { editorUrl: "https://editor.example.com/", slug: "acme" });
    expect(out).toContain('"https://editor.example.com"');
    expect(out).not.toContain("example.com//embed.js");
  });

  it("is idempotent — re-injecting does not add a second loader", () => {
    const once = injectEditorEmbed(page, { editorUrl: "https://e.com", slug: "acme" });
    const twice = injectEditorEmbed(once, { editorUrl: "https://e.com", slug: "acme" });
    expect(cheerio.load(twice)("[data-editor-embed]").length).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd editor/engine && npx vitest run test/embed-loader.test.ts`
Expected: FAIL — cannot find module `../src/embed-loader`.

- [ ] **Step 3: Write minimal implementation** — create `editor/engine/src/embed-loader.ts`:

```ts
import * as cheerio from "cheerio";

/**
 * Append a hidden inline loader before </body>. On ?edit / #edit the loader
 * injects the editor embed bundle from the editor app. Idempotent.
 */
export function injectEditorEmbed(html: string, opts: { editorUrl: string; slug: string }): string {
  const $ = cheerio.load(html);
  if ($("[data-editor-embed]").length) return html;
  const base = opts.editorUrl.replace(/\/$/, "");
  const baseJson = JSON.stringify(base);
  const slugJson = JSON.stringify(opts.slug);
  const loader =
    `<script data-editor-embed data-slug=${JSON.stringify(opts.slug)} data-editor=${JSON.stringify(base)}>` +
    `(function(){var p=new URLSearchParams(location.search);` +
    `if(p.has('edit')||location.hash==='#edit'){var s=document.createElement('script');` +
    `s.src=${baseJson}+'/embed.js';s.defer=true;` +
    `s.setAttribute('data-slug',${slugJson});s.setAttribute('data-editor',${baseJson});` +
    `document.body.appendChild(s);}})();</script>`;
  if ($("body").length) {
    $("body").append(loader);
    return $.html();
  }
  return html + loader;
}
```

- [ ] **Step 4: Delete the old file + update the export**

Run: `cd editor/engine && rm src/edit-button.ts test/edit-button.test.ts`
Edit `editor/engine/src/index.ts` line 11: change `export * from "./edit-button";` to `export * from "./embed-loader";`

- [ ] **Step 5: Update the publisher to use the new function**

Edit `editor/app/src/publisher.ts`:
- Line 1: `import { mergePages, injectEditorEmbed } from "@action-studio/editor-engine";`
- Line 45: `? merged.pages.map((p) => ({ path: p.path, html: injectEditorEmbed(p.html, { editorUrl, slug }) }))`

- [ ] **Step 6: Update the publisher test assertions**

Edit `editor/app/test/publisher.test.ts`:
- Replace the `data-op-edit` test body (lines 56-66) with:

```ts
  it("injects the editor embed loader into deployed pages when EDITOR_PUBLIC_URL is set", async () => {
    vi.stubEnv("EDITOR_PUBLIC_URL", "https://editor.example.com");
    const db = await makeTestDb();
    await seed(db);
    await publish(db, "acme", "publish");
    const call = (deployFiles as any).mock.calls.at(-1)[0];
    const idx = call.files.find((f: any) => f.path === "index.html").content;
    expect(idx).toContain("data-editor-embed");
    expect(idx).toContain("https://editor.example.com");
    expect(idx).toContain("/embed.js");
    vi.unstubAllEnvs();
  });
```

- Replace the "does not inject" assertion (line 74): `expect(call.files.find((f: any) => f.path === "index.html").content).not.toContain("data-editor-embed");`

- [ ] **Step 7: Run both suites**

Run: `cd editor/engine && npm test` — Expected: PASS (all, including new embed-loader tests).
Run: `cd editor/app && npm test` — Expected: PASS (publisher tests green with new assertions).

- [ ] **Step 8: Commit**

```bash
git add editor/engine/src editor/engine/test editor/app/src/publisher.ts editor/app/test/publisher.test.ts
git commit -m "feat(engine): replace edit-button with injectEditorEmbed loader"
```

---

### Task 2: Backend — accept bearer-token sessions

**Files:**
- Modify: `editor/app/src/session-request.ts:7-11`
- Modify: `editor/app/test/session-request.test.ts`

**Interfaces:**
- Consumes: `getSession(db, id)` (existing), `SESSION_COOKIE` (existing).
- Produces: `sessionFromRequest(db, req)` now resolves a session from `Authorization: Bearer <id>` when there is no valid cookie. Signature unchanged.

- [ ] **Step 1: Write the failing test** — append to `editor/app/test/session-request.test.ts`:

```ts
import { sessionFromRequest } from "../src/session-request";
import { makeTestDb } from "./helpers/pgmem";
import * as repo from "../src/repo";

function fakeReq(opts: { cookie?: string; bearer?: string }) {
  return {
    cookies: { get: (_: string) => (opts.cookie ? { value: opts.cookie } : undefined) },
    headers: { get: (k: string) => (k.toLowerCase() === "authorization" && opts.bearer ? `Bearer ${opts.bearer}` : null) },
  } as any;
}

describe("sessionFromRequest bearer token", () => {
  it("resolves a session from the Authorization header when no cookie", async () => {
    const db = await makeTestDb();
    await repo.createSession(db, { id: "sess-1", username: "acme", slug: "acme", role: "client", expiresAt: new Date(Date.now() + 60000) });
    const s = await sessionFromRequest(db, fakeReq({ bearer: "sess-1" }));
    expect(s?.role).toBe("client");
    expect(s?.slug).toBe("acme");
  });

  it("returns null for an unknown bearer token", async () => {
    const db = await makeTestDb();
    expect(await sessionFromRequest(db, fakeReq({ bearer: "nope" }))).toBeNull();
  });

  it("prefers a valid cookie session", async () => {
    const db = await makeTestDb();
    await repo.createSession(db, { id: "cookie-1", username: "op", slug: null, role: "operator", expiresAt: new Date(Date.now() + 60000) });
    const s = await sessionFromRequest(db, fakeReq({ cookie: "cookie-1", bearer: "ignored" }));
    expect(s?.role).toBe("operator");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd editor/app && npx vitest run test/session-request.test.ts`
Expected: FAIL — bearer header is ignored (returns null for the first test).

- [ ] **Step 3: Write minimal implementation** — replace the body of `sessionFromRequest` in `editor/app/src/session-request.ts`:

```ts
export async function sessionFromRequest(db: Queryable, req: NextRequest): Promise<SessionRow | null> {
  const cookieId = req.cookies.get(SESSION_COOKIE)?.value;
  if (cookieId) {
    const fromCookie = await getSession(db, cookieId);
    if (fromCookie) return fromCookie;
  }
  const auth = req.headers.get("authorization");
  const m = auth?.match(/^Bearer\s+(.+)$/i);
  if (m) return getSession(db, m[1]);
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd editor/app && npx vitest run test/session-request.test.ts`
Expected: PASS (3 new tests + existing `authorizeSlug` test).

- [ ] **Step 5: Commit**

```bash
git add editor/app/src/session-request.ts editor/app/test/session-request.test.ts
git commit -m "feat(app): accept Authorization: Bearer sessions for cross-origin embed"
```

---

### Task 3: Backend — CORS, login returns token, manifest endpoint

**Files:**
- Create: `editor/app/src/cors.ts`
- Create test: `editor/app/test/cors.test.ts`
- Modify: `editor/app/app/api/auth/login/route.ts:20`
- Modify (add CORS + OPTIONS): `editor/app/app/api/auth/login/route.ts`, `editor/app/app/api/overrides/route.ts`, `editor/app/app/api/upload/route.ts`, `editor/app/app/api/preview/route.ts`, `editor/app/app/api/publish/route.ts`
- Create: `editor/app/app/api/manifest/route.ts`

**Interfaces:**
- Produces: `parseAllowedOrigins(env: string | undefined): string[]` and `corsHeaders(requestOrigin: string | null, allowed: string[]): Record<string,string>`; helper `corsForReq(req: NextRequest): Record<string,string>` reading `process.env.EDITOR_ALLOWED_ORIGINS`.
- Produces: `GET /api/manifest?slug=<slug>` → `{ manifest }` (auth required; operator any slug, client own slug).
- Produces: `POST /api/auth/login` response now includes `token`.

- [ ] **Step 1: Write the failing test** — create `editor/app/test/cors.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseAllowedOrigins, corsHeaders } from "../src/cors";

describe("cors", () => {
  it("parses a comma list, trimming blanks", () => {
    expect(parseAllowedOrigins(" https://a.com, https://b.com ,")).toEqual(["https://a.com", "https://b.com"]);
    expect(parseAllowedOrigins(undefined)).toEqual([]);
  });

  it("echoes an allowed origin with method + header grants", () => {
    const h = corsHeaders("https://a.com", ["https://a.com"]);
    expect(h["Access-Control-Allow-Origin"]).toBe("https://a.com");
    expect(h["Access-Control-Allow-Headers"]).toContain("authorization");
    expect(h["Access-Control-Allow-Methods"]).toContain("PUT");
  });

  it("returns no headers for a disallowed origin", () => {
    expect(corsHeaders("https://evil.com", ["https://a.com"])).toEqual({});
  });

  it("supports wildcard", () => {
    expect(corsHeaders("https://anything.com", ["*"])["Access-Control-Allow-Origin"]).toBe("https://anything.com");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd editor/app && npx vitest run test/cors.test.ts`
Expected: FAIL — cannot find module `../src/cors`.

- [ ] **Step 3: Write minimal implementation** — create `editor/app/src/cors.ts`:

```ts
import type { NextRequest } from "next/server";

export function parseAllowedOrigins(env: string | undefined): string[] {
  return (env ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

export function corsHeaders(requestOrigin: string | null, allowed: string[]): Record<string, string> {
  const allowAll = allowed.includes("*");
  const matched = !!requestOrigin && (allowAll || allowed.includes(requestOrigin));
  if (!matched) return {};
  return {
    "Access-Control-Allow-Origin": requestOrigin as string,
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type",
    Vary: "Origin",
  };
}

export function corsForReq(req: NextRequest): Record<string, string> {
  return corsHeaders(req.headers.get("origin"), parseAllowedOrigins(process.env.EDITOR_ALLOWED_ORIGINS));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd editor/app && npx vitest run test/cors.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Login route — return token + CORS**

Edit `editor/app/app/api/auth/login/route.ts`:
- Add import: `import { corsForReq } from "../../../../src/cors";`
- Change the success response (line ~20) to include the token and CORS headers:

```ts
  const res = NextResponse.json(
    { ok: true, role: result.role, slug: result.slug, token: result.sessionId },
    { headers: corsForReq(req) }
  );
  res.cookies.set(SESSION_COOKIE, result.sessionId, sessionCookieOptions(60 * 60 * 24 * 14));
  return res;
```

- Add an OPTIONS handler at the end of the file:

```ts
export function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsForReq(req) });
}
```

- [ ] **Step 6: Add CORS + OPTIONS to the other embed routes**

For each of `overrides/route.ts`, `upload/route.ts`, `preview/route.ts`, `publish/route.ts`:
- Add `import { corsForReq } from "../../../src/cors";`
- Append the same OPTIONS handler:

```ts
export function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsForReq(req) });
}
```

- Add `{ headers: corsForReq(req) }` to each `NextResponse.json(...)` success response in those routes (the embed reads them cross-origin). Example for `overrides` PUT success: `return NextResponse.json({ ok: true }, { headers: corsForReq(req) });` and for the GET: `return NextResponse.json({ overrides: ... }, { headers: corsForReq(req) });`. Do the same for preview/publish `{ ok: true, url }` and upload `{ ok: true, url }`.

- [ ] **Step 7: Create the manifest endpoint** — create `editor/app/app/api/manifest/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../src/db";
import { sessionFromRequest, authorizeSlug } from "../../../src/session-request";
import { getManifest } from "../../../src/repo";
import { corsForReq } from "../../../src/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const db = getDb();
  const session = await sessionFromRequest(db, req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsForReq(req) });
  const slug = req.nextUrl.searchParams.get("slug") ?? "";
  if (!authorizeSlug(session, slug)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: corsForReq(req) });
  const manifest = await getManifest(db, slug);
  if (!manifest) return NextResponse.json({ error: "Unknown client" }, { status: 404, headers: corsForReq(req) });
  return NextResponse.json({ manifest }, { headers: corsForReq(req) });
}

export function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsForReq(req) });
}
```

- [ ] **Step 8: Typecheck + full app suite**

Run: `cd editor/app && npm run typecheck` — Expected: 0 errors.
Run: `cd editor/app && npm test` — Expected: PASS (includes new cors test; existing tests unaffected).

- [ ] **Step 9: Commit**

```bash
git add editor/app/src/cors.ts editor/app/test/cors.test.ts editor/app/app/api
git commit -m "feat(app): CORS + bearer-friendly responses, login token, GET /api/manifest"
```

---

### Task 4: Backend — seed the operator into the DB; make DB password authoritative

**Files:**
- Modify: `editor/app/src/auth.ts`
- Modify: `editor/app/test/auth.test.ts`

**Interfaces:**
- Consumes: `findCredential`, `setCredential` (existing repo fns).
- Produces: `seedOperator(db: Queryable): Promise<void>` — inserts an `operator` credential row (slug `null`) from `OPERATOR_USERNAME`/`OPERATOR_PASSWORD_HASH` **only if no row for that username exists**. `login()` now resolves any credential row first (DB authoritative), falling back to the env operator only when no row exists yet.

- [ ] **Step 1: Write the failing test** — append to `editor/app/test/auth.test.ts`:

```ts
import { seedOperator } from "../src/auth";

describe("operator seeding + DB-authoritative login", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("seeds the operator row once and is idempotent", async () => {
    const db = await makeTestDb();
    vi.stubEnv("OPERATOR_USERNAME", "michael");
    vi.stubEnv("OPERATOR_PASSWORD_HASH", await hashPassword("oppass"));
    await seedOperator(db);
    await seedOperator(db);
    const cred = await repo.findCredential(db, "michael");
    expect(cred?.role).toBe("operator");
    expect(cred?.slug).toBeNull();
  });

  it("does not overwrite a changed operator password on re-seed", async () => {
    const db = await makeTestDb();
    vi.stubEnv("OPERATOR_USERNAME", "michael");
    vi.stubEnv("OPERATOR_PASSWORD_HASH", await hashPassword("oppass"));
    await seedOperator(db);
    await repo.setCredential(db, { username: "michael", slug: null, role: "operator", passwordHash: await hashPassword("newpass") });
    await seedOperator(db); // must not reset to env hash
    expect(await login(db, "michael", "newpass")).not.toBeNull();
    expect(await login(db, "michael", "oppass")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd editor/app && npx vitest run test/auth.test.ts`
Expected: FAIL — `seedOperator` is not exported.

- [ ] **Step 3: Write minimal implementation** — in `editor/app/src/auth.ts`, add `seedOperator` and rewrite `login`:

```ts
export async function seedOperator(db: Queryable): Promise<void> {
  const envUser = process.env.OPERATOR_USERNAME;
  const envHash = process.env.OPERATOR_PASSWORD_HASH;
  if (!envUser || !envHash) return;
  const existing = await findCredential(db, envUser);
  if (existing) return;
  await setCredential(db, { username: envUser, slug: null, role: "operator", passwordHash: envHash });
}

export async function login(db: Queryable, username: string, password: string, now: number = Date.now()): Promise<LoginResult | null> {
  await seedOperator(db);

  let role: string;
  let slug: string | null;
  let resolvedUsername: string;
  let hash: string;

  const cred = await findCredential(db, username);
  if (cred) {
    role = cred.role; slug = cred.slug; resolvedUsername = cred.username; hash = cred.password_hash;
  } else {
    const envUser = process.env.OPERATOR_USERNAME;
    const envHash = process.env.OPERATOR_PASSWORD_HASH;
    if (envUser && envHash && username === envUser) {
      role = "operator"; slug = null; resolvedUsername = envUser; hash = envHash;
    } else {
      return null;
    }
  }

  if (!(await verifyPassword(password, hash))) return null;

  const sessionId = randomUUID();
  await createSession(db, { id: sessionId, username: resolvedUsername, slug, role, expiresAt: new Date(now + SESSION_TTL_MS) });
  return { sessionId, role, slug };
}
```

Note: `OPERATOR_PASSWORD_HASH` is already a bcrypt hash — store it directly (do not re-hash). Add `import { setCredential } from "./repo";` to the existing repo import line (`findCredential, createSession, getSessionRow` already imported).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd editor/app && npx vitest run test/auth.test.ts`
Expected: PASS (new tests + all existing operator/client tests still green).

- [ ] **Step 5: Commit**

```bash
git add editor/app/src/auth.ts editor/app/test/auth.test.ts
git commit -m "feat(app): seed operator credential into DB; DB password authoritative"
```

---

### Task 5: Backend — admin changes own password

**Files:**
- Modify: `editor/app/src/auth.ts`
- Modify: `editor/app/test/auth.test.ts`
- Create: `editor/app/app/api/account/password/route.ts`

**Interfaces:**
- Produces: `changeOperatorPassword(db, username: string, currentPassword: string, newPassword: string): Promise<boolean>` — returns false on missing/non-operator credential or wrong current password; otherwise updates the hash and returns true.
- Produces: `PUT /api/account/password` — operator session required; body `{ currentPassword, newPassword (min 8) }`.

- [ ] **Step 1: Write the failing test** — append to `editor/app/test/auth.test.ts`:

```ts
import { changeOperatorPassword } from "../src/auth";

describe("changeOperatorPassword", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("rotates the operator password when the current one is correct", async () => {
    const db = await makeTestDb();
    vi.stubEnv("OPERATOR_USERNAME", "michael");
    vi.stubEnv("OPERATOR_PASSWORD_HASH", await hashPassword("oppass"));
    await seedOperator(db);
    expect(await changeOperatorPassword(db, "michael", "oppass", "brandnew8")).toBe(true);
    expect(await login(db, "michael", "brandnew8")).not.toBeNull();
    expect(await login(db, "michael", "oppass")).toBeNull();
  });

  it("rejects a wrong current password", async () => {
    const db = await makeTestDb();
    vi.stubEnv("OPERATOR_USERNAME", "michael");
    vi.stubEnv("OPERATOR_PASSWORD_HASH", await hashPassword("oppass"));
    await seedOperator(db);
    expect(await changeOperatorPassword(db, "michael", "WRONG", "brandnew8")).toBe(false);
  });

  it("refuses to change a non-operator credential", async () => {
    const db = await makeTestDb();
    await repo.setCredential(db, { username: "acme", slug: "acme", role: "client", passwordHash: await hashPassword("pw") });
    expect(await changeOperatorPassword(db, "acme", "pw", "brandnew8")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd editor/app && npx vitest run test/auth.test.ts`
Expected: FAIL — `changeOperatorPassword` is not exported.

- [ ] **Step 3: Write minimal implementation** — add to `editor/app/src/auth.ts`:

```ts
export async function changeOperatorPassword(
  db: Queryable, username: string, currentPassword: string, newPassword: string
): Promise<boolean> {
  await seedOperator(db);
  const cred = await findCredential(db, username);
  if (!cred || cred.role !== "operator") return false;
  if (!(await verifyPassword(currentPassword, cred.password_hash))) return false;
  await setCredential(db, { username: cred.username, slug: null, role: "operator", passwordHash: await hashPassword(newPassword) });
  return true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd editor/app && npx vitest run test/auth.test.ts`
Expected: PASS.

- [ ] **Step 5: Create the route** — create `editor/app/app/api/account/password/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "../../../../src/db";
import { sessionFromRequest } from "../../../../src/session-request";
import { changeOperatorPassword } from "../../../../src/auth";
import { corsForReq } from "../../../../src/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8) });

export async function PUT(req: NextRequest) {
  const db = getDb();
  const session = await sessionFromRequest(db, req);
  if (!session || session.role !== "operator") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsForReq(req) });
  }
  let body;
  try { body = Body.parse(await req.json()); }
  catch { return NextResponse.json({ error: "Invalid" }, { status: 400, headers: corsForReq(req) }); }

  const ok = await changeOperatorPassword(db, session.username, body.currentPassword, body.newPassword);
  if (!ok) return NextResponse.json({ error: "Current password incorrect" }, { status: 403, headers: corsForReq(req) });
  return NextResponse.json({ ok: true }, { headers: corsForReq(req) });
}

export function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsForReq(req) });
}
```

- [ ] **Step 6: Typecheck + commit**

Run: `cd editor/app && npm run typecheck` — Expected: 0 errors.

```bash
git add editor/app/src/auth.ts editor/app/test/auth.test.ts editor/app/app/api/account
git commit -m "feat(app): admin change-own-password (changeOperatorPassword + PUT /api/account/password)"
```

---

### Task 6: Embed — core modules (api, editable, ui)

**Files:**
- Create: `editor/app/src/embed/api.ts`
- Create: `editor/app/src/embed/editable.ts`
- Create: `editor/app/src/embed/ui.ts`
- Create tests: `editor/app/test/embed-api.test.ts`, `editor/app/test/embed-editable.test.ts`, `editor/app/test/embed-ui.test.ts`

**Interfaces:**
- Produces `createApi(base: string, getToken: () => string | null): EditorApi` with methods `login`, `getManifest`, `getOverrides`, `putOverride`, `upload`, `preview`, `publish` (all send `Authorization: Bearer <token>` when a token exists).
- Produces `wireEditable(doc: Document, manifest: Manifest, role: "operator" | "client", handlers: { onText(id, value): void; onImagePick(id, el: HTMLImageElement): void }): number` — makes text fields `contenteditable` and images click-to-pick for editable fields only; returns count wired. Uses `visibleFields` from `../view` (no duplicated permission logic).
- Produces `renderLogin(root, onSubmit, onError?)`, `renderActionBar(root, { onPreview, onPublish, onExit }) => { setStatus(s) }`, `renderColorControls(root, fields, onColor)`.

- [ ] **Step 1: Write the failing tests**

Create `editor/app/test/embed-api.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { createApi } from "../src/embed/api";

afterEach(() => vi.unstubAllGlobals());

describe("embed api", () => {
  it("login posts credentials and returns role/slug/token", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, role: "client", slug: "acme", token: "tok" }) }));
    vi.stubGlobal("fetch", fetchMock);
    const api = createApi("https://editor.example.com", () => null);
    const r = await api.login("acme", "pw");
    expect(r).toEqual({ role: "client", slug: "acme", token: "tok" });
    expect(fetchMock.mock.calls[0][0]).toBe("https://editor.example.com/api/auth/login");
  });

  it("login returns null on 401", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => ({ error: "Invalid credentials" }) })));
    const api = createApi("https://e.com", () => null);
    expect(await api.login("x", "y")).toBeNull();
  });

  it("putOverride sends the bearer token", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) }));
    vi.stubGlobal("fetch", fetchMock);
    const api = createApi("https://e.com", () => "tok123");
    await api.putOverride("acme", "f1", "hello");
    const [, init] = fetchMock.mock.calls[0];
    expect((init as any).method).toBe("PUT");
    expect((init as any).headers.Authorization).toBe("Bearer tok123");
    expect(JSON.parse((init as any).body)).toEqual({ slug: "acme", fieldId: "f1", value: "hello" });
  });
});
```

Create `editor/app/test/embed-editable.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { wireEditable } from "../src/embed/editable";

const manifest: any = {
  slug: "acme", tier: "Text only",
  fields: [
    { id: "h1", page: "index.html", section: "hero", label: "Headline", type: "text", value: "Old", clientEditable: true },
    { id: "logo", page: "index.html", section: "hero", label: "Logo", type: "image", value: "/a.png", clientEditable: false },
  ],
};

function buildDoc() {
  document.body.innerHTML = `<h1 data-edit="h1">Old</h1><img data-edit="logo" src="/a.png">`;
  return document;
}

describe("wireEditable", () => {
  it("makes a client-editable text field contenteditable and saves on blur", () => {
    const doc = buildDoc();
    const onText = vi.fn();
    const n = wireEditable(doc, manifest, "client", { onText, onImagePick: vi.fn() });
    expect(n).toBe(1); // only h1 (logo not clientEditable for a client)
    const h1 = doc.querySelector('[data-edit="h1"]') as HTMLElement;
    expect(h1.getAttribute("contenteditable")).toBe("true");
    h1.textContent = "New";
    h1.dispatchEvent(new Event("blur"));
    expect(onText).toHaveBeenCalledWith("h1", "New");
  });

  it("an operator can edit all fields including the image", () => {
    const doc = buildDoc();
    const onImagePick = vi.fn();
    const n = wireEditable(doc, manifest, "operator", { onText: vi.fn(), onImagePick });
    expect(n).toBe(2);
    (doc.querySelector('[data-edit="logo"]') as HTMLElement).click();
    expect(onImagePick).toHaveBeenCalledWith("logo", expect.anything());
  });
});
```

Create `editor/app/test/embed-ui.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderLogin, renderActionBar } from "../src/embed/ui";

describe("embed ui", () => {
  it("renderLogin submits username + password", () => {
    const root = document.createElement("div"); document.body.appendChild(root);
    const onSubmit = vi.fn();
    renderLogin(root, onSubmit);
    (root.querySelector('[data-embed="username"]') as HTMLInputElement).value = "acme";
    (root.querySelector('[data-embed="password"]') as HTMLInputElement).value = "pw";
    (root.querySelector('[data-embed="signin"]') as HTMLButtonElement).click();
    expect(onSubmit).toHaveBeenCalledWith("acme", "pw");
  });

  it("renderActionBar wires buttons and setStatus", () => {
    const root = document.createElement("div"); document.body.appendChild(root);
    const onPublish = vi.fn();
    const bar = renderActionBar(root, { onPreview: vi.fn(), onPublish, onExit: vi.fn() });
    (root.querySelector('[data-embed="publish"]') as HTMLButtonElement).click();
    expect(onPublish).toHaveBeenCalled();
    bar.setStatus("Saved");
    expect(root.querySelector('[data-embed="status"]')!.textContent).toBe("Saved");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd editor/app && npx vitest run test/embed-api.test.ts test/embed-editable.test.ts test/embed-ui.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `editor/app/src/embed/api.ts`**

```ts
export interface LoginResult { role: string; slug: string | null; token: string; }
export interface EditorApi {
  login(username: string, password: string): Promise<LoginResult | null>;
  getManifest(slug: string): Promise<any | null>;
  getOverrides(slug: string): Promise<Record<string, any>>;
  putOverride(slug: string, fieldId: string, value: any): Promise<boolean>;
  upload(slug: string, fieldId: string, file: File): Promise<string | null>;
  preview(slug: string): Promise<string | null>;
  publish(slug: string): Promise<string | null>;
}

export function createApi(base: string, getToken: () => string | null): EditorApi {
  const url = (p: string) => `${base.replace(/\/$/, "")}${p}`;
  function headers(json = true): Record<string, string> {
    const h: Record<string, string> = {};
    if (json) h["content-type"] = "application/json";
    const t = getToken();
    if (t) h["Authorization"] = `Bearer ${t}`;
    return h;
  }
  return {
    async login(username, password) {
      const res = await fetch(url("/api/auth/login"), { method: "POST", headers: headers(), body: JSON.stringify({ username, password }) });
      if (!res.ok) return null;
      const j = await res.json();
      return { role: j.role, slug: j.slug, token: j.token };
    },
    async getManifest(slug) {
      const res = await fetch(url(`/api/manifest?slug=${encodeURIComponent(slug)}`), { headers: headers(false) });
      if (!res.ok) return null;
      return (await res.json()).manifest;
    },
    async getOverrides(slug) {
      const res = await fetch(url(`/api/overrides?slug=${encodeURIComponent(slug)}`), { headers: headers(false) });
      if (!res.ok) return {};
      return (await res.json()).overrides ?? {};
    },
    async putOverride(slug, fieldId, value) {
      const res = await fetch(url("/api/overrides"), { method: "PUT", headers: headers(), body: JSON.stringify({ slug, fieldId, value }) });
      return res.ok;
    },
    async upload(slug, fieldId, file) {
      const fd = new FormData(); fd.set("slug", slug); fd.set("fieldId", fieldId); fd.set("file", file);
      const res = await fetch(url("/api/upload"), { method: "POST", headers: headers(false), body: fd });
      if (!res.ok) return null;
      return (await res.json()).url ?? null;
    },
    async preview(slug) {
      const res = await fetch(url("/api/preview"), { method: "POST", headers: headers(), body: JSON.stringify({ slug }) });
      if (!res.ok) return null;
      return (await res.json()).url ?? null;
    },
    async publish(slug) {
      const res = await fetch(url("/api/publish"), { method: "POST", headers: headers(), body: JSON.stringify({ slug }) });
      if (!res.ok) return null;
      return (await res.json()).url ?? null;
    },
  };
}
```

- [ ] **Step 4: Implement `editor/app/src/embed/editable.ts`**

```ts
import type { Manifest } from "@action-studio/editor-engine";
import { visibleFields } from "../view";

export interface EditHandlers {
  onText(fieldId: string, value: string): void;
  onImagePick(fieldId: string, el: HTMLImageElement): void;
}

export function wireEditable(
  doc: Document, manifest: Manifest, role: "operator" | "client", handlers: EditHandlers
): number {
  let wired = 0;
  for (const f of visibleFields(manifest, role)) {
    const el = doc.querySelector(`[data-edit="${f.id}"]`);
    if (!el) continue;
    if (f.type === "text" || f.type === "richtext") {
      const node = el as HTMLElement;
      node.setAttribute("contenteditable", "true");
      node.style.outline = "1px dashed rgba(59,130,246,.6)";
      node.addEventListener("blur", () => handlers.onText(f.id, node.textContent ?? ""));
      wired++;
    } else if (f.type === "image") {
      const img = el as HTMLImageElement;
      img.style.cursor = "pointer";
      img.style.outline = "1px dashed rgba(59,130,246,.6)";
      img.addEventListener("click", () => handlers.onImagePick(f.id, img));
      wired++;
    }
  }
  return wired;
}
```

- [ ] **Step 5: Implement `editor/app/src/embed/ui.ts`**

```ts
const BAR_STYLE = "position:fixed;bottom:16px;right:16px;z-index:2147483647;display:flex;gap:8px;align-items:center;background:#111;color:#fff;padding:10px 14px;border-radius:8px;font:600 13px system-ui";
const OVERLAY_STYLE = "position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.5)";
const CARD_STYLE = "background:#fff;color:#111;padding:24px;border-radius:10px;font:14px system-ui;display:flex;flex-direction:column;gap:10px;min-width:280px";

export function renderLogin(root: HTMLElement, onSubmit: (u: string, p: string) => void, onError?: () => void): { showError(msg: string): void; remove(): void } {
  const overlay = document.createElement("div"); overlay.setAttribute("style", OVERLAY_STYLE); overlay.setAttribute("data-embed", "login");
  overlay.innerHTML =
    `<div style="${CARD_STYLE}"><strong>Sign in to edit</strong>` +
    `<input data-embed="username" placeholder="Username" style="padding:8px;border:1px solid #ccc;border-radius:6px">` +
    `<input data-embed="password" type="password" placeholder="Password" style="padding:8px;border:1px solid #ccc;border-radius:6px">` +
    `<button data-embed="signin" style="padding:8px;background:#111;color:#fff;border:0;border-radius:6px;cursor:pointer">Sign in</button>` +
    `<span data-embed="error" style="color:#b00;font-size:12px"></span></div>`;
  root.appendChild(overlay);
  overlay.querySelector('[data-embed="signin"]')!.addEventListener("click", () => {
    const u = (overlay.querySelector('[data-embed="username"]') as HTMLInputElement).value;
    const p = (overlay.querySelector('[data-embed="password"]') as HTMLInputElement).value;
    onSubmit(u, p);
  });
  return {
    showError(msg) { (overlay.querySelector('[data-embed="error"]') as HTMLElement).textContent = msg; onError?.(); },
    remove() { overlay.remove(); },
  };
}

export function renderActionBar(root: HTMLElement, opts: { onPreview(): void; onPublish(): void; onExit(): void }): { setStatus(s: string): void } {
  const bar = document.createElement("div"); bar.setAttribute("style", BAR_STYLE); bar.setAttribute("data-embed", "bar");
  bar.innerHTML =
    `<span data-embed="status" style="opacity:.8">Ready</span>` +
    `<button data-embed="preview" style="cursor:pointer">Preview</button>` +
    `<button data-embed="publish" style="cursor:pointer">Publish</button>` +
    `<button data-embed="exit" style="cursor:pointer">Exit</button>`;
  root.appendChild(bar);
  bar.querySelector('[data-embed="preview"]')!.addEventListener("click", opts.onPreview);
  bar.querySelector('[data-embed="publish"]')!.addEventListener("click", opts.onPublish);
  bar.querySelector('[data-embed="exit"]')!.addEventListener("click", opts.onExit);
  return { setStatus(s) { (bar.querySelector('[data-embed="status"]') as HTMLElement).textContent = s; } };
}

export function renderColorControls(root: HTMLElement, fields: { id: string; label: string; value: string }[], onColor: (id: string, value: string) => void): void {
  if (!fields.length) return;
  const box = document.createElement("div");
  box.setAttribute("style", "position:fixed;bottom:64px;right:16px;z-index:2147483647;background:#fff;color:#111;padding:10px;border-radius:8px;font:12px system-ui;display:flex;flex-direction:column;gap:6px");
  box.setAttribute("data-embed", "colors");
  for (const f of fields) {
    const row = document.createElement("label"); row.style.display = "flex"; row.style.gap = "6px"; row.style.alignItems = "center";
    const input = document.createElement("input"); input.type = "color"; input.value = f.value; input.setAttribute("data-embed", `color-${f.id}`);
    input.addEventListener("change", () => onColor(f.id, input.value));
    row.append(input, document.createTextNode(f.label));
    box.appendChild(row);
  }
  root.appendChild(box);
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd editor/app && npx vitest run test/embed-api.test.ts test/embed-editable.test.ts test/embed-ui.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add editor/app/src/embed editor/app/test/embed-*.test.ts
git commit -m "feat(embed): api client, in-place editable wiring, login/action-bar/color UI"
```

---

### Task 7: Embed — boot orchestrator + esbuild bundle to `public/embed.js`

**Files:**
- Create: `editor/app/src/embed/index.ts`
- Create test: `editor/app/test/embed-boot.test.ts`
- Modify: `editor/app/package.json` (devDependency `esbuild`, scripts)
- Modify: `editor/app/.gitignore` (ignore `public/embed.js`)

**Interfaces:**
- Consumes: `createApi`, `wireEditable`, `renderLogin`, `renderActionBar`, `renderColorControls`.
- Produces: `boot(doc?: Document): Promise<void>` — reads `data-editor`/`data-slug` from the embed script tag, shows login, then wires editing + action bar. Auto-runs on load unless `window.__EDITOR_NO_BOOT__` is set (so tests can import without auto-booting).

- [ ] **Step 1: Write the failing test** — create `editor/app/test/embed-boot.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

beforeEach(() => { (globalThis as any).window.__EDITOR_NO_BOOT__ = true; });
afterEach(() => { vi.unstubAllGlobals(); document.body.innerHTML = ""; });

describe("embed boot", () => {
  it("shows login, then wires editing after a successful login", async () => {
    document.body.innerHTML =
      `<h1 data-edit="h1">Old</h1>` +
      `<script data-editor-embed data-editor="https://editor.example.com" data-slug="acme"></script>`;
    const fetchMock = vi.fn(async (u: string) => {
      if (u.endsWith("/api/auth/login")) return { ok: true, json: async () => ({ ok: true, role: "operator", slug: null, token: "tok" }) } as any;
      if (u.includes("/api/manifest")) return { ok: true, json: async () => ({ manifest: { slug: "acme", tier: "Everything", fields: [{ id: "h1", page: "index.html", section: "hero", label: "H", type: "text", value: "Old", clientEditable: true }] } }) } as any;
      if (u.includes("/api/overrides")) return { ok: true, json: async () => ({ overrides: {} }) } as any;
      return { ok: true, json: async () => ({ ok: true }) } as any;
    });
    vi.stubGlobal("fetch", fetchMock);

    const { boot } = await import("../src/embed/index");
    await boot(document);

    expect(document.querySelector('[data-embed="login"]')).toBeTruthy();
    (document.querySelector('[data-embed="username"]') as HTMLInputElement).value = "michael";
    (document.querySelector('[data-embed="password"]') as HTMLInputElement).value = "pw";
    (document.querySelector('[data-embed="signin"]') as HTMLButtonElement).click();

    await vi.waitFor(() => {
      expect(document.querySelector('[data-embed="bar"]')).toBeTruthy();
      expect((document.querySelector('[data-edit="h1"]') as HTMLElement).getAttribute("contenteditable")).toBe("true");
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd editor/app && npx vitest run test/embed-boot.test.ts`
Expected: FAIL — module `../src/embed/index` not found.

- [ ] **Step 3: Implement `editor/app/src/embed/index.ts`**

```ts
import { createApi } from "./api";
import { wireEditable } from "./editable";
import { renderLogin, renderActionBar, renderColorControls } from "./ui";

export async function boot(doc: Document = document): Promise<void> {
  const script = doc.querySelector("script[data-editor-embed], script[data-editor]") as HTMLScriptElement | null;
  const base = script?.getAttribute("data-editor") ?? "";
  const slug = script?.getAttribute("data-slug") ?? "";
  if (!base || !slug) return;

  const TOKEN_KEY = `editor_token_${slug}`;
  const ROLE_KEY = `editor_role_${slug}`;
  const getToken = () => sessionStorage.getItem(TOKEN_KEY);
  const api = createApi(base, getToken);

  const root = doc.createElement("div");
  root.id = "__editor_root";
  doc.body.appendChild(root);

  async function startEditing(role: "operator" | "client") {
    const manifest = await api.getManifest(slug);
    if (!manifest) return;
    const overrides = await api.getOverrides(slug);

    const bar = renderActionBar(root, {
      onPreview: async () => { bar.setStatus("Building preview…"); const u = await api.preview(slug); bar.setStatus(u ? `Preview: ${u}` : "Preview failed"); if (u) window.open(u, "_blank"); },
      onPublish: async () => { bar.setStatus("Publishing…"); const u = await api.publish(slug); bar.setStatus(u ? "Published — your site is updating." : "Publish failed"); },
      onExit: () => { sessionStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(ROLE_KEY); const url = new URL(location.href); url.searchParams.delete("edit"); location.href = url.toString().replace(/#edit$/, ""); },
    });

    wireEditable(doc, manifest, role, {
      onText: async (id, value) => { bar.setStatus("Saving…"); const ok = await api.putOverride(slug, id, value); bar.setStatus(ok ? "Saved" : "You don't have permission to edit this"); },
      onImagePick: (id, el) => {
        const input = doc.createElement("input"); input.type = "file"; input.accept = "image/*";
        input.addEventListener("change", async () => {
          const file = input.files?.[0]; if (!file) return;
          bar.setStatus("Uploading…");
          const url = await api.upload(slug, id, file);
          if (url) { el.src = url; bar.setStatus("Saved"); } else { bar.setStatus("Upload failed"); }
        });
        input.click();
      },
    });

    const colorFields = (manifest.fields as any[])
      .filter((f) => f.type === "color" && (role === "operator" || f.clientEditable))
      .map((f) => ({ id: f.id, label: f.label, value: String(overrides[f.id] ?? f.value) }));
    renderColorControls(root, colorFields, async (id, value) => { bar.setStatus("Saving…"); const ok = await api.putOverride(slug, id, value); bar.setStatus(ok ? "Saved" : "Permission denied"); });
  }

  const login = renderLogin(root, async (u, p) => {
    const r = await api.login(u, p);
    if (!r) { login.showError("Invalid credentials"); return; }
    sessionStorage.setItem(TOKEN_KEY, r.token);
    const role = r.role === "operator" ? "operator" : "client";
    sessionStorage.setItem(ROLE_KEY, role);
    login.remove();
    await startEditing(role);
  });

  // Resume an existing session without re-login.
  const existing = getToken();
  if (existing) {
    const role = (sessionStorage.getItem(ROLE_KEY) === "operator" ? "operator" : "client");
    login.remove();
    await startEditing(role);
  }
}

if (typeof window !== "undefined" && !(window as any).__EDITOR_NO_BOOT__) {
  boot();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd editor/app && npx vitest run test/embed-boot.test.ts`
Expected: PASS.

- [ ] **Step 5: Add esbuild + bundle scripts**

Run: `cd editor/app && npm install --save-dev esbuild@^0.24.0`
Edit `editor/app/package.json` scripts:

```json
    "build:embed": "esbuild src/embed/index.ts --bundle --format=iife --platform=browser --outfile=public/embed.js",
    "build": "npm run build:embed && next build",
    "dev": "npm run build:embed && next dev",
```

(Replace the existing `dev` and `build` lines; add `build:embed`.)

Edit `editor/app/.gitignore`: add a line `public/embed.js`.

- [ ] **Step 6: Build the embed and verify the artifact**

Run: `cd editor/app && npm run build:embed`
Run: `test -f public/embed.js && grep -c "renderLogin\|getElementById\|__editor_root" public/embed.js`
Expected: file exists; grep count ≥ 1 (bundle contains the boot code).

- [ ] **Step 7: Typecheck + full app suite**

Run: `cd editor/app && npm run typecheck` — Expected: 0 errors.
Run: `cd editor/app && npm test` — Expected: PASS (all embed tests included).

- [ ] **Step 8: Commit**

```bash
git add editor/app/src/embed/index.ts editor/app/test/embed-boot.test.ts editor/app/package.json editor/app/package-lock.json editor/app/.gitignore
git commit -m "feat(embed): boot orchestrator + esbuild bundle served at /embed.js"
```

---

### Task 8: Admin — invite text helper

**Files:**
- Create: `editor/app/src/invite.ts`
- Create test: `editor/app/test/invite.test.ts`

**Interfaces:**
- Produces: `buildInvite(p: { link: string; username: string; password: string }): { text: string; mailto: string }`.

- [ ] **Step 1: Write the failing test** — create `editor/app/test/invite.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildInvite } from "../src/invite";

describe("buildInvite", () => {
  it("includes link, username, and password in the text", () => {
    const { text } = buildInvite({ link: "https://acme.actiondesignstudio.com/?edit", username: "acme", password: "s3cret88" });
    expect(text).toContain("https://acme.actiondesignstudio.com/?edit");
    expect(text).toContain("acme");
    expect(text).toContain("s3cret88");
  });

  it("produces a mailto: with encoded subject and body", () => {
    const { mailto } = buildInvite({ link: "https://x/?edit", username: "u", password: "p" });
    expect(mailto.startsWith("mailto:?subject=")).toBe(true);
    expect(mailto).toContain("body=");
    expect(mailto).toContain(encodeURIComponent("https://x/?edit"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd editor/app && npx vitest run test/invite.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation** — create `editor/app/src/invite.ts`:

```ts
export interface InviteParts { link: string; username: string; password: string; }

export function buildInvite(p: InviteParts): { text: string; mailto: string } {
  const text =
    `You can now edit your website.\n\n` +
    `Edit link: ${p.link}\n` +
    `Username: ${p.username}\n` +
    `Password: ${p.password}\n\n` +
    `Open the link, click "Sign in", and enter the username and password above.`;
  const subject = "Your website editing access";
  const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
  return { text, mailto };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd editor/app && npx vitest run test/invite.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add editor/app/src/invite.ts editor/app/test/invite.test.ts
git commit -m "feat(app): buildInvite helper (copy text + mailto)"
```

---

### Task 9: Admin panel — invite block + change-my-password

**Files:**
- Modify: `editor/app/app/admin/[slug]/AdminPanel.tsx`
- Modify: `editor/app/app/admin/[slug]/page.tsx`
- Modify: `editor/app/test/AdminPanel.test.tsx`

**Interfaces:**
- Consumes: `buildInvite` (Task 8).
- Produces: `AdminPanel` now takes an extra prop `siteUrl: string` and renders (a) an invite block after a client password is set, (b) a "Change my password" section calling `PUT /api/account/password`.

- [ ] **Step 1: Write the failing tests** — replace `editor/app/test/AdminPanel.test.tsx` contents:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import AdminPanel from "../app/admin/[slug]/AdminPanel";

afterEach(cleanup);

describe("AdminPanel", () => {
  beforeEach(() => { vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, tier: "Text + Pictures" }) }))); });
  afterEach(() => vi.unstubAllGlobals());

  it("saving permissions posts the selected tier + per-field map", async () => {
    render(<AdminPanel slug="acme" tier="Text only" siteUrl="https://acme.actiondesignstudio.com" fields={[{ id: "c", label: "primary", type: "color", clientEditable: false }]} />);
    fireEvent.change(screen.getByTestId("tier-select"), { target: { value: "Text + Pictures" } });
    fireEvent.click(screen.getByTestId("pf-c"));
    fireEvent.click(screen.getByText("Save permissions"));
    await waitFor(() => {
      const call = (globalThis.fetch as any).mock.calls.find((c: any[]) => c[0] === "/api/admin/permissions");
      expect(JSON.parse(call[1].body)).toEqual({ slug: "acme", tier: "Text + Pictures", perField: { c: true } });
    });
  });

  it("setting a client password reveals an invite with the link, username and password", async () => {
    render(<AdminPanel slug="acme" tier="Text only" siteUrl="https://acme.actiondesignstudio.com" fields={[]} />);
    fireEvent.change(screen.getByTestId("client-pw"), { target: { value: "s3cret88" } });
    fireEvent.click(screen.getByText("Set password"));
    await waitFor(() => {
      const invite = screen.getByTestId("invite-text").textContent ?? "";
      expect(invite).toContain("https://acme.actiondesignstudio.com/?edit");
      expect(invite).toContain("acme");
      expect(invite).toContain("s3cret88");
    });
    expect((screen.getByTestId("invite-mailto") as HTMLAnchorElement).getAttribute("href")!.startsWith("mailto:")).toBe(true);
  });

  it("change-my-password posts current + new to /api/account/password", async () => {
    render(<AdminPanel slug="acme" tier="Text only" siteUrl="https://acme.actiondesignstudio.com" fields={[]} />);
    fireEvent.change(screen.getByTestId("cur-pw"), { target: { value: "old" } });
    fireEvent.change(screen.getByTestId("new-pw"), { target: { value: "newpass8" } });
    fireEvent.click(screen.getByText("Change my password"));
    await waitFor(() => {
      const call = (globalThis.fetch as any).mock.calls.find((c: any[]) => c[0] === "/api/account/password");
      expect(call[1].method).toBe("PUT");
      expect(JSON.parse(call[1].body)).toEqual({ currentPassword: "old", newPassword: "newpass8" });
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd editor/app && npx vitest run test/AdminPanel.test.tsx`
Expected: FAIL — `client-pw`/`invite-text`/`cur-pw` test IDs don't exist; `siteUrl` prop unused.

- [ ] **Step 3: Rewrite `editor/app/app/admin/[slug]/AdminPanel.tsx`**

```tsx
"use client";
import { useState } from "react";
import { buildInvite } from "../../../src/invite";

const TIERS = ["Text only", "Text + Pictures", "Text + Pictures + Colours", "Everything"] as const;
type FieldLite = { id: string; label: string; type: string; clientEditable: boolean };

export default function AdminPanel({ slug, tier, siteUrl, fields }: { slug: string; tier: string; siteUrl: string; fields: FieldLite[] }) {
  const [sel, setSel] = useState<string>((TIERS as readonly string[]).includes(tier) ? tier : TIERS[0]);
  const [perField, setPerField] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState("");
  const [pw, setPw] = useState(""); const [pwMsg, setPwMsg] = useState("");
  const [invite, setInvite] = useState<{ text: string; mailto: string } | null>(null);
  const [curPw, setCurPw] = useState(""); const [newPw, setNewPw] = useState(""); const [accountMsg, setAccountMsg] = useState("");

  async function savePerms() {
    setMsg("Saving…");
    const res = await fetch("/api/admin/permissions", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug, tier: sel, perField }),
    });
    const j = await res.json();
    setMsg(res.ok ? `Saved (tier: ${j.tier})` : `Error: ${j.error}`);
  }

  async function setPassword() {
    const res = await fetch("/api/admin/credentials", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: slug, slug, password: pw }),
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok) {
      setPwMsg("Password set.");
      setInvite(buildInvite({ link: `${siteUrl.replace(/\/$/, "")}/?edit`, username: slug, password: pw }));
    } else {
      setPwMsg(`Failed: ${j.error ?? res.status}`); setInvite(null);
    }
  }

  async function changeMyPassword() {
    setAccountMsg("Updating…");
    const res = await fetch("/api/account/password", {
      method: "PUT", headers: { "content-type": "application/json" },
      body: JSON.stringify({ currentPassword: curPw, newPassword: newPw }),
    });
    const j = await res.json().catch(() => ({}));
    setAccountMsg(res.ok ? "Your password was changed." : `Failed: ${j.error ?? res.status}`);
    if (res.ok) { setCurPw(""); setNewPw(""); }
  }

  return (
    <main style={{ maxWidth: 760, margin: "24px auto", fontFamily: "system-ui" }}>
      <h1>Admin — {slug}</h1>

      <section>
        <h2>Permission tier</h2>
        <select value={sel} onChange={(e) => setSel(e.target.value)} data-testid="tier-select">
          {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button onClick={savePerms} style={{ marginLeft: 8 }}>Save permissions</button>
        <span style={{ marginLeft: 12 }}>{msg}</span>
        <h3>Per-field overrides</h3>
        {fields.map((f) => (
          <label key={f.id} style={{ display: "block" }}>
            <input type="checkbox" data-testid={`pf-${f.id}`}
              onChange={(e) => setPerField((p) => ({ ...p, [f.id]: e.target.checked }))} /> {f.label} <em>({f.type})</em>
          </label>
        ))}
      </section>

      <section>
        <h2>Client password &amp; invite</h2>
        <input type="text" data-testid="client-pw" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="new password (min 8)" />
        <button onClick={setPassword} disabled={pw.length < 8} style={{ marginLeft: 8 }}>Set password</button>
        <span style={{ marginLeft: 12 }}>{pwMsg}</span>
        {invite && (
          <div style={{ marginTop: 12, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
            <strong>Invite to send</strong>
            <pre data-testid="invite-text" style={{ whiteSpace: "pre-wrap", fontFamily: "system-ui", margin: "8px 0" }}>{invite.text}</pre>
            <button onClick={() => navigator.clipboard?.writeText(invite.text)}>Copy</button>
            <a data-testid="invite-mailto" href={invite.mailto} style={{ marginLeft: 8 }}>Open in email</a>
            <p style={{ fontSize: 12, color: "#777" }}>The password is only shown here, now. To re-send later, set a new password.</p>
          </div>
        )}
      </section>

      <section>
        <h2>My password</h2>
        <input type="password" data-testid="cur-pw" value={curPw} onChange={(e) => setCurPw(e.target.value)} placeholder="current password" />
        <input type="password" data-testid="new-pw" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="new password (min 8)" style={{ marginLeft: 8 }} />
        <button onClick={changeMyPassword} disabled={newPw.length < 8 || curPw.length < 1} style={{ marginLeft: 8 }}>Change my password</button>
        <span style={{ marginLeft: 12 }}>{accountMsg}</span>
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Pass `siteUrl` from the page** — edit `editor/app/app/admin/[slug]/page.tsx`:

Replace the `<AdminPanel .../>` usage (line ~27) with a computed `siteUrl`:

```tsx
  const siteUrl = client.custom_domain ?? `https://${params.slug}.actiondesignstudio.com`;

  return (
    <>
      <AdminPanel slug={params.slug} tier={client.permission_tier} siteUrl={siteUrl}
        fields={manifest.fields.map((f) => ({ id: f.id, label: f.label, type: f.type, clientEditable: f.clientEditable }))} />
      <EditorForm slug={params.slug} groups={groups} initialOverrides={overrides} />
    </>
  );
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd editor/app && npx vitest run test/AdminPanel.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Typecheck + full app suite**

Run: `cd editor/app && npm run typecheck` — Expected: 0 errors.
Run: `cd editor/app && npm test` — Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add editor/app/app/admin editor/app/test/AdminPanel.test.tsx
git commit -m "feat(admin): client invite block + admin change-own-password"
```

---

### Task 10: Wiring — env docs, README, rollout notes, final verification

**Files:**
- Modify: `.env.example`
- Modify: `editor/app/README.md`

**Interfaces:** none (documentation + verification).

- [ ] **Step 1: Document the new env vars** — append to `.env.example`:

```
# Inline editor: comma-separated site origins allowed to call the editor API cross-origin.
# Use the live site origins, e.g. https://capstone-contracting.actiondesignstudio.com,https://acme.com
# (Wildcard "*" is accepted but not recommended for production.)
EDITOR_ALLOWED_ORIGINS=
# Public base URL of the editor app (used by the factory to inject the embed loader)
EDITOR_PUBLIC_URL=
```

- [ ] **Step 2: Document the editor in the app README** — append a section to `editor/app/README.md`:

```markdown
## Inline editor (`?edit`)

Append `?edit` to any deployed site URL to load the inline editor. Sign in with your
operator credentials (edit everything) or a client's credentials (edit only granted fields).

- The factory bakes a loader into every page; on `?edit` it loads `/embed.js` from this app.
- Auth is bearer-token based (no third-party cookies). Set `EDITOR_ALLOWED_ORIGINS` to the
  site origins permitted to call the API.
- Admin password and client passwords are managed in `/admin/{slug}`. The operator credential
  is seeded from `OPERATOR_USERNAME`/`OPERATOR_PASSWORD_HASH` on first login, then changeable in-app.
- `npm run build` and `npm run dev` rebuild `public/embed.js` automatically (esbuild).
```

- [ ] **Step 3: Final full verification (both packages)**

Run: `cd editor/engine && npm run typecheck && npm test` — Expected: 0 type errors; all tests PASS.
Run: `cd editor/app && npm run build:embed && npm run typecheck && npm test` — Expected: bundle built; 0 type errors; all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add .env.example editor/app/README.md
git commit -m "docs: inline editor env vars + README usage"
```

---

## Self-Review

**Spec coverage:**
- Inline click-to-edit on the live site → Tasks 1 (loader), 6 (editable wiring), 7 (boot). ✔
- Bearer-token cross-origin auth → Task 2; CORS → Task 3. ✔
- Login returns token; manifest endpoint for the embed → Task 3. ✔
- Permission-driven editability (server is the gate) → reuses `canEditField` (overrides/upload routes, unchanged) + `visibleFields` in Task 6. ✔
- Save / Preview / Publish; client may self-publish → Task 7 action bar hits existing `/api/overrides`, `/api/preview`, `/api/publish` (no role gate on publish). ✔
- Admin changes own password (operator seeded into DB) → Tasks 4 + 5. ✔
- Admin sets/resets client password → existing `/api/admin/credentials`, surfaced in Task 9. ✔
- Copy-paste client invite (Copy + mailto, no email infra) → Tasks 8 + 9. ✔
- Build integration: publisher injects the new loader → Task 1 (publisher.ts + tests). ✔
- Rollout/env (`EDITOR_ALLOWED_ORIGINS`, seed note) → Task 10. ✔

**Placeholder scan:** No TBD/TODO; every code step has complete code; commands have expected output. ✔

**Type/name consistency:** `injectEditorEmbed(html, {editorUrl, slug})` used in engine, index export, publisher, tests. `corsForReq(req)` used across routes; `corsHeaders`/`parseAllowedOrigins` match cors.test. `seedOperator`/`changeOperatorPassword` signatures match auth.test. `createApi`/`wireEditable`/`renderLogin`/`renderActionBar`/`renderColorControls` match embed tests and boot usage. `buildInvite({link,username,password})` matches invite.test and AdminPanel. `AdminPanel` gains `siteUrl` prop — updated in component, page.tsx, and all three AdminPanel tests. Tagger attribute `data-edit` consistent in wireEditable + publisher fixture. ✔

**Scope:** Single coherent feature (inline editor + its credential/invite management), one plan. ✔

## Notes on deferred spec "open items"
- **Richtext:** implemented as plain `contenteditable` (no toolbar) — the cheap default the spec allowed.
- **embed.js serving:** static file built by esbuild into `public/` (Next serves `/embed.js`).
- **Origin allow-list:** env list (`EDITOR_ALLOWED_ORIGINS`); deriving from client records is a future option.
- **Legacy `/edit` form:** left in place as a fallback; delete after the inline editor is validated on a live client.
- **Auto-send invites:** out of scope (copy/mailto only), per the decision to send manually.
