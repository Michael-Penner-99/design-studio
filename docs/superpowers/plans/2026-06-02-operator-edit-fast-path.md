# Operator Edit Fast-Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an operator-only Edit button (hidden on the public site, revealed by `?edit`/`#edit`) injected into deployed pages by the Publisher, linking to a combined `/admin/{slug}` hub where the operator sets permissions, sets the client password, AND edits the site content with Preview/Publish — all on one page.

**Architecture:** A pure engine helper injects the hidden button + reveal script before `</body>`; the Publisher calls it per merged page using `EDITOR_PUBLIC_URL`. The existing `/admin/[slug]` page additionally loads the slug's manifest (operator-visible = all fields) + draft overrides and renders the existing `EditorForm`, which already calls the operator-authorized overrides/preview/publish APIs.

**Tech Stack:** Engine (`editor/engine/`, cheerio + vitest) and `editor/app/` (Next.js, vitest). No new deps.

**Builds on:** Spec `docs/superpowers/specs/2026-06-02-operator-edit-fast-path-design.md`. Engine + 2a–2d + operator login are merged.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `editor/engine/src/edit-button.ts` | Create | `injectOperatorEditButton(html, {editorUrl, slug})` |
| `editor/engine/src/index.ts` | Modify | export it |
| `editor/engine/test/edit-button.test.ts` | Create | unit tests |
| `editor/app/src/publisher.ts` | Modify | inject button per page (when `EDITOR_PUBLIC_URL` set) |
| `editor/app/test/publisher.test.ts` | Modify | assert injection present/absent |
| `editor/app/app/admin/[slug]/page.tsx` | Modify | load overrides + render `EditorForm` below the panel |
| `editor/app/README.md` | Modify | document `EDITOR_PUBLIC_URL` + re-publish note |

---

### Task 1: Engine — `injectOperatorEditButton`

**Files:** `editor/engine/src/edit-button.ts`, `editor/engine/src/index.ts`, `editor/engine/test/edit-button.test.ts`. Run from `editor/engine`.

- [ ] **Step 1: Write the failing test** `editor/engine/test/edit-button.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import * as cheerio from "cheerio";
import { injectOperatorEditButton } from "../src/edit-button";

const page = `<!DOCTYPE html><html><head></head><body><h1>Hi</h1></body></html>`;

describe("injectOperatorEditButton", () => {
  it("appends a hidden anchor linking to /admin/{slug} plus a reveal script", () => {
    const out = injectOperatorEditButton(page, { editorUrl: "https://editor.example.com", slug: "acme" });
    const $ = cheerio.load(out);
    const a = $("[data-op-edit]");
    expect(a.length).toBe(1);
    expect(a.attr("href")).toBe("https://editor.example.com/admin/acme");
    expect(a.attr("hidden")).not.toBeUndefined();           // hidden by default
    expect(out).toContain("location.hash==='#edit'");       // reveal script present
  });

  it("trims a trailing slash on editorUrl", () => {
    const out = injectOperatorEditButton(page, { editorUrl: "https://editor.example.com/", slug: "acme" });
    expect(cheerio.load(out)("[data-op-edit]").attr("href")).toBe("https://editor.example.com/admin/acme");
  });

  it("is idempotent — re-injecting does not add a second button", () => {
    const once = injectOperatorEditButton(page, { editorUrl: "https://e.com", slug: "acme" });
    const twice = injectOperatorEditButton(once, { editorUrl: "https://e.com", slug: "acme" });
    expect(cheerio.load(twice)("[data-op-edit]").length).toBe(1);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run test/edit-button.test.ts` — expect FAIL (module not found).

- [ ] **Step 3: Write `editor/engine/src/edit-button.ts`:**

```ts
import * as cheerio from "cheerio";

const REVEAL_SCRIPT =
  `<script>(function(){var p=new URLSearchParams(location.search);` +
  `if(p.has('edit')||location.hash==='#edit'){var a=document.querySelector('[data-op-edit]');` +
  `if(a){a.hidden=false;a.setAttribute('style','position:fixed;bottom:16px;right:16px;z-index:99999;` +
  `background:#111;color:#fff;padding:10px 16px;border-radius:6px;font:600 14px system-ui;text-decoration:none');}}})();</script>`;

/** Append a hidden operator "Edit site" button + reveal script before </body>. Idempotent. */
export function injectOperatorEditButton(html: string, opts: { editorUrl: string; slug: string }): string {
  const $ = cheerio.load(html);
  if ($("[data-op-edit]").length) return html;
  const href = `${opts.editorUrl.replace(/\/$/, "")}/admin/${opts.slug}`;
  const anchor = `<a href="${href}" data-op-edit hidden>✎ Edit site</a>`;
  if ($("body").length) {
    $("body").append(anchor + REVEAL_SCRIPT);
    return $.html();
  }
  return html + anchor + REVEAL_SCRIPT;
}
```

- [ ] **Step 4: Run** `npx vitest run test/edit-button.test.ts` — expect PASS (3 tests).

- [ ] **Step 5: Export** — add `export * from "./edit-button";` to `editor/engine/src/index.ts`. Run `npm run typecheck` (0) + full suite.

- [ ] **Step 6: Commit**

```bash
git add editor/engine/src/edit-button.ts editor/engine/src/index.ts editor/engine/test/edit-button.test.ts
git commit -m "feat(engine): injectOperatorEditButton (hidden, reveal-on-?edit)"
```

---

### Task 2: Publisher injects the button

**Files:** `editor/app/src/publisher.ts`, `editor/app/test/publisher.test.ts`. Run from `editor/app`.

- [ ] **Step 1: Add failing tests** to `editor/app/test/publisher.test.ts` (new `it`s in the existing `describe("publish", ...)`; the vercel mock + `seed` helper already exist):

```ts
  it("injects the operator edit button into deployed pages when EDITOR_PUBLIC_URL is set", async () => {
    const { vi } = await import("vitest");
    vi.stubEnv("EDITOR_PUBLIC_URL", "https://editor.example.com");
    const db = await makeTestDb();
    await seed(db);
    await publish(db, "acme", "publish");
    const call = (deployFiles as any).mock.calls.at(-1)[0];
    const idx = call.files.find((f: any) => f.path === "index.html").content;
    expect(idx).toContain('data-op-edit');
    expect(idx).toContain("https://editor.example.com/admin/acme");
    vi.unstubAllEnvs();
  });

  it("does not inject when EDITOR_PUBLIC_URL is unset", async () => {
    const { vi } = await import("vitest");
    vi.stubEnv("EDITOR_PUBLIC_URL", "");
    const db = await makeTestDb();
    await seed(db);
    await publish(db, "acme", "publish");
    const call = (deployFiles as any).mock.calls.at(-1)[0];
    expect(call.files.find((f: any) => f.path === "index.html").content).not.toContain("data-op-edit");
    vi.unstubAllEnvs();
  });
```
(If the test file already imports `vi` from vitest at the top, use that import instead of the inline `await import("vitest")` — prefer a top-level `import { vi } from "vitest"` added to the existing import line, and drop the inline dynamic import.)

- [ ] **Step 2: Run** `npx vitest run test/publisher.test.ts` — expect the 2 new tests to FAIL.

- [ ] **Step 3: Edit `editor/app/src/publisher.ts`.** Add the engine import:
```ts
import { mergePages, injectOperatorEditButton } from "@action-studio/editor-engine";
```
After `const merged = mergePages(...);`, transform pages with the button when the env is set:
```ts
    const editorUrl = process.env.EDITOR_PUBLIC_URL;
    const pages = editorUrl
      ? merged.pages.map((p) => ({ path: p.path, html: injectOperatorEditButton(p.html, { editorUrl, slug }) }))
      : merged.pages;
```
Then change the `deployFiles` call's `files` to map over `pages` instead of `merged.pages`:
```ts
      files: pages.map((p) => ({ path: p.path, content: p.html })),
```
(Leave assets and everything else unchanged.)

- [ ] **Step 4: Run** `npx vitest run test/publisher.test.ts` — expect PASS (existing + 2 new). The existing happy-path tests don't set `EDITOR_PUBLIC_URL`, so they see no injection and their content assertions still hold. Then `npm run typecheck` (0) + full suite.

- [ ] **Step 5: Commit**

```bash
git add editor/app/src/publisher.ts editor/app/test/publisher.test.ts
git commit -m "feat(editor-app): publisher injects operator edit button (EDITOR_PUBLIC_URL)"
```

---

### Task 3: Combined operator hub (admin page renders the editor)

**Files:** `editor/app/app/admin/[slug]/page.tsx`. Run from `editor/app`. (Server component — verified by typecheck + the reused, already-tested `EditorForm` and `visibleFields`/`groupFields`.)

- [ ] **Step 1: Edit `editor/app/app/admin/[slug]/page.tsx`** to also load draft overrides and render `EditorForm` below `AdminPanel`. New full file:

```tsx
import { cookies } from "next/headers";
import { getDb } from "../../../src/db";
import { getSession } from "../../../src/auth";
import { getManifest, getClient, getOverrides } from "../../../src/repo";
import { SESSION_COOKIE } from "../../../src/session-cookie";
import { visibleFields, groupFields } from "../../../src/view";
import AdminPanel from "./AdminPanel";
import EditorForm from "../../edit/EditorForm";

export const dynamic = "force-dynamic";

export default async function AdminPage({ params }: { params: { slug: string } }) {
  const db = getDb();
  const sid = cookies().get(SESSION_COOKIE)?.value;
  const session = sid ? await getSession(db, sid) : null;
  if (!session || session.role !== "operator") return <main style={{ padding: 24 }}><p>Operator sign-in required.</p></main>;

  const manifest = await getManifest(db, params.slug);
  const client = await getClient(db, params.slug);
  if (!manifest || !client) return <main style={{ padding: 24 }}><p>Unknown client.</p></main>;

  const overrides = await getOverrides(db, params.slug, "draft");
  const groups = groupFields(visibleFields(manifest, "operator"));

  return (
    <>
      <AdminPanel slug={params.slug} tier={client.permission_tier}
        fields={manifest.fields.map((f) => ({ id: f.id, label: f.label, type: f.type, clientEditable: f.clientEditable }))} />
      <EditorForm slug={params.slug} groups={groups} initialOverrides={overrides} />
    </>
  );
}
```

Notes: `getOverrides` is added to the existing `../../../src/repo` import. `EditorForm` is imported from `../../edit/EditorForm` (from `app/admin/[slug]/` → `../../` = `app/` → `edit/EditorForm`). `EditorForm` renders its own `<main>` with an "Edit your site" heading — acceptable as the editing section here. The overrides/preview/publish APIs `EditorForm` calls already authorize operators for any slug (`authorizeSlug`), so operator editing works with no API change.

- [ ] **Step 2: Verify** `npm run typecheck` (0) and full suite (`npx vitest run`, all pass). Confirm the `EditorForm` import path resolves (typecheck will catch a wrong depth).

- [ ] **Step 3: Commit**

```bash
git add "editor/app/app/admin/[slug]/page.tsx"
git commit -m "feat(editor-app): admin hub renders operator editor (permissions+password+edit on one page)"
```

---

### Task 4: Docs — `EDITOR_PUBLIC_URL` + re-publish note

**Files:** `editor/app/README.md`

- [ ] **Step 1: Append to `editor/app/README.md`:**

```markdown
## Operator edit fast-path (Plan: operator-edit-fast-path)
- Set `EDITOR_PUBLIC_URL` (e.g. `https://editor.actiondesignstudio.com`) on the editor app. When set, every published page gets a hidden operator **Edit** button.
- Reveal it on any client's live page by appending `?edit` (or `#edit`) to the URL → click **✎ Edit site** → it opens `/admin/{slug}` (operator login required) where you set permissions, set the client password, and edit the site (Preview/Publish) — all on one page.
- The button is hidden from the public and only links to the editor (login still gates everything).
- **Existing/already-deployed sites get the button on their next Publish** (injection happens at publish time). New pushes need one publish to show it.
```

- [ ] **Step 2: Verify** `grep -q EDITOR_PUBLIC_URL editor/app/README.md && echo ok`. Commit:

```bash
git add editor/app/README.md
git commit -m "docs(editor-app): document EDITOR_PUBLIC_URL operator edit button"
```

---

## Self-Review

**1. Spec coverage:**
- Hidden operator button revealed by `?edit`/`#edit`, link-only (spec §2, §4.1) → Task 1. ✔
- Inject at publish time via `EDITOR_PUBLIC_URL`, skip if unset (spec §3, §4.2, §6) → Task 2. ✔
- Operator editing of any slug, reusing `EditorForm` + already-authorized APIs (spec §4.3) → Task 3. ✔
- Combined hub: permissions + password + edit on one page (spec §4.4) → Task 3. ✔
- Idempotent injection (spec §6) → Task 1 test 3. ✔
- Docs + re-publish note (spec §3 trade-off) → Task 4. ✔

**2. Placeholder scan:** Every step has complete code/commands. No TBDs. ✔

**3. Type/name consistency:** `injectOperatorEditButton(html, {editorUrl, slug})` identical across engine, export, publisher, and tests. `data-op-edit` marker consistent across engine + publisher tests. `EDITOR_PUBLIC_URL` consistent across publisher, tests, README. `EditorForm` props (`slug`, `groups`, `initialOverrides`) match the existing component and the admin page usage; `groupFields(visibleFields(manifest,"operator"))` matches the tested helper signatures. ✔
