# Client Site Editor — App (Plan 2) Design Spec

**Date:** 2026-06-02
**Status:** Approved for planning
**Owner:** Michael (Action Studio)
**Builds on:** [Editor engine spec](2026-06-02-client-site-editor-design.md) + the merged engine at `editor/engine/` (`@action-studio/editor-engine`).

---

## 1. Goal

Make the editor real and usable end-to-end: a hosted, password-protected app where a contractor logs in and edits the parts of their live site you've allowed (text, images, brand colors, CTA links), previews, and publishes — with the published result redeployed to the same Vercel project their domain points at. Plus the two factory fixes that make links and colors fully editable.

**The operator's real-world workflow this serves:**
1. Call + payment.
2. You point the client's domain DNS at their `{slug}-site` Vercel project.
3. You click **"Push to editor"** in your local operator app.
4. You email the client the editor link + their password.
5. They log in, edit within the permissions you set, and **Publish** — which redeploys `{slug}-site`, so their live domain updates.

---

## 2. Durability principle (system of record)

The **hosted app's Postgres + Blob is the source of truth** — not the operator's laptop.
- Factory source (`clients/{slug}/site`) is already safe in the **GitHub repo**.
- Manifest, permissions, client password hashes, and tagged HTML live in **hosted Postgres + Blob** after a push.
- If the operator's machine dies: re-clone the repo; all editor data is still live in the cloud, and permissions/passwords are managed from the hosted app (operator login), reachable from any machine.

---

## 3. Decomposition (three plans)

### Plan 2a — Factory editor-readiness (small, independent)
The two fixes that let the engine tag links and colors on every page.
- **`data-cta`:** add `data-cta` to genuine CTA anchors in section templates (`templates/sections/cta/index.html.template` phone + secondary CTA; the primary hero CTA; CTA buttons in `contact`, `pricing`, `offers` sections). Do **not** add it to nav, footer, or review-badge links.
- **Head on every page:** ensure every built page emits `{{section:head}}` (which carries the inline Tailwind color block). Diagnose and fix the build path that produced a Wind Rose `reviews.html` with no color block; add a build-time assertion that every output page contains the color block.
- **Verification:** re-tag a freshly-built site; expect ≥1 `link` field and the color block present on 100% of pages.

### Plan 2b — Editor backend & operator app
- Hosted Postgres schema + Blob wiring (per the engine spec §8).
- Auth: operator account + per-client credentials (minimal custom — see §6).
- **Ingestion:** engine gains a `push` capability; a **"Push to editor" button in the local `web/` operator app** tags `clients/{slug}/site`, then uploads manifest + tagged HTML + initial tier to the hosted **ingestion API** (operator-token authenticated). The button is in the operator app only — never in client site HTML.
- **Publisher:** a hosted API route runs `mergeSite` on stored tagged HTML + published overrides and deploys to the client's `{slug}-site` Vercel project via the Vercel REST API. Preview → throwaway preview URL; Publish → the prod project.

### Plan 2c — Editor & admin UI
- **Client editor:** form grouped by page → section, per-type widgets (text, richtext, image-upload, color, link), showing only `clientEditable` fields; **Preview** and **Publish** buttons.
- **Operator admin:** per-client permission controls (tier preset + per-field toggles, with the "Custom" label), credential management (set/reset password), and the editor link to send.

Each plan produces working, testable software; 2a ships first, then 2b, then 2c. 2c depends on 2b; both depend on the merged engine and benefit from 2a.

---

## 4. Topology

```
LOCAL (your machine)                    HOSTED on Vercel
┌─────────────────────┐   push (HTTPS,  ┌────────────────────────────┐
│ web/ operator app   │  operator token)│ editor.actiondesignstudio  │
│  • lists clients    │ ───────────────▶│  • Postgres (source of     │
│  • "Push to editor" │  manifest +     │    truth) + Blob (images)  │
│    button           │  tagged HTML    │  • client login → edit     │
└─────────────────────┘                 │  • operator login → admin  │
        ▲                                │  • Publish ────┐           │
   factory build                         └────────────────┼──────────┘
   (clients/{slug}/site, in git)                          │ Vercel REST API
                                                           ▼  (redeploy)
                                          client's {slug}-site Vercel project
                                          (their domain's DNS points here)
```

---

## 5. Components & responsibilities

| Component | Plan | Responsibility |
|---|---|---|
| Factory template fixes | 2a | `data-cta` on CTAs; head/color block on every page; build-time assertion |
| `editor-engine push` | 2b | Tag a local site + POST manifest/tagged-HTML to ingestion API |
| "Push to editor" button + route | 2b | Operator-app UI + local API route that invokes the push for a `{slug}` |
| Store (Postgres + Blob) | 2b | Durable manifests, overrides (draft/published), credentials, tagged HTML, uploaded images |
| Ingestion API | 2b | Operator-token endpoint that persists a pushed client into the Store |
| Auth | 2b | Operator + per-client sessions (bcrypt + signed cookie + rate limit) |
| Publisher | 2b | `mergeSite` + Vercel REST deploy (preview + prod) |
| Client editor UI | 2c | Permission-filtered edit form, preview, publish |
| Operator admin UI | 2c | Permissions (tier + per-field), credentials, editor link |

The hosted app reuses the engine package (`mergeSite`, schemas, permission resolution) — no logic duplication.

---

## 6. Auth (minimal custom)

- Per-client `username + password`; one operator account. Passwords stored as **bcrypt hashes** in Postgres.
- **httpOnly, Secure, SameSite=Lax signed session cookie**; sessions table in Postgres.
- Basic **rate limiting** on login (per-IP + per-account backoff).
- Client sessions are scoped to their own `{slug}`; operator sessions can access all clients + admin.
- Password reset is operator-driven (operator sets/regenerates a client password from admin).

(Alternative considered: Auth.js credentials provider — rejected for v1 as heavier than needed for a single operator + simple per-client passwords.)

---

## 7. Data flow (edit → publish)

```
Push (local)  ──► ingestion API ──► Store: manifest + tagged HTML + initial tier
Client login ──► editor form (clientEditable fields only) ◄── manifest from Store
   │ autosave
   ▼
draft overrides (Store) ──► "Preview" ──► mergeSite ──► Vercel preview URL
   │ Publish
   ▼
published overrides ──► mergeSite ──► Vercel prod deploy of {slug}-site ──► live domain
```
Original tagged HTML is never mutated; overrides merge on top, so any field resets to factory default by clearing its override.

---

## 8. Error handling & edge cases

- **Push:** reject if `clients/{slug}/site` missing or untagged; surface engine `orphans`/warnings; require a valid operator token; idempotent re-push updates the manifest while preserving existing client overrides keyed by stable `data-edit` id (orphaned overrides are reported, not silently dropped).
- **Publish:** if the Vercel deploy returns non-2xx or the verify HEAD fails, keep the previous live deploy and report failure (never leave the client domain broken). Concurrency: a publish-in-progress lock per `{slug}`.
- **Image upload:** enforce manifest `constraints` (format, max size, aspect) before writing to Blob; reject oversized/wrong-format with a clear message.
- **Auth:** generic login errors (no user-enumeration); lock after repeated failures.
- **Color edits:** rely on Plan 2a so every page carries the block; if a page still lacks it, the merge reports it rather than failing.

---

## 9. Testing strategy

- **2a:** template-fix verification — build a site (or use the existing build harness), assert `data-cta` present on CTA anchors only (not nav/footer) and the color block on every page; re-tag and assert ≥1 link field + colors across all pages.
- **2b:** unit-test the ingestion API (persist/round-trip a pushed manifest), auth (hash/verify, session issue/expire, rate-limit), and the Publisher's merge step against fixtures; mock the Vercel API for deploy-failure handling. The `push` command tested against a local fixture site hitting a test server.
- **2c:** component tests for field widgets and permission filtering (client sees only `clientEditable`); an end-to-end happy path (login → edit text + color + image → preview → publish) against a stubbed Publisher.

---

## 10. Out of scope (v1)

Section add/remove/reorder (the reserved v2 concept), multi-user client teams, edit history beyond draft/published/factory-default, and automated DNS changes (operator does DNS manually, by design).

---

## 11. Open risks

- **Static deploy via Vercel REST API** from a serverless function (uploading merged files to the `{slug}-site` project) needs a spike in Plan 2b to confirm the exact API calls and that the custom-domain alias is preserved across deploys.
- **Re-push vs. live overrides:** the manifest can change when a site is rebuilt; the ingestion merge must preserve still-valid overrides and clearly report orphaned ones (depends on the engine's stable-id contract).
- **`data-cta` coverage:** Plan 2a must mark the *right* anchors; a missed CTA simply isn't editable (safe), an over-marked nav link clutters the manifest (operator can disable). Verification guards both.
