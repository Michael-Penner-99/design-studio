# Inline Site Editor — Design Spec

**Date:** 2026-06-19
**Status:** Approved (brainstorming) — ready for implementation plan
**Author:** Action Studio
**Supersedes the UX layer of:** `2026-06-02-client-site-editor-app-design.md` (the separate form-based editor app)

---

## Problem

The current self-service editor is clunky. Adding `?edit` to a live site only reveals a small "✎ Edit site" button that **links the user away** to a separate Next.js app (`editor.actiondesignstudio.com/edit`). That app presents a **flat form** — a long list of text inputs grouped by page/section, with no visual connection to where each value appears on the real page.

The operator wants: append `?edit` to a live site URL → log in with username/password → edit the page **in place** (click text to type, click an image to swap, pick brand colors), scoped to permissions. Admin edits everything; a client edits only the fields the admin has granted.

## Goal

Replace the "link-away form" UX with **true click-to-edit inline editing that mounts on the live site itself**, reusing the existing, working backend (auth, permissions, override storage, preview/publish pipeline) with only small additive changes. Add **credential management** (admin changes own password; admin sets/resets client passwords) and a **copy-paste client invite** (link + username + password) in the admin panel.

## Non-goals

- **No new permission-granting UI.** Granting a client access to fields/sections stays in the existing `/admin/{slug}` panel (tiers + per-field toggles). This work covers the **editing** experience plus credential/invite management.
- **No new publish/review workflow.** Both admin and client can Save → Preview → Publish using the existing pipeline. (Decision: clients may self-publish.)
- **No email-provider integration.** The app **generates** the invite (link + username + password) for the operator to send via their own email client — Copy button + `mailto:`. No Resend/SMTP/sending infrastructure. (Could be added later if desired.)
- **No client password self-service.** Clients use the password the admin sets/emails; only the admin changes passwords.
- **No new editable surfaces beyond the engine's already-tagged fields.** We edit what the tagger marks; we don't introduce free-form page editing.

---

## What already exists (and is reused unchanged)

| Capability | Location | Reuse |
|---|---|---|
| Two roles: `operator` (global admin via `OPERATOR_USERNAME` / `OPERATOR_PASSWORD_HASH`) and per-slug `client` | `editor/app/src/auth.ts` `login()` | As-is |
| Sessions (14-day TTL, Postgres-backed) | `editor/app/src/auth.ts`, `repo.ts` | As-is |
| Per-field permission enforcement (`canEditField`, role mapped to `operator`/`client`) | `editor/app/app/api/overrides/route.ts`, `src/overrides-edit.ts` | As-is |
| Draft override storage (GET/PUT) | `/api/overrides` | As-is |
| Image upload to Blob | `/api/upload` | As-is |
| Preview + Publish (merge → deploy → promote) | `/api/preview`, `/api/publish`, `src/publisher.ts` | As-is |
| Element tagging with stable `data-*` field IDs | `editor/engine/src/tagger.ts`, `ids.ts` | As-is |
| Manifest with `clientEditable` per field | `editor/engine/src/types.ts`, `manifest.ts` | As-is |
| `?edit` / `#edit` reveal trigger | `editor/engine/src/edit-button.ts` | Logic kept, target changed |

**Implication:** the backend already models exactly the roles and permissions the operator described. The work is almost entirely a new front-end (the inline editor) plus two small backend affordances (bearer-token auth + CORS) so a script running on the *site's* domain can talk to the editor app on *its* domain.

---

## Architecture (Approach A — injected embed + bearer token)

```
Live site (capstone.actiondesignstudio.com)        Editor backend (editor.actiondesignstudio.com)
┌───────────────────────────────────────┐          ┌──────────────────────────────────────────┐
│ page.html                              │          │ /embed.js          (serves inline editor)  │
│   ...content with data-* field IDs...  │          │ /api/auth/login    (+returns token)        │
│   <inline embed-loader>  ◀── baked in  │          │ /api/overrides     (GET/PUT, perm-checked) │
│                                        │          │ /api/upload                                │
│   on ?edit → loads ─────────────────────────────▶ │ /api/preview, /api/publish                 │
│   embed.js → login overlay → inline    │  bearer  │                                            │
│   editing → Save/Preview/Publish       │  token   │  (auth accepts Authorization: Bearer +CORS)│
└───────────────────────────────────────┘          └──────────────────────────────────────────┘
```

### Why cross-origin matters and how it's handled

The site and the backend are on different subdomains/domains (clients may also use custom domains). Cookies set by the editor app would be third-party on the site's domain and are increasingly blocked by browsers. **Solution: token-in-header.**

- `/api/auth/login` continues to set its cookie (for the existing same-origin app) **and additionally returns `{ token: <sessionId> }`** in the JSON body.
- The embed stores the token in `sessionStorage` (cleared on Exit/tab close) and sends `Authorization: Bearer <token>` on every API call.
- `sessionFromRequest(db, req)` is extended to resolve the session from the bearer header **when no valid cookie is present**. Cookie path is unchanged, so the existing app keeps working.
- API routes the embed calls (`/api/auth/login`, `/api/overrides`, `/api/upload`, `/api/preview`, `/api/publish`) gain CORS headers: allow the configured site origins, `Access-Control-Allow-Headers: authorization, content-type`, and an `OPTIONS` preflight handler. (Token-in-header means we do **not** need `Allow-Credentials`/cookies cross-site.)

---

## Components

### 1. `embed-loader` (replaces `edit-button.ts`)

- A small inline script baked before `</body>` on every page by the factory build (where `injectOperatorEditButton` is called today).
- Behavior: if `?edit` is in the query string or `#edit` in the hash, inject `<script src="https://{EDITOR_HOST}/embed.js" data-slug="{slug}" defer>`. Otherwise do nothing (zero footprint for normal visitors).
- Idempotent (guard like the current `[data-op-edit]` check).
- `{EDITOR_HOST}` and `{slug}` are templated in at build time (the engine already knows both — see `injectOperatorEditButton(html, { editorUrl, slug })`).

### 2. `embed.js` (the inline editor — new, served by the editor app)

Lazy-loaded only in edit mode. Responsibilities, in order:

1. **Login overlay.** A small centered card over the page: username, password, Sign in. POSTs to `/api/auth/login`; on success stores the returned token + role + slug; on failure shows "Invalid credentials" (no enumeration). If a valid token already exists in `sessionStorage`, skip straight to editing.
2. **Load editing context.** GET the manifest for the slug and the current draft overrides (via `/api/overrides`). The manifest's `fields[]` provide each field's `id`, `type`, `label`, `clientEditable`, and `constraints`.
3. **Wire up editability.** For each manifest field, find the element by its `data-*` ID in the live DOM and, **if the current role may edit it** (admin: all; client: `clientEditable === true`):
   - `text` / `richtext` → `contenteditable`, with an on-blur save. `richtext` keeps a minimal inline toolbar (bold/italic/link) — scope TBD in plan, default to plain contenteditable if it risks bloat.
   - `image` → click opens a file picker → POST `/api/upload` → swap `src` on success. Respect `constraints.maxFileSizeKb` / `aspectRatio` if present (soft warn).
   - `color` → click opens a native color input seeded from current value; on change, update the field. (Color edits flow through the same override mechanism the existing app uses.)
   - `link` → click opens a tiny popover with label + href.
   - Non-editable fields render inert (no affordance, no outline).
4. **Persist edits.** Each change PUTs `{ slug, fieldId, value }` to `/api/overrides`. The server re-checks permission via `canEditField` — **the client UI is convenience; the server is the gate.** A 403 surfaces a small "You don't have permission to edit this" toast and reverts the on-page change.
5. **Floating action bar** (fixed, bottom-right): **Save status** (auto-saved indicator), **Preview**, **Publish**, **Exit**. Preview → `/api/preview` returns a draft URL (open in new tab). Publish → `/api/publish` (available to both roles). Exit clears the token from `sessionStorage` and reloads the page without `?edit`.

### 3. Backend changes (small, additive)

- `sessionFromRequest`: also accept `Authorization: Bearer <sessionId>`.
- `/api/auth/login`: include `token` in the JSON response.
- CORS + `OPTIONS` on the embed-called routes, restricted to configured site origins (env: `EDITOR_ALLOWED_ORIGINS`, or derive from `*.actiondesignstudio.com` + each client's custom domain).
- Serve `embed.js` (a route or static asset in `editor/app`).
- **Operator seed:** on first run, insert an `operator` credential row from env if none exists; `login()` prefers the DB row, falls back to env.
- **`PUT /api/account/password`** (operator-only): change the admin's own password (verify current, store new hash).

### 4. Admin panel additions (`/admin/{slug}` + a global Account control)

- "Change my password" (admin's own).
- "Set / reset client password" (already backed by `/api/admin/credentials`; surface it).
- "Invite" block: link + username + just-set password, with **Copy** and **`mailto:`** buttons. No email provider.

---

## Data flow (happy path)

1. Operator/client opens `https://{slug}.actiondesignstudio.com/?edit`.
2. `embed-loader` injects `embed.js`.
3. Login overlay → `/api/auth/login` → token + role stored.
4. `embed.js` GETs manifest + draft overrides; marks permitted elements editable.
5. User edits → each change PUTs to `/api/overrides` (perm-checked) → saved to `draft`.
6. **Preview** → `/api/preview` → draft URL.
7. **Publish** → `/api/publish` → merge overrides into deployed HTML → live.
8. **Exit** → token cleared, page reloads clean.

---

## Permissions model (unchanged, restated for clarity)

- **Admin (`operator`):** every tagged field is editable on every site. One global credential.
- **Client (`client`, per slug):** only fields with `clientEditable === true` (set in `/admin/{slug}`) are editable. The embed hides affordances for the rest; the override API enforces it server-side regardless of UI.

---

## Credential management & client invite (new)

All of this lives in the existing `/admin/{slug}` panel (and a small global "Account" control for the admin's own password) — consistent with the decision to keep management out of the inline editor.

### Admin changes their own password

Today the operator credential is env-only (`OPERATOR_USERNAME` / `OPERATOR_PASSWORD_HASH`), which can't change at runtime. Fix:

- **Seed the operator credential into the `credentials` table** (role `operator`, `slug = NULL`) from the env vars on first run if no operator row exists. The `credentials` table already has the needed columns, so **no schema change**.
- `login()` resolves the operator from the DB row when present, falling back to the env vars otherwise (keeps existing deployments working before the seed runs).
- New **`PUT /api/account/password`** (operator session/token required): verifies current password, writes a new bcrypt hash via the existing `setCredential` upsert.
- UI: a small "Change my password" control (current + new + confirm) in the admin area.

### Admin sets / resets a client's password

Already supported by `setCredential` (upsert by username) via `POST /api/admin/credentials`. Surface it cleanly in `/admin/{slug}`:

- Set or reset the client's password (operator-only, min 8 chars — matches the existing route).
- Generating a strong password is a convenience button (client-side random), but the operator may type one.
- **The plaintext is shown to the operator only at set-time** (it's bcrypt-hashed at rest and never retrievable later) — so the invite is generated from the value the operator just set.

### Client invite (copy-paste, no email infra)

After setting a client password, the admin panel shows an **Invite** block containing:

- **Link:** `https://{slug}.actiondesignstudio.com/?edit` (or the client's custom domain if configured).
- **Username** and the **password just set**.
- A **Copy** button (copies a clean, formatted invite message to clipboard).
- A **`mailto:`** button that opens the operator's own email client with subject + body prefilled.

Because the password is only known in plaintext at set-time, the invite is generated in the same step as setting the password. Re-sending later requires resetting the password again (and noting that invalidates the old one).

---

## Error handling

| Case | Behavior |
|---|---|
| Bad credentials | Overlay shows "Invalid credentials"; no user enumeration (matches existing `login()` returning null). |
| Expired/invalid token | API returns 401 → embed drops the token and re-shows the login overlay. |
| Edit a non-permitted field (client) | UI shouldn't offer it; if forced, server 403 → toast + revert on-page change. |
| Upload too large / wrong type | Soft warn before upload; server validates. |
| Preview/Publish failure | Action bar shows the error string from the API; on-page draft is untouched. |
| Page has no manifest field for an element | Element simply isn't editable (no crash). |

---

## Rollout

1. Implement backend affordances (bearer auth, login token, CORS, `embed.js` route) behind tests.
2. Implement `embed-loader` injection in the engine, replacing `injectOperatorEditButton`'s link-button output. Keep QA gate **G-EDIT-01**.
3. Swap the factory build/QA step that injects the old button to inject the loader.
4. Re-push existing clients so they receive the new loader (ops step already tracked in project memory).
5. Set `EDITOR_ALLOWED_ORIGINS` (and confirm `OPERATOR_USERNAME` / `OPERATOR_PASSWORD_HASH` are provisioned — they seed the DB operator row on first run, after which the admin can change the password in-app).

The old `/edit` form route can remain temporarily as a fallback but is no longer the primary path; remove once the inline editor is validated on a live client.

---

## Testing

**Engine**
- `embed-loader` injection: fires only on `?edit`/`#edit`, idempotent, templates `{EDITOR_HOST}`/`{slug}` correctly. (Mirror `edit-button.test.ts`.)

**App (backend)**
- `sessionFromRequest` resolves a session from `Authorization: Bearer` when no cookie; cookie path still works; invalid token → null.
- `/api/auth/login` returns `token` on success; still sets cookie.
- CORS headers present on embed-called routes; `OPTIONS` preflight returns allowed methods/headers.
- `/api/overrides` PUT still rejects non-permitted field for `client` (regression).
- Operator seed: with no operator row, env creds still log in and a row is created; after seed, DB password is authoritative.
- `PUT /api/account/password`: rejects wrong current password; updates hash; old password no longer logs in, new one does; non-operator forbidden.
- `/api/admin/credentials` set/reset client password (existing) still operator-gated (regression).

**Embed (front-end)**
- Login gate: no token → overlay; valid token → editing.
- Permission-driven editability: client sees affordances only on `clientEditable` fields; admin sees all.
- Edit → PUT called with correct `{slug, fieldId, value}`; 403 reverts on-page change.
- Action bar: Preview/Publish call correct endpoints; Exit clears token and reloads without `?edit`.

**Admin panel (front-end)**
- Set client password → invite block renders link + username + the just-set password.
- Copy button copies the formatted invite; `mailto:` href contains the right subject/body.
- "Change my password" calls `PUT /api/account/password` with current + new.

---

## Open items for the implementation plan

- Exact richtext scope (plain contenteditable vs. minimal toolbar) — default to plain unless cheap.
- How `embed.js` is bundled/served (Next route handler vs. static asset) and cache headers.
- Origin allow-list source of truth (env list vs. derived from client records).
- Whether to keep or delete the legacy `/edit` form route after validation.
- Invite delivery: copy/`mailto:` for now; whether to add app-side auto-send (Resend/SMTP) later.
