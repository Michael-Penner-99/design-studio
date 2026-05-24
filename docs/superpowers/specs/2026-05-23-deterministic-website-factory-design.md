# Deterministic Website Factory — Design Spec

**Date:** 2026-05-23
**Branch:** `v2-deterministic`
**Archive of v1:** branch `archive/v1-bespoke`, tag `v1-bespoke-archive` (pushed to origin), plus local copy at `/Users/michaelpenner/code/design-studio-v1-archive`

## Goal

Cut the LLM tokens needed to produce one contractor website to **≤ 25%** of the current cost (target: ~10–15%), while keeping output quality at the level of the gold-standard Capstone site. Every generated site uses the **Capstone layout** — same sections, same structure — differentiated only by colors, fonts, copy, images, and the service/area/review/FAQ lists.

## Why v1 is expensive

The v1 worker runs the pipeline as **8 separate `claude -p` invocations** (`scripts/worker-once.sh`). Each invocation reloads `CLAUDE.md` + `sops/00-orchestrator-contract.md` + phase SOPs + the brief + prior artifacts, then **spawns a subagent that reloads everything again**. A single run is roughly **20 full-context loads**, and on top of that:

- **Build (Phase 5):** the LLM hand-writes ~1,650 lines of HTML token-by-token.
- **Quality (Phase 6):** an LLM audit + auto-iterate loop that re-reads and regenerates the whole site **up to 3×**.
- **Strategy/Brand (Phases 3–4):** ~9 separate prose docs (sitemap, wireframes, keywords, copy, design-direction, brand-dna, palette, typography, voice) that are written and then re-read downstream.

None of the "design" work changes the output shape — the shape is fixed. That is the waste.

## Core idea

```
site = render(content.json, theme.json)          # deterministic Python, 0 LLM tokens
```

The site is a pure function of two small data files. The LLM's only job is **intake**: gather the business's facts, reviews, and assets; write the copy in their voice; choose a theme — emitted as `content.json` + `theme.json`. Everything downstream (build, QA, deploy, sales walkthrough) is mechanical.

## New pipeline

| Step | Mechanism | LLM? | Output |
|---|---|---|---|
| 1. **Intake** | One Claude run (`sops/intake.md`) | **Yes — the only LLM step** | `content.json`, `theme.json`, `assets/` |
| 2. **Build** | `scripts/build.py` | No | `site/` (all pages + `tailwind.config.js`) |
| 3. **QA** | `scripts/qa.py` | No | `qa/report.json` (pass/fail) |
| 4. **Deploy** | `scripts/deploy.sh` (existing) | No | live URL, `deploy/` |
| 5. **Walkthrough** | `scripts/walkthrough.py` | No | `proposal/walkthrough.html` |

The worker goes from **8 `claude -p` calls + ~14 subagent contexts** to **1 Claude call**. No LLM HTML generation; no QA iterate loop.

## Data contracts

### `theme.json`

```json
{
  "colors": {
    "ink": "#080E1A", "navy": "#0F172A", "navy_2": "#0B1322", "card": "#18243A",
    "gold": "#C6A75E", "gold_light": "#E2C786", "gold_dark": "#A6884A",
    "btn_top": "#E7CE8C", "btn_mid": "#CDAE69", "btn_bottom": "#B0934F",
    "metallic_top": "#ffffff", "metallic_bottom": "#c2cad6"
  },
  "fonts": {
    "heading_family": "Anton",
    "body_family": "Montserrat",
    "google_fonts_url": "https://fonts.googleapis.com/css2?family=Anton&family=Montserrat:wght@400;500;600;700;800&display=swap"
  }
}
```

`build.py` derives every gradient and the Tailwind config from `colors` + `fonts`; the template never hardcodes a hex. Default theme = Capstone navy/gold. Intake overrides `gold` and the two font families per client (palette from the logo, font pairing by taste); other roles are derived (e.g. `navy_2` = navy darkened, `card` = navy lightened) unless explicitly set.

### `content.json`

One flat-ish object covering every page. Sketch (full schema lives in `docs/content-schema.md`):

```json
{
  "meta": { "slug": "...", "mode": "url|name-and-reviews", "ai_photos": false, "domain": "slug.actiondesignstudio.com" },
  "business": { "name", "short_name", "trade", "phone_display", "phone_e164", "email",
                "address_line", "primary_city", "metro", "state", "hours", "years_in_business",
                "google_maps_url", "facebook_url" },
  "reviews": { "google": {"rating","count","url"}, "facebook": {"rating","count","url"},
               "featured": [ {"name","stars","text","source"} ] },
  "services": [ {"slug","label","icon","card_body","detail_h1","detail_subline","included":[...] } ],
  "service_areas": ["..."],
  "manufacturers": [ {"name","color","style":"heading|body"} ],
  "hero": {"eyebrow","headline_lines":[...],"subline","checkmarks":[...]},
  "about": {"eyebrow","h2_lines":[...],"body":[...],"vision","mission","badge_number","badge_label"},
  "why": {"eyebrow","h2_lines":[...],"body","pillars":[{"title","body"}]},
  "gallery": {"eyebrow","h2","body"},
  "process": {"eyebrow","h2_lines":[...],"body","steps":[...]},
  "offers": {"eyebrow","h2_lines":[...],"body","cards":[{"title","body","icon"}],"footnote"},
  "faq": [ {"q","a"} ],
  "areas_section": {"eyebrow","h2_lines":[...],"body"},
  "cta": {"eyebrow","h2","body"},
  "seo": { "<page>": {"title","description"} },
  "assets": { "logo":"logo.svg", "hero":"hero-house.jpg", "gallery":["..."], "avatars":["..."], "about":"...", "map":"..." }
}
```

**Recipes provide defaults.** `recipes/{trade}.json` holds a default `content.json` fragment per trade (default services with icons + copy, default FAQ, offers, process, why-pillars, manufacturers, voice vocabulary). Intake produces only the **business-specific delta**; `build.py` deep-merges `recipe ⊕ delta`. This shrinks intake output and keeps trades consistent.

## Components

### Master template — `templates/site/`

Lifted **verbatim from the proven Capstone HTML** (`clients/capstone-contracting/site/`), then tokenized. Files:

- `base.html` — `<head>` (SEO/OG/JSON-LD), header, footer, sticky mobile call bar, inline `<style>` (theme-driven), Tailwind config include.
- `home.html` — hero + quote form, logo strip, marquee, reviews, about, services, why, gallery, process, offers, FAQ, service-areas, CTA. Sections are partials in `templates/site/partials/`.
- `about.html`, `services-index.html`, `service-detail.html`, `reviews.html`, `contact.html`.
- `tailwind.config.js.tmpl`.

The `<style>` block and `tailwind.config.js` are rendered from `theme.json`, so colors/fonts/gradients are fully data-driven. The old `templates/sections/`, `templates/pages/`, `templates/shared/` are removed (superseded).

### Renderer — `scripts/render.py`

Dependency-free (`python3` stdlib only) Mustache-lite supporting `{{var}}` (HTML-escaped), `{{{var}}}` (raw), `{{#list}}…{{/list}}` (loop/truthy), `{{^list}}…{{/list}}` (inverted), and `{{> partial}}` (include). ~80 lines. No pip installs.

### Build — `scripts/build.py`

`build.py <client-dir>`:
1. Load `theme.json` (← recipe/default merge) and `content.json`.
2. Render `tailwind.config.js` and every page from `templates/site/`.
3. Copy `assets/processed/` → `site/assets/` with the names referenced in `content.json`.
4. Write `site/`. Exit non-zero on any unresolved token or missing asset.

### QA — `scripts/qa.py`

`qa.py <client-dir>` runs only the gates that depend on content (the fixed template guarantees the rest). From `quality-gates/checklist.yml`, the live checks become deterministic:
- **G-03** every `<a/img/link/script>` ref resolves inside `site/` or is an absolute URL.
- **G-14/G-15** no leftover `{{` tokens or fragment markers.
- **G-24/G-25** every img has non-empty alt; every input has a label/aria-label.
- **G-04/G-06** every review quote + star rating on the page is present in `content.json.reviews` (which traces to real evidence).
- **G-20/G-21/G-23/G-27** unique `<title>`, meta description ≤155, exactly one `<h1>`, viewport tag present.
- **G-26** WCAG AA contrast of `theme.colors` body text over background ≥ 4.5:1 (computed).
- **G-30** phone present + click-to-call on every page.
Writes `qa/report.json`. Non-zero exit on any critical failure. `quality-gates/checklist.yml` is trimmed to these.

### Intake — `sops/intake.md` + `.claude/agents/intake.md`

One agent, one SOP. Given a URL (crawl) or business-name + pasted reviews:
1. Identify trade → load `recipes/{trade}.json` defaults.
2. Gather identity, services offered, service areas, phone/email/hours, reviews (ratings, counts, 3 real featured quotes).
3. Assets: extract logo + ≥6 real photos (URL mode) or generate placeholders (name-and-reviews mode); derive palette from the logo (`skills/color-extractor`), pick fonts.
4. Write the business-specific copy delta + `theme.json`. Emit `content.json` (delta) + `theme.json` + populated `assets/processed/`.
5. Honor the same **halt** conditions as v1 (no trade, no logo, <6 photos, <10 reviews).

### Walkthrough — `scripts/walkthrough.py`

Renders `templates/walkthrough/walkthrough.html.template` from `content.json` + the deployed URL. Deterministic; no LLM. (Replaces the `proposal-writer` PDF step; a sales HTML page is the deliverable.)

### Worker — `scripts/worker-once.sh`

Replace the 8-phase loop with: `claude -p` (intake) → `build.py` → `qa.py` → `deploy.sh` → `walkthrough.py`, committing run status to `runs/{run-id}.json` after each. One Claude invocation per run.

### Orchestrator instructions — `CLAUDE.md`, SOPs

`CLAUDE.md` rewritten to describe the 5-step flow. SOPs collapse from 16 files (1,288 lines) to ~3: `00-orchestrator-contract.md` (slim), `intake.md`, `deploy.md`. The rest are deleted (superseded by scripts).

### Operator app — `web/`

Minimal change: the queue spec it commits is unchanged in shape (URL or name+reviews). The dashboard reads `runs/{run-id}.json` whose phase list changes from 8 to the 5 steps; update the step labels only.

## What is deleted

- SOPs: `02–13` design/strategy/brand/build/QA/proposal SOPs (kept logic folded into intake or scripts).
- Subagents: `content-architect`, `seo-strategist`, `design-director`, `brand-auditor`, `qa-auditor`, `iterator`, `site-builder`, `proposal-writer`, `deploy-engineer`, `asset-extractor`, `discovery-researcher` → replaced by one `intake` agent (+ deploy stays a script).
- `templates/sections/`, `templates/pages/`, `templates/shared/` → replaced by `templates/site/`.
- The auto-iterate loop entirely.

(All recoverable from the v1 archive.)

## Token math

- **v1:** ~20 full-context loads + ~1,650 lines LLM-authored HTML + up to 3 QA re-read/regenerate cycles.
- **v2:** ~1 context load emitting a few KB of JSON delta. Build/QA/deploy/walkthrough cost zero LLM tokens.

Estimated reduction ≈ **85–90%** (well past the 75% target). Even if intake is later split into research + write (Approach B), it stays ~10× cheaper than v1.

## Backward compatibility & safety

- v1 is fully archived (branch + tag pushed to origin + local copy). Revert = `git checkout main` (untouched) or restore the archive.
- The launchd worker is **stopped** during the refactor; re-enabled at the end.
- v2 work lands on `v2-deterministic`; merge to `main` only after a successful end-to-end test run.

## Verification plan

1. **Golden test:** build Capstone from a `content.json`/`theme.json` extracted from the existing Capstone site; assert the rendered `site/index.html` is structurally equivalent to the archived gold-standard (same sections, same DOM shape, zero leftover tokens, qa.py all-green).
2. **Second trade:** run intake on one of the existing clients (e.g. `platinum-plumbing-heating`) end-to-end through build + qa; confirm a clean site and a green QA report.
3. **Token check:** capture intake `total_cost_usd` / token usage from one real run and compare to a v1 run from the archive; confirm ≤25%.

## Open questions resolved

- **Depth:** deterministic build + QA (user-approved).
- **Approach:** A — single intake call (user-approved).
- **Deliverable:** implement on `v2-deterministic`, archive v1 first (done), merge to main after a green E2E run.
