# Operator Edit Fast-Path — Design Spec

**Date:** 2026-06-02
**Status:** Approved for planning
**Owner:** Michael (Action Studio)
**Builds on:** the merged editor (engine + 2a–2d + operator login). Spec context: [editor app design](2026-06-02-client-site-editor-app-design.md).

---

## 1. Goal

Cut the clicks between "looking at a client's site" and "editing it." Add an operator-only **Edit** button to deployed sites that jumps straight to a single combined hub where the operator can assign permissions, set the client's password, and edit the site themselves — all on one page.

**Problem today:** to edit, the operator must push (local `web/`), open the editor app, log in, navigate to `/admin/{slug}`, set a password, then log in *as the client* to actually edit content. Operators cannot edit a client's content at all (the editor keys off the logged-in session's own slug; operators have no slug).

---

## 2. Constraints (carried from earlier decisions)

- The Edit button must **not be visible to the public** on the client's live domain. It is revealed only when the operator adds a URL marker (`?edit` or `#edit`).
- The button grants **no access** by itself — it only deep-links to the editor, where operator login gates everything. So the reveal marker is not a secret and leaking it is harmless.

---

## 3. Approach (chosen: A — inject at publish time)

The hidden Edit button is injected into every page by the **Publisher** at publish time (not by the factory build). Centralized in the editor, no factory/template changes, applies to every client automatically, and reaches already-deployed sites on their next publish. Trade-off accepted: the button appears after the first editor publish, not on the raw first factory deploy (acceptable — onboarding always includes a push, and a publish is one click on the hub).

---

## 4. Components

### 4.1 Engine: `injectOperatorEditButton(html, { editorUrl, slug })`
Pure function (new, in the engine, cheerio-based). Appends, before `</body>`, a hidden anchor + a tiny reveal script:
```html
<a href="{editorUrl}/admin/{slug}" data-op-edit hidden>✎ Edit site</a>
<script>(function(){var p=new URLSearchParams(location.search);if(p.has('edit')||location.hash==='#edit'){var a=document.querySelector('[data-op-edit]');if(a){a.hidden=false;a.setAttribute('style','position:fixed;bottom:16px;right:16px;z-index:99999;background:#111;color:#fff;padding:10px 16px;border-radius:6px;font:600 14px system-ui;text-decoration:none');}}})();</script>
```
- **Idempotent:** if a `[data-op-edit]` element is already present, return the HTML unchanged (don't double-inject).
- Returns the modified HTML string. Unit-tested: injects when absent + reveal markup present; no-op when already present; the anchor href is `{editorUrl}/admin/{slug}`.

### 4.2 Publisher wiring
The Publisher (`editor/app/src/publisher.ts`) calls `injectOperatorEditButton` on each merged page before deploying, using `process.env.EDITOR_PUBLIC_URL` (the public editor base URL, e.g. `https://editor.actiondesignstudio.com`). If `EDITOR_PUBLIC_URL` is unset, injection is skipped (no broken links) — logged, not fatal.

### 4.3 Operator editing capability
The editor currently only serves a logged-in client editing their own slug. Add operator editing of any slug:
- A server-side loader that, for a given `{slug}`, returns the manifest (all fields via `visibleFields(manifest, "operator")`) + draft overrides.
- Reuse the existing `EditorForm` component (it already takes `slug`, `groups`, `initialOverrides` props and calls `/api/overrides`, `/api/preview`, `/api/publish` — all of which already authorize operators for any slug via `authorizeSlug`). No API changes needed.

### 4.4 Combined operator hub (`/admin/[slug]`)
The existing admin page gains an **"Edit this site"** section below the permissions + password sections, rendering `EditorForm` for `{slug}` with operator-visible fields. Result: one page does permissions, password, and content editing + Preview/Publish.

---

## 5. Data flow (the fast path)

```
Operator views client live site → appends ?edit → clicks ✎ Edit site
   → {EDITOR_PUBLIC_URL}/admin/{slug}
   → (operator login if no session)
   → hub: [permission tier + per-field]  [set client password]  [Edit this site: fields + Preview/Publish]
```

The button is present on the deployed site because the Publisher injected it on the last publish.

---

## 6. Error handling / edge cases

- `EDITOR_PUBLIC_URL` unset → Publisher skips injection (sites still deploy, just no button). Logged.
- Idempotency → re-publishing never stacks multiple buttons.
- Non-operator reaching `/admin/{slug}` → existing operator-session guard returns the "Operator sign-in required" message (unchanged).
- The reveal script is defensive (guards `querySelector` null) and inert when the marker is absent, so it has zero effect for public visitors.

---

## 7. Testing

- **Engine:** `injectOperatorEditButton` unit tests (inject-when-absent, idempotent no-op, correct href, reveal script present).
- **App:** publisher test asserts (a) with `EDITOR_PUBLIC_URL` set, deployed page HTML contains `data-op-edit` + the admin link; (b) unset → no injection. The operator-edit data loader: a pure helper tested for "operator sees all fields for a slug." `EditorForm` reuse needs no new component test (covered in 2d); add one assertion that the admin page composes it for the slug if cheap.

---

## 8. Out of scope

- Factory-build injection (Approach B) — not done; Publisher injection covers the need.
- Styling polish of the floating button beyond a clean default.
- Auto-publishing on push to make the button appear pre-publish — deferred; the hub's Publish button suffices.

---

## 9. Risk

Low. The only outward-facing change is extra markup on published pages, hidden by default and link-only (no privileged action). The operator-editing path reuses already-authorized APIs. No new external dependencies.
