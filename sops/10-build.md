# SOP 10 — Build

## Purpose
Assemble the multi-page site from templates, section partials, copy, and design direction. Tailwind via CDN. Mobile-first. Accessible. Conversion-tuned.

## Inputs
- `clients/{slug}/brief.md`
- `clients/{slug}/strategy/sitemap.md`, `wireframes.md`, `copy.md`, `keywords.md`, `design-direction.md`
- `clients/{slug}/brand/palette.json`, `typography.json`
- `clients/{slug}/assets/processed/`
- `templates/pages/*.html.template`
- `templates/sections/{name}/index.html.template`
- `templates/shared/*`

## Steps

1. **Configure Tailwind for this client.** Write `clients/{slug}/site/tailwind.config.js` based on `templates/shared/tailwind.config.js.template`. Inject `theme.extend.colors` from `palette.json` (every role becomes a color: `colors.primary`, `colors.ink`, etc.). Inject `theme.extend.fontFamily` from `typography.json`. Inject the type scale from `typography.json.scale`.

2. **Process the page list.** For each page in `sitemap.md`:
   - Read `templates/pages/{type}.html.template`. Type comes from the page kind: `home`, `about`, `service-index`, `service-detail`, `reviews`, `contact`, `area`.
   - For each `{{section:name}}` placeholder in the template, splice in `templates/sections/{name}/index.html.template`.
   - For each `{{token}}` placeholder anywhere in the result, resolve via `strategy/copy.md`. Fail loudly if a token is missing.
   - Replace asset placeholders (`{{asset:logo}}`, `{{asset:project-3}}`) with relative paths into `site/assets/`. Copy or symlink the processed asset.
   - Write the result to `site/{path}.html`.
   - **Every page MUST include `{{section:head}}`** (it carries the inline Tailwind color block). Do not omit it on any page — the editor relies on it for color edits, and QA gate G-EDIT-01 fails the build if any page lacks it.

3. **Sections present per design-direction signatures.** For each signature move in `design-direction.md`:
   - If the named partial exists in `templates/sections/{name}/`, ensure it's used at least once.
   - If marked NEW, create the partial under `templates/sections/{name}/index.html.template` first (so future builds can reuse it), then use it.

4. **Copy / link processed assets** into `site/assets/`. Naming: keep the manifest names. Multiple sizes go side-by-side (`project-1-800w.webp`, `project-1-1200w.webp`); use `<img srcset>` for responsive selection.

5. **Header + footer.** Insert `templates/shared/header.html.template` and `templates/shared/footer.html.template` at the top/bottom of every page (after `{{token}}` resolution).

6. **Link check.** After every file is written, walk each HTML file, extract every `<a href>`, `<img src>`, `<link href>`, `<script src>`. Each must either be a full external URL with protocol or resolve to a file inside `site/`. Any broken reference → halt.

7. **Validation.** Run a lightweight HTML linter: no unclosed tags, no duplicate IDs, every `<img>` has alt, every form input has label, all `<a>` have href.

8. **Set `status: built`.**

## Outputs
- `site/index.html`, `site/about.html`, `site/reviews.html`
- `site/services/index.html`, `site/services/{slug}.html` for each service
- `site/areas/{slug}.html` for each area (if enabled)
- `site/tailwind.config.js`
- `site/assets/` populated

## Exit criteria
- All sitemap pages exist and are non-empty.
- Link check passes (no broken references).
- HTML linter passes.
- All design-direction signature moves are present in at least one page.

## Contact form (all builds)

All forms must use `action="/api/contact" method="POST"`.
Never use `action="/api/lead"` — that endpoint does not exist.

The `/api/contact` handler is wired at handoff time via:
  scripts/wire-contact.sh {slug} {client-email}

During build and QA the form action is present but the handler
is not deployed — this is expected. The QA checklist (G-30)
verifies the form markup is correct but does not test live submission.

The `{{client_email}}` token must be recorded in `strategy/copy.md`
before Phase 8 runs, so the deploy phase can wire it automatically.
