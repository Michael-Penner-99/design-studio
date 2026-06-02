# Editor & Admin UI (Plan 2d) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the screens that make the editor usable: a login page, a client editor (fields grouped by page → section, per-type widgets, autosave, Preview/Publish), and an operator admin (permission tier + per-field toggles, credential management, the editor link) — plus image upload to Vercel Blob.

**Architecture:** Keep all decision logic in pure, node-testable helpers (`groupFields`, `visibleFields`, permission application reusing the engine). Add thin API routes for reading/writing draft overrides, updating permissions, and uploading images. React pages are server components that load data + render client components; component behavior is verified with `vitest` + `jsdom` + Testing Library. Preview/Publish reuse the Plan 2c endpoints.

**Tech Stack:** `editor/app/` (Next.js 14, `pg`/`pg-mem`, zod, vitest). New deps: `@vercel/blob`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`. Reuses engine `applyTier`/`resolveTierLabel`/`TIER_TYPES`.

**Builds on:** App spec §§1,3,5; Plans 2b (auth, repo, sessions) + 2c (preview/publish, assets) merged. **Out of scope:** section add/remove/reorder (v2), edit history.

---

## Background

- Auth/session, repo (`getManifest`, `getOverrides`, `saveOverrides`, `getClient`, `setCredential`), and `sessionFromRequest`/`authorizeSlug` exist from 2b/2c.
- Engine exports `applyTier(manifest, tier)`, `resolveTierLabel(fields, tier)`, `TIER_TYPES`, and the `Field`/`Manifest` types.
- The editor shows a client only fields with `clientEditable === true`; operators see all fields and the admin controls.
- Image fields: a widget uploads to Blob → the returned URL becomes the field's override value; `mergePages` already swaps `<img src>` from overrides.

---

## File Structure

| File | Responsibility |
|---|---|
| `editor/app/src/view.ts` | `groupFields`, `visibleFields` (pure) |
| `editor/app/src/permissions-edit.ts` | `applyPermissionChange` (pure, reuses engine) |
| `editor/app/app/api/overrides/route.ts` | GET draft, PUT one field (permission-checked) |
| `editor/app/app/api/admin/permissions/route.ts` | operator: set tier + per-field toggles |
| `editor/app/app/api/upload/route.ts` | image upload → Blob |
| `editor/app/app/login/page.tsx` | login form |
| `editor/app/app/edit/page.tsx` + `EditorForm.tsx` | client editor |
| `editor/app/app/admin/[slug]/page.tsx` + `AdminPanel.tsx` | operator admin |
| `editor/app/vitest.config.ts` | allow jsdom per-file env |

---

### Task 0: Add UI/test deps + jsdom support

**Files:** `editor/app/package.json`, `editor/app/vitest.config.ts`

- [ ] **Step 1: Add to `editor/app/package.json`** dependencies `"@vercel/blob": "^0.27.0"`; devDependencies `"@testing-library/react": "^16.0.1"`, `"@testing-library/jest-dom": "^6.5.0"`, `"jsdom": "^25.0.1"`. Run `npm install` (report resolved versions).

- [ ] **Step 2: Update `editor/app/vitest.config.ts`** so node is the default and component tests opt into jsdom via a docblock:

```ts
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { include: ["test/**/*.test.ts", "test/**/*.test.tsx"], environment: "node" },
});
```
Component test files will start with `// @vitest-environment jsdom`.

- [ ] **Step 3: Verify** `cd editor/app && npm run typecheck` (0) and `npx vitest run` (existing suite still passes). Commit:

```bash
git add editor/app/package.json editor/app/package-lock.json editor/app/vitest.config.ts
git commit -m "chore(editor-app): add Blob + Testing Library + jsdom for UI"
```

---

### Task 1: Pure view helpers

**Files:** `editor/app/src/view.ts`, `editor/app/test/view.test.ts`

- [ ] **Step 1: Write failing test** `editor/app/test/view.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { groupFields, visibleFields } from "../src/view";
import type { Manifest } from "@action-studio/editor-engine";

const m: Manifest = {
  slug: "acme", tier: "Text + Pictures",
  fields: [
    { id: "index__h1__1", page: "index.html", section: "Hero", label: "Headline", type: "text", value: "Hi", clientEditable: true },
    { id: "index__img__1", page: "index.html", section: "Hero", label: "Photo", type: "image", value: "a.jpg", clientEditable: true },
    { id: "color__primary", page: "index.html", section: "Brand Colors", label: "primary", type: "color", value: "#000", clientEditable: false },
    { id: "about__p__1", page: "about.html", section: "Story", label: "Intro", type: "text", value: "x", clientEditable: true },
  ],
};

describe("visibleFields", () => {
  it("client sees only clientEditable; operator sees all", () => {
    expect(visibleFields(m, "client").map((f) => f.id)).toEqual(["index__h1__1", "index__img__1", "about__p__1"]);
    expect(visibleFields(m, "operator")).toHaveLength(4);
  });
});

describe("groupFields", () => {
  it("groups by page then section, preserving order", () => {
    const g = groupFields(visibleFields(m, "client"));
    expect(g.map((p) => p.page)).toEqual(["index.html", "about.html"]);
    expect(g[0].sections.map((s) => s.section)).toEqual(["Hero"]);
    expect(g[0].sections[0].fields.map((f) => f.id)).toEqual(["index__h1__1", "index__img__1"]);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run test/view.test.ts` — FAIL.

- [ ] **Step 3: Write `editor/app/src/view.ts`:**

```ts
import type { Field, Manifest } from "@action-studio/editor-engine";

export function visibleFields(manifest: Manifest, role: "operator" | "client"): Field[] {
  return role === "operator" ? manifest.fields : manifest.fields.filter((f) => f.clientEditable);
}

export interface SectionGroup { section: string; fields: Field[]; }
export interface PageGroup { page: string; sections: SectionGroup[]; }

/** Group fields by page, then section, preserving first-seen order at each level. */
export function groupFields(fields: Field[]): PageGroup[] {
  const pages: PageGroup[] = [];
  for (const f of fields) {
    let page = pages.find((p) => p.page === f.page);
    if (!page) { page = { page: f.page, sections: [] }; pages.push(page); }
    let section = page.sections.find((s) => s.section === f.section);
    if (!section) { section = { section: f.section, fields: [] }; page.sections.push(section); }
    section.fields.push(f);
  }
  return pages;
}
```

- [ ] **Step 4: Run** `npx vitest run test/view.test.ts` — PASS. Commit:

```bash
git add editor/app/src/view.ts editor/app/test/view.test.ts
git commit -m "feat(editor-app): pure view helpers (visibleFields, groupFields)"
```

---

### Task 2: Overrides API (read draft, write one field)

**Files:** `editor/app/app/api/overrides/route.ts`, `editor/app/src/overrides-edit.ts`, `editor/app/test/overrides-edit.test.ts`

The permission rule (a client may only write fields marked `clientEditable`; operator may write any) is pure and tested; the route wraps it.

- [ ] **Step 1: Write failing test** `editor/app/test/overrides-edit.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { canEditField, applyFieldOverride } from "../src/overrides-edit";
import type { Manifest } from "@action-studio/editor-engine";

const m: Manifest = { slug: "acme", tier: "Text only", fields: [
  { id: "a", page: "p", section: "s", label: "A", type: "text", value: "x", clientEditable: true },
  { id: "b", page: "p", section: "s", label: "B", type: "color", value: "#000", clientEditable: false },
] };

describe("canEditField", () => {
  it("client can edit only clientEditable fields; operator any known field", () => {
    expect(canEditField(m, "client", "a")).toBe(true);
    expect(canEditField(m, "client", "b")).toBe(false);
    expect(canEditField(m, "operator", "b")).toBe(true);
    expect(canEditField(m, "operator", "unknown")).toBe(false); // field must exist
  });
});

describe("applyFieldOverride", () => {
  it("merges one field into the existing override map", () => {
    expect(applyFieldOverride({ a: "1" }, "x", "2")).toEqual({ a: "1", x: "2" });
  });
});
```

- [ ] **Step 2: Run** `npx vitest run test/overrides-edit.test.ts` — FAIL.

- [ ] **Step 3: Write `editor/app/src/overrides-edit.ts`:**

```ts
import type { Manifest, Overrides } from "@action-studio/editor-engine";

export function canEditField(manifest: Manifest, role: "operator" | "client", fieldId: string): boolean {
  const field = manifest.fields.find((f) => f.id === fieldId);
  if (!field) return false;
  return role === "operator" || field.clientEditable;
}

export function applyFieldOverride(current: Overrides, fieldId: string, value: Overrides[string]): Overrides {
  return { ...current, [fieldId]: value };
}
```

- [ ] **Step 4: Run** `npx vitest run test/overrides-edit.test.ts` — PASS.

- [ ] **Step 5: Write `editor/app/app/api/overrides/route.ts`:**

```ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { LinkValueSchema } from "@action-studio/editor-engine";
import { getDb } from "../../../src/db";
import { sessionFromRequest, authorizeSlug } from "../../../src/session-request";
import { getManifest, getOverrides, saveOverrides } from "../../../src/repo";
import { canEditField, applyFieldOverride } from "../../../src/overrides-edit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const db = getDb();
  const session = await sessionFromRequest(db, req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") ?? "";
  if (!authorizeSlug(session, slug)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ overrides: await getOverrides(db, slug, "draft") });
}

const PutBody = z.object({
  slug: z.string().min(1),
  fieldId: z.string().min(1),
  value: z.union([z.string(), LinkValueSchema]),
});

export async function PUT(req: NextRequest) {
  const db = getDb();
  const session = await sessionFromRequest(db, req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body;
  try { body = PutBody.parse(await req.json()); }
  catch { return NextResponse.json({ error: "Invalid" }, { status: 400 }); }
  if (!authorizeSlug(session, body.slug)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const manifest = await getManifest(db, body.slug);
  if (!manifest) return NextResponse.json({ error: "Unknown client" }, { status: 404 });
  const role = session.role === "operator" ? "operator" : "client";
  if (!canEditField(manifest, role, body.fieldId)) {
    return NextResponse.json({ error: "Field not editable" }, { status: 403 });
  }
  const draft = await getOverrides(db, body.slug, "draft");
  await saveOverrides(db, body.slug, "draft", applyFieldOverride(draft, body.fieldId, body.value));
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 6: Run** `npm run typecheck` (0) + full suite. Commit:

```bash
git add editor/app/src/overrides-edit.ts editor/app/test/overrides-edit.test.ts editor/app/app/api/overrides/route.ts
git commit -m "feat(editor-app): draft overrides API + permission-checked field writes"
```

---

### Task 3: Permissions API (operator sets tier + per-field)

**Files:** `editor/app/src/permissions-edit.ts`, `editor/app/test/permissions-edit.test.ts`, `editor/app/app/api/admin/permissions/route.ts`

- [ ] **Step 1: Write failing test** `editor/app/test/permissions-edit.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { applyPermissionChange } from "../src/permissions-edit";
import type { Manifest } from "@action-studio/editor-engine";

const m: Manifest = { slug: "acme", tier: "Text only", fields: [
  { id: "t", page: "p", section: "s", label: "t", type: "text", value: "x", clientEditable: true },
  { id: "c", page: "p", section: "s", label: "c", type: "color", value: "#000", clientEditable: false },
] };

describe("applyPermissionChange", () => {
  it("changing tier bulk-sets clientEditable by type", () => {
    const out = applyPermissionChange(m, { tier: "Text + Pictures + Colours" });
    expect(out.manifest.fields.every((f) => f.clientEditable)).toBe(true);
    expect(out.manifest.tier).toBe("Text + Pictures + Colours");
  });

  it("a per-field override that diverges flips the label to custom", () => {
    const out = applyPermissionChange(m, { tier: "Text only", perField: { c: true } });
    expect(out.manifest.fields.find((f) => f.id === "c")!.clientEditable).toBe(true);
    expect(out.manifest.tier).toBe("custom");
  });
});
```

- [ ] **Step 2: Run** `npx vitest run test/permissions-edit.test.ts` — FAIL.

- [ ] **Step 3: Write `editor/app/src/permissions-edit.ts`:**

```ts
import { applyTier, resolveTierLabel, type Manifest, type Tier } from "@action-studio/editor-engine";

export interface PermissionChange {
  tier: Exclude<Tier, "custom">;
  perField?: Record<string, boolean>;
}

export function applyPermissionChange(manifest: Manifest, change: PermissionChange): { manifest: Manifest } {
  const tiered = applyTier(manifest, change.tier);
  const fields = tiered.fields.map((f) =>
    change.perField && f.id in change.perField ? { ...f, clientEditable: change.perField[f.id] } : f
  );
  const label = resolveTierLabel(fields, change.tier);
  return { manifest: { ...tiered, tier: label, fields } };
}
```

- [ ] **Step 4: Run** `npx vitest run test/permissions-edit.test.ts` — PASS.

- [ ] **Step 5: Write `editor/app/app/api/admin/permissions/route.ts`** (operator session only):

```ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { TIERS } from "@action-studio/editor-engine";
import { getDb } from "../../../../src/db";
import { sessionFromRequest } from "../../../../src/session-request";
import { getManifest, saveManifest, upsertClient, getClient } from "../../../../src/repo";
import { applyPermissionChange } from "../../../../src/permissions-edit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  slug: z.string().min(1),
  tier: z.enum(TIERS).refine((t) => t !== "custom", "tier must be a preset, not 'custom'"),
  perField: z.record(z.string(), z.boolean()).optional(),
});

export async function POST(req: NextRequest) {
  const db = getDb();
  const session = await sessionFromRequest(db, req);
  if (!session || session.role !== "operator") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body;
  try { body = Body.parse(await req.json()); }
  catch (e) { return NextResponse.json({ error: "Invalid", detail: String(e) }, { status: 400 }); }

  const manifest = await getManifest(db, body.slug);
  if (!manifest) return NextResponse.json({ error: "Unknown client" }, { status: 404 });
  const client = await getClient(db, body.slug);
  if (!client) return NextResponse.json({ error: "Unknown client" }, { status: 404 });

  const { manifest: next } = applyPermissionChange(manifest, { tier: body.tier as any, perField: body.perField });
  await saveManifest(db, body.slug, next);
  await upsertClient(db, {
    slug: body.slug, displayName: client.display_name,
    vercelProjectId: client.vercel_project_id, customDomain: client.custom_domain,
    tier: next.tier,
  });
  return NextResponse.json({ ok: true, tier: next.tier });
}
```

- [ ] **Step 6: Run** typecheck + full suite. Commit:

```bash
git add editor/app/src/permissions-edit.ts editor/app/test/permissions-edit.test.ts editor/app/app/api/admin/permissions/route.ts
git commit -m "feat(editor-app): permission editing (tier + per-field) API"
```

---

### Task 4: Image upload to Blob

**Files:** `editor/app/app/api/upload/route.ts`, `editor/app/test/upload-helper.test.ts`, `editor/app/src/upload-helper.ts`

Keep validation pure/tested; the route calls `@vercel/blob.put`.

- [ ] **Step 1: Write failing test** `editor/app/test/upload-helper.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { validateUpload, blobKey } from "../src/upload-helper";

describe("validateUpload", () => {
  it("accepts allowed image types under the size cap", () => {
    expect(validateUpload("image/png", 500_000)).toEqual({ ok: true });
  });
  it("rejects non-images and oversized files", () => {
    expect(validateUpload("application/pdf", 1000).ok).toBe(false);
    expect(validateUpload("image/png", 99_000_000).ok).toBe(false);
  });
});

describe("blobKey", () => {
  it("namespaces by slug + field id", () => {
    expect(blobKey("acme", "index__img__1", "logo.png")).toBe("clients/acme/uploads/index__img__1/logo.png");
  });
});
```

- [ ] **Step 2: Run** `npx vitest run test/upload-helper.test.ts` — FAIL.

- [ ] **Step 3: Write `editor/app/src/upload-helper.ts`:**

```ts
const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

export function validateUpload(contentType: string, size: number): { ok: boolean; reason?: string } {
  if (!ALLOWED.includes(contentType)) return { ok: false, reason: `Unsupported type ${contentType}` };
  if (size > MAX_BYTES) return { ok: false, reason: `Too large (${size} > ${MAX_BYTES})` };
  return { ok: true };
}

export function blobKey(slug: string, fieldId: string, filename: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `clients/${slug}/uploads/${fieldId}/${safe}`;
}
```

- [ ] **Step 4: Run** `npx vitest run test/upload-helper.test.ts` — PASS.

- [ ] **Step 5: Write `editor/app/app/api/upload/route.ts`:**

```ts
import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getDb } from "../../../src/db";
import { sessionFromRequest, authorizeSlug } from "../../../src/session-request";
import { getManifest } from "../../../src/repo";
import { canEditField } from "../../../src/overrides-edit";
import { validateUpload, blobKey } from "../../../src/upload-helper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const db = getDb();
  const session = await sessionFromRequest(db, req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const slug = String(form.get("slug") ?? "");
  const fieldId = String(form.get("fieldId") ?? "");
  const file = form.get("file");
  if (!authorizeSlug(session, slug)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });

  const v = validateUpload(file.type, file.size);
  if (!v.ok) return NextResponse.json({ error: v.reason }, { status: 400 });

  const manifest = await getManifest(db, slug);
  const role = session.role === "operator" ? "operator" : "client";
  if (!manifest || !canEditField(manifest, role, fieldId)) {
    return NextResponse.json({ error: "Field not editable" }, { status: 403 });
  }

  const blob = await put(blobKey(slug, fieldId, file.name), file, { access: "public" });
  return NextResponse.json({ ok: true, url: blob.url });
}
```

Note: `@vercel/blob.put` needs `BLOB_READ_WRITE_TOKEN` in env (Vercel sets it automatically when a Blob store is linked). Document in README (Task 7).

- [ ] **Step 6: Run** typecheck + full suite. Commit:

```bash
git add editor/app/src/upload-helper.ts editor/app/test/upload-helper.test.ts editor/app/app/api/upload/route.ts
git commit -m "feat(editor-app): image upload to Blob (validated, permission-checked)"
```

---

### Task 5: Login page + client editor

**Files:** `editor/app/app/login/page.tsx`, `editor/app/app/edit/page.tsx`, `editor/app/app/edit/EditorForm.tsx`, `editor/app/test/EditorForm.test.tsx`

- [ ] **Step 1: Write `editor/app/app/login/page.tsx`** (client component):

```tsx
"use client";
import { useState } from "react";

export default function LoginPage() {
  const [u, setU] = useState(""); const [p, setP] = useState(""); const [err, setErr] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/auth/login", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: u, password: p }),
    });
    if (res.ok) { const j = await res.json(); window.location.href = j.role === "operator" ? "/admin/" + (j.slug ?? "") : "/edit"; }
    else setErr("Invalid credentials");
  }
  return (
    <main style={{ maxWidth: 360, margin: "80px auto", fontFamily: "system-ui" }}>
      <h1>Sign in</h1>
      <form onSubmit={submit}>
        <input placeholder="Username" value={u} onChange={(e) => setU(e.target.value)} style={{ display: "block", width: "100%", padding: 8, margin: "8px 0" }} />
        <input placeholder="Password" type="password" value={p} onChange={(e) => setP(e.target.value)} style={{ display: "block", width: "100%", padding: 8, margin: "8px 0" }} />
        <button type="submit" style={{ padding: "8px 16px" }}>Sign in</button>
        {err && <p style={{ color: "crimson" }}>{err}</p>}
      </form>
    </main>
  );
}
```

- [ ] **Step 2: Write the editor server page `editor/app/app/edit/page.tsx`** (loads data for the logged-in client's slug):

```tsx
import { cookies } from "next/headers";
import { getDb } from "../../src/db";
import { getSession } from "../../src/auth";
import { getManifest, getOverrides } from "../../src/repo";
import { SESSION_COOKIE } from "../../src/session-cookie";
import { visibleFields, groupFields } from "../../src/view";
import EditorForm from "./EditorForm";

export const dynamic = "force-dynamic";

export default async function EditPage() {
  const db = getDb();
  const sid = cookies().get(SESSION_COOKIE)?.value;
  const session = sid ? await getSession(db, sid) : null;
  if (!session || !session.slug) return <main style={{ padding: 24 }}><p>Please <a href="/login">sign in</a>.</p></main>;

  const manifest = await getManifest(db, session.slug);
  if (!manifest) return <main style={{ padding: 24 }}><p>No site found for your account.</p></main>;
  const overrides = await getOverrides(db, session.slug, "draft");
  const groups = groupFields(visibleFields(manifest, "client"));
  return <EditorForm slug={session.slug} groups={groups} initialOverrides={overrides} />;
}
```

- [ ] **Step 3: Write `editor/app/app/edit/EditorForm.tsx`** (client component):

```tsx
"use client";
import { useState } from "react";
import type { PageGroup } from "../../src/view";
import type { Overrides } from "@action-studio/editor-engine";

export default function EditorForm({ slug, groups, initialOverrides }: { slug: string; groups: PageGroup[]; initialOverrides: Overrides; }) {
  const [overrides, setOverrides] = useState<Overrides>(initialOverrides);
  const [msg, setMsg] = useState("");

  async function saveField(fieldId: string, value: string) {
    setOverrides((o) => ({ ...o, [fieldId]: value }));
    await fetch("/api/overrides", {
      method: "PUT", headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug, fieldId, value }),
    });
  }
  async function act(kind: "preview" | "publish") {
    setMsg(kind === "preview" ? "Building preview…" : "Publishing…");
    const res = await fetch(`/api/${kind}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug }),
    });
    const j = await res.json();
    setMsg(res.ok ? (kind === "preview" ? `Preview: ${j.url}` : "Published — your site is updating.") : `Error: ${j.error}`);
  }

  return (
    <main style={{ maxWidth: 760, margin: "24px auto", fontFamily: "system-ui" }}>
      <h1>Edit your site</h1>
      <div style={{ position: "sticky", top: 0, background: "#fff", padding: "8px 0" }}>
        <button onClick={() => act("preview")} style={{ marginRight: 8 }}>Preview</button>
        <button onClick={() => act("publish")}>Publish</button>
        <span style={{ marginLeft: 12 }}>{msg}</span>
      </div>
      {groups.map((page) => (
        <section key={page.page}>
          <h2>{page.page}</h2>
          {page.sections.map((sec) => (
            <fieldset key={sec.section} style={{ margin: "12px 0" }}>
              <legend>{sec.section}</legend>
              {sec.fields.map((f) => (
                <label key={f.id} style={{ display: "block", margin: "8px 0" }}>
                  <span style={{ display: "block", fontSize: 12, color: "#555" }}>{f.label}</span>
                  {f.type === "color" ? (
                    <input type="color" defaultValue={typeof overrides[f.id] === "string" ? (overrides[f.id] as string) : (f.value as string)}
                      onChange={(e) => saveField(f.id, e.target.value)} />
                  ) : f.type === "image" ? (
                    <input type="file" accept="image/*" data-testid={`img-${f.id}`}
                      onChange={async (e) => {
                        const file = e.target.files?.[0]; if (!file) return;
                        const fd = new FormData(); fd.set("slug", slug); fd.set("fieldId", f.id); fd.set("file", file);
                        const res = await fetch("/api/upload", { method: "POST", body: fd });
                        const j = await res.json(); if (res.ok) saveField(f.id, j.url);
                      }} />
                  ) : (
                    <input type="text" defaultValue={typeof overrides[f.id] === "string" ? (overrides[f.id] as string) : (f.value as string)}
                      data-testid={`text-${f.id}`} onBlur={(e) => saveField(f.id, e.target.value)}
                      style={{ width: "100%", padding: 6 }} />
                  )}
                </label>
              ))}
            </fieldset>
          ))}
        </section>
      ))}
    </main>
  );
}
```

- [ ] **Step 4: Write component test** `editor/app/test/EditorForm.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import EditorForm from "../app/edit/EditorForm";
import type { PageGroup } from "../src/view";

const groups: PageGroup[] = [{
  page: "index.html",
  sections: [{ section: "Hero", fields: [
    { id: "index__h1__1", page: "index.html", section: "Hero", label: "Headline", type: "text", value: "Old", clientEditable: true },
  ] }],
}];

describe("EditorForm", () => {
  beforeEach(() => { vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, url: "https://p.vercel.app" }) }))); });
  afterEach(() => vi.unstubAllGlobals());

  it("renders a field and PUTs the edit on blur", async () => {
    render(<EditorForm slug="acme" groups={groups} initialOverrides={{}} />);
    const input = screen.getByTestId("text-index__h1__1") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "New Headline" } });
    fireEvent.blur(input);
    await waitFor(() => {
      const call = (globalThis.fetch as any).mock.calls.find((c: any[]) => c[0] === "/api/overrides");
      expect(call).toBeTruthy();
      expect(JSON.parse(call[1].body)).toEqual({ slug: "acme", fieldId: "index__h1__1", value: "New Headline" });
    });
  });

  it("Publish button calls /api/publish", async () => {
    render(<EditorForm slug="acme" groups={groups} initialOverrides={{}} />);
    fireEvent.click(screen.getByText("Publish"));
    await waitFor(() => {
      expect((globalThis.fetch as any).mock.calls.some((c: any[]) => c[0] === "/api/publish")).toBe(true);
    });
  });
});
```

- [ ] **Step 5: Run** `npx vitest run test/EditorForm.test.tsx` — PASS (2 tests). Then `npm run typecheck` (0) + full suite.

- [ ] **Step 6: Commit**

```bash
git add editor/app/app/login/page.tsx editor/app/app/edit/page.tsx editor/app/app/edit/EditorForm.tsx editor/app/test/EditorForm.test.tsx
git commit -m "feat(editor-app): login page + client editor (widgets, autosave, preview/publish)"
```

---

### Task 6: Operator admin panel

**Files:** `editor/app/app/admin/[slug]/page.tsx`, `editor/app/app/admin/[slug]/AdminPanel.tsx`, `editor/app/test/AdminPanel.test.tsx`

- [ ] **Step 1: Write the admin server page `editor/app/app/admin/[slug]/page.tsx`:**

```tsx
import { cookies } from "next/headers";
import { getDb } from "../../../src/db";
import { getSession } from "../../../src/auth";
import { getManifest, getClient } from "../../../src/repo";
import { SESSION_COOKIE } from "../../../src/session-cookie";
import AdminPanel from "./AdminPanel";

export const dynamic = "force-dynamic";

export default async function AdminPage({ params }: { params: { slug: string } }) {
  const db = getDb();
  const sid = cookies().get(SESSION_COOKIE)?.value;
  const session = sid ? await getSession(db, sid) : null;
  if (!session || session.role !== "operator") return <main style={{ padding: 24 }}><p>Operator sign-in required.</p></main>;

  const manifest = await getManifest(db, params.slug);
  const client = await getClient(db, params.slug);
  if (!manifest || !client) return <main style={{ padding: 24 }}><p>Unknown client.</p></main>;
  return <AdminPanel slug={params.slug} tier={client.permission_tier}
    fields={manifest.fields.map((f) => ({ id: f.id, label: f.label, type: f.type, clientEditable: f.clientEditable }))} />;
}
```

- [ ] **Step 2: Write `editor/app/app/admin/[slug]/AdminPanel.tsx`:**

```tsx
"use client";
import { useState } from "react";

const TIERS = ["Text only", "Text + Pictures", "Text + Pictures + Colours", "Everything"] as const;
type FieldLite = { id: string; label: string; type: string; clientEditable: boolean };

export default function AdminPanel({ slug, tier, fields }: { slug: string; tier: string; fields: FieldLite[] }) {
  const [sel, setSel] = useState<string>(TIERS.includes(tier as any) ? tier : TIERS[0]);
  const [perField, setPerField] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState("");
  const [pw, setPw] = useState(""); const [pwMsg, setPwMsg] = useState("");

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
      method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${process.env.NEXT_PUBLIC_NONE ?? ""}` },
      body: JSON.stringify({ username: slug, slug, password: pw }),
    });
    setPwMsg(res.ok ? "Password set. Send the client the editor link + this password." : "Failed (operator token required server-side).");
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
        <h2>Client password</h2>
        <input type="text" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="new password (min 8)" />
        <button onClick={setPassword} style={{ marginLeft: 8 }}>Set password</button>
        <span style={{ marginLeft: 12 }}>{pwMsg}</span>
        <p>Editor link to send: <code>/login</code> (username: <code>{slug}</code>)</p>
      </section>
    </main>
  );
}
```

Note: the credentials route is operator-**token** protected (server-to-server). Calling it from the browser admin panel needs the operator token, which must not ship to the client bundle. For v1, set passwords via the operator running the documented `curl` against `/api/admin/credentials` with `OPERATOR_TOKEN` (document in README), OR (follow-up) add a session-based admin credentials route. The AdminPanel's "Set password" button is wired but will show the failure note until that follow-up; the permission editor (session-protected) works fully. Record this limitation in the commit + README.

- [ ] **Step 3: Write component test** `editor/app/test/AdminPanel.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AdminPanel from "../app/admin/[slug]/AdminPanel";

describe("AdminPanel", () => {
  beforeEach(() => { vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, tier: "Text + Pictures" }) }))); });
  afterEach(() => vi.unstubAllGlobals());

  it("saving permissions posts the selected tier + per-field map", async () => {
    render(<AdminPanel slug="acme" tier="Text only" fields={[{ id: "c", label: "primary", type: "color", clientEditable: false }]} />);
    fireEvent.change(screen.getByTestId("tier-select"), { target: { value: "Text + Pictures" } });
    fireEvent.click(screen.getByTestId("pf-c"));
    fireEvent.click(screen.getByText("Save permissions"));
    await waitFor(() => {
      const call = (globalThis.fetch as any).mock.calls.find((c: any[]) => c[0] === "/api/admin/permissions");
      expect(call).toBeTruthy();
      expect(JSON.parse(call[1].body)).toEqual({ slug: "acme", tier: "Text + Pictures", perField: { c: true } });
    });
  });
});
```

- [ ] **Step 4: Run** `npx vitest run test/AdminPanel.test.tsx` — PASS. Typecheck + full suite.

- [ ] **Step 5: Commit**

```bash
git add "editor/app/app/admin/[slug]/page.tsx" "editor/app/app/admin/[slug]/AdminPanel.tsx" editor/app/test/AdminPanel.test.tsx
git commit -m "feat(editor-app): operator admin panel (permissions + credential stub)"
```

---

### Task 7: Docs

**Files:** `editor/app/README.md`

- [ ] **Step 1: Append** an "Env (UI/Blob)" note (`BLOB_READ_WRITE_TOKEN` for uploads) and a "Setting a client password" section documenting the `curl` against `/api/admin/credentials` with `OPERATOR_TOKEN` until the session-based admin credential route lands. Also document the page routes: `/login`, `/edit` (client), `/admin/{slug}` (operator).

- [ ] **Step 2: Commit**

```bash
git add editor/app/README.md
git commit -m "docs(editor-app): UI routes, Blob env, credential-setting note"
```

---

## Self-Review

**1. Spec coverage:**
- Dashboard form grouped by page→section, per-type widgets, only clientEditable fields (§1,§3,§5) → Tasks 1, 5. ✔
- Tier preset + per-field toggles with "Custom" label (§3) → Tasks 3, 6 (reuses engine `applyTier`/`resolveTierLabel`). ✔
- Operator vs client visibility (§4) → `visibleFields` + `authorizeSlug` enforced in routes. ✔
- Preview→Publish from the editor (§7) → Task 5 buttons → Plan 2c endpoints. ✔
- Image upload to Blob with constraints (§2,§8) → Task 4. ✔
- Credential management (§6) → Task 6 (permissions fully; password-set documented as token-`curl` for v1 with a flagged follow-up — an honest, non-silent limitation). ✔

**2. Placeholder scan:** Every step has complete code. The one acknowledged limitation (browser "Set password" needs a session-based admin route) is explicitly documented, wired, and surfaced to the user — not a hidden TBD. ✔

**3. Type/name consistency:** `PageGroup`/`SectionGroup` shared between `view.ts`, `edit/page.tsx`, `EditorForm.tsx`, and tests. `applyPermissionChange({tier, perField})` consistent (helper, route, AdminPanel post body, test). `canEditField`/`applyFieldOverride` consistent (helper, overrides route, upload route). Override write body `{slug, fieldId, value}` matches between `EditorForm`, the route, and the test. ✔

**Known v1 limitation (flagged, not silent):** browser-driven "Set password" needs a session-protected admin credentials route (currently the route is operator-token only, for server-to-server). Documented in Task 6 + README; recommended as the first follow-up after 2d.
```
