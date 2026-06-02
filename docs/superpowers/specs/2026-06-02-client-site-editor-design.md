# Client Site Editor — Design Spec

**Date:** 2026-06-02
**Status:** Approved for planning
**Owner:** Michael (Action Studio)

---

## 1. Problem & Goal

Action Studio's factory ships bespoke, SEO-tuned, static multi-page HTML sites to Vercel. Clients are increasingly asking to make their own small edits — text, photos, brand colors — without coming back to the agency for every change.

**Goal:** a password-protected, browser-based editor where a client can change approved parts of their live site (text, images, colors), preview the result, and publish it — while the agency (operator) retains full control over *what* each client is allowed to touch, and can use the same tool with full power for itself.

**Non-goals (v1):** structural editing (adding/removing/reordering sections), multi-user client teams, version history beyond "current draft vs published vs factory default", and any change to how the factory writes copy/design.

---

## 2. Core Principle: Customizability via a Manifest

Everything editable on a site is declared in a per-client **`editable.json` manifest**. The manifest is the single source of truth for what can be edited, by whom, and how. Each entry is one field:

```json
{
  "id": "hero-headline",
  "page": "index.html",
  "section": "Hero",
  "label": "Main headline",
  "type": "text",
  "value": "Regina's Trusted Mechanical Pros",
  "clientEditable": true,
  "constraints": { "maxLength": 60 }
}
```

**Field types:** `text` · `richtext` · `image` · `color` · `link` · `list` (repeatable items such as services or reviews).

**Per-type constraints (examples):**
- `text` — `maxLength`
- `richtext` — allowed formatting (bold/italic/lists only)
- `image` — allowed formats, max file size, target aspect ratio / dimensions
- `color` — free picker **or** a constrained palette of safe swatches
- `link` — URL validation
- `list` — min/max item count, item sub-schema

The manifest is authored two ways, both no-code:
- **Auto-draft:** the factory (or the retrofit Tagger) generates a first-pass manifest from the built HTML — tagging headlines, body copy, images, and brand colors.
- **Operator edit:** in the editor, the operator can add, remove, relabel, regroup, and constrain any field.

---

## 3. Two-Layer Permission Model

Each client has two complementary controls over what is `clientEditable`:

1. **Permission tier (fast path).** A per-client preset dropdown:
   - `Text only`
   - `Text + Pictures`
   - `Text + Pictures + Colours`
   - `Everything`

   Selecting a tier **bulk-sets** `clientEditable` across all fields whose type falls in that tier (e.g. `Text + Pictures` enables all `text`/`richtext`/`image`/`link`/`list` fields and disables `color`). One click configures most clients.

2. **Per-field override (fine path).** After a tier is chosen, the operator may flip any individual field on/off. As soon as a field's state diverges from its tier, the client's tier label displays **"Custom"** to signal hand-tuning.

**Resolution rule:** effective `clientEditable` = the field's explicit per-field setting if one exists, otherwise the tier default for that field's type. The stored manifest persists the resolved boolean per field plus the selected tier name (or `"custom"`), so resolution is deterministic and inspectable.

---

## 4. Roles

- **Operator (Michael).** One master login. Full access to every client, every field (regardless of `clientEditable`), the manifest editor, the tier/permission controls, and client credential management.
- **Client.** Per-client username + password issued by the operator. Sees only their own site and only fields where effective `clientEditable === true`. Cannot see the manifest editor or permission controls.

---

## 5. Components

Five independently-testable units:

| Component | Responsibility | Inputs | Outputs |
|---|---|---|---|
| **Tagger** | Inject `data-edit="<id>"` attributes into built HTML and generate the draft `editable.json`. Runs as a new factory sub-step for new sites and as a standalone retrofit script for the 5 already-deployed sites. | Site HTML | Tagged HTML + draft manifest |
| **Editor app** | Next.js app on Vercel. Auth → dashboard form (grouped by page → section) → preview → publish. Hosts both operator and client experiences. | Manifest, store | User edits → draft/published overrides |
| **Store** | Persist per-client manifest, draft overrides, published overrides, and uploaded image references. Vercel Postgres (structured data) + Vercel Blob (image binaries). | — | — |
| **Merger** | Pure function: original tagged site + an overrides set → final HTML. Swaps text/richtext by `data-edit` id, rewrites image `src` to Blob URLs, rewrites brand-color CSS variables. | Tagged HTML + overrides | Final static site |
| **Publisher** | Run Merger, then deploy the result to Vercel (reusing the existing `skills/deploy-vercel` flow). Manages a preview alias and the production alias. | Merged site + Vercel API | Live/preview deployment |

**Boundaries:** the Merger is a deterministic, side-effect-free transform (easy to unit-test against fixtures). The Tagger is the only component that writes `data-edit` ids, so id stability is owned in one place. The Publisher is the only component that calls Vercel.

---

## 6. Data Flow

```
Factory build ──► Tagger ──► tagged site + editable.json ──► Store
                                                              │
Client/Operator login ──► Editor form ◄── manifest ──────────┘
        │ save
        ▼
   draft overrides (Store) ──► "Preview" ──► Merger ──► Vercel preview URL
        │ Publish
        ▼
   published overrides ──► Merger ──► Vercel prod alias (live site)
```

The original tagged factory output is **never mutated**. Overrides merge on top at publish time, so any field can be reset to its factory default by clearing its override.

---

## 7. Publish Flow (Preview, then Publish)

1. Edits autosave as **draft overrides** keyed by client slug.
2. **Preview** runs the Merger on draft overrides and deploys to a per-client preview alias (e.g. `{slug}-preview.actiondesignstudio.com`); the editor links to it.
3. **Publish** promotes draft → **published overrides**, runs the Merger, and deploys to the production alias (`{slug}.actiondesignstudio.com`).
4. Nothing reaches production without an explicit Publish. A typo or bad color never auto-goes-live.

---

## 8. Storage Schema (initial)

**Postgres**
- `clients` — slug (PK), display name, permission_tier, created_at.
- `client_credentials` — slug (FK), username, password_hash, role.
- `manifests` — slug (FK), JSON manifest (field definitions + resolved `clientEditable` + constraints), updated_at.
- `overrides` — slug (FK), state (`draft` | `published`), JSON map of field-id → value, updated_at.

**Blob**
- Uploaded images under `clients/{slug}/uploads/{field-id}/{filename}`; the override value for an `image` field stores the resulting Blob URL.

---

## 9. SEO & Quality Safeguards

- Edited content is **baked into the served HTML** at publish (Merger output), preserving the SEO that the factory's Phase 4 produces. No runtime DOM injection.
- `text`/`image`/`color` constraints prevent layout-breaking input (over-long headlines, oversized/wrong-aspect images, off-palette colors).
- Color edits target CSS variables only, so the design system's relationships (contrast, accents) stay intact rather than letting clients restyle arbitrary elements.

---

## 10. Scope: v1 vs v2

- **v1 (this spec):** text, richtext, images, brand colors; the manifest + two-layer permission model; operator/client roles; preview/publish; Tagger (new-build sub-step + retrofit script); Postgres + Blob store.
- **v2 (planned fast-follow):** add/remove/reorder **sections**. Requires a section-template library and a structural page model — materially larger, and intentionally deferred so v1 ships sooner.

---

## 11. Open Questions / Risks

- **Id stability across rebuilds.** If the factory rebuilds a site, `data-edit` ids must remain stable or overrides orphan. Mitigation: derive ids deterministically from page + section + role (not from DOM order); the Merger logs any override whose id is missing in the current HTML rather than failing silently.
- **Retrofit coverage.** The 5 deployed sites were built before the Tagger existed; the retrofit script must tag them and produce sensible manifests. Acceptance: each retrofitted site yields a manifest a human can read and edit without surprises.
- **Auth hardening.** Per-client passwords need hashing + rate limiting; this is more than the operator app's single Basic-Auth credential. Use a vetted session/cookie approach.
```
