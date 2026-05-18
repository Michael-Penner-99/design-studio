# SOP 00 — Orchestrator Contract

> The procedure the top-level Claude (the orchestrator) executes when a run is triggered. Every other SOP assumes this contract has been followed.

## Purpose

Translate a single operator trigger (`run a fresh lead for {URL}`) into a complete, audited 8-phase run with no further human input required.

## Inputs

- A URL (the contractor's existing website).
- Optional run mode (default: fresh-lead).

## Steps

### 1. Parse the trigger

Extract the URL. Validate it resolves (HEAD request returns < 400). If it doesn't, halt and tell the operator the URL is dead.

### 2. Derive the slug

Slug rules:
- Strip protocol, `www.`, trailing slash, TLD.
- Lowercase, replace non-alphanum with `-`, collapse multiple `-`, trim leading/trailing `-`.
- Truncate to 40 chars.

Examples:
- `https://capstonecontractingsolutions.com` → `capstonecontractingsolutions`
- `https://www.smith-and-sons-roofing.com/` → `smith-and-sons-roofing`

### 3. Scaffold the client folder

Run `scripts/new-client.sh {slug} {URL}`. This creates:

```
clients/{slug}/
├── brief.md         # with frontmatter pre-filled (url, slug, status: scaffolded)
├── research/
├── assets/{raw,processed}/
├── evidence/
├── brand/
├── strategy/
├── site/
├── qa/
├── proposal/
└── deploy/
```

### 4. Delegate Phase 1: Discovery

Delegate to `discovery-researcher` with:
- slug
- SOPs: `sops/01-brief.md`, `sops/02-research.md`
- Expected outputs:
  - `clients/{slug}/brief.md` populated with full YAML schema (see `docs/architecture.md` §5)
  - `clients/{slug}/research/competitors.md` (3–5 competitor teardowns)
  - `clients/{slug}/research/market.md`
  - `clients/{slug}/research/site-scorecard.md` (12-axis score of contractor's existing site)

Verify all four files exist and brief.md frontmatter has: `trade`, `services`, `geography.primary_city`, `competitors` (≥3), `review_summary`. If any missing → halt with reason.

Update `brief.md` `status: research-complete`.

### 5. Delegate Phase 2: Capture

Delegate to `asset-extractor` with:
- slug
- SOP: `sops/03-asset-extraction.md`
- Expected outputs:
  - `clients/{slug}/assets/raw/` populated (logo, owner-photo, team-photos, project-gallery, badges)
  - `clients/{slug}/assets/manifest.json` listing every asset with source URL, type, dimensions
  - `clients/{slug}/evidence/reviews.json` (≥10 verified Google + Facebook reviews combined)

Halt conditions:
- No logo recoverable.
- Fewer than 6 real project photos.
- Fewer than 10 review entries across Google + Facebook.

Update `brief.md` `status: assets-complete`.

### 6. Delegate Phase 3: Brand DNA

Delegate to `brand-auditor` with:
- slug
- SOP: `sops/04-brand-audit.md`
- Expected outputs:
  - `clients/{slug}/brand/brand-dna.md`
  - `clients/{slug}/brand/palette.json` (primary, secondary, accent, ink, surface — derived from real assets)
  - `clients/{slug}/brand/typography.json` (heading + body font pairing + weights + sizing scale)
  - `clients/{slug}/brand/voice.md` (tone, vocabulary, do/don't list)

Update `brief.md` `status: brand-complete`.

### 7. Delegate Phase 4: Strategy

Three sequential delegations within the same phase:

**7a. `content-architect`** (SOPs 05, 06) → produces `strategy/sitemap.md` and `strategy/wireframes.md`.

**7b. `seo-strategist`** (SOP 07) → produces `strategy/keywords.md` and `strategy/copy.md`.

**7c. `design-director`** (SOPs 08, 09) → produces `strategy/design-direction.md`.

Verify all five files exist. `copy.md` must define a value for every `{{token}}` referenced in the page templates the sitemap will use.

Update `brief.md` `status: strategy-complete`.

### 8. Delegate Phase 5: Build

Delegate to `site-builder` with:
- slug
- SOP: `sops/10-build.md`
- Expected outputs:
  - `clients/{slug}/site/index.html` (Home)
  - `clients/{slug}/site/about.html`
  - `clients/{slug}/site/services/index.html`
  - `clients/{slug}/site/services/{service-slug}.html` for each service in `brief.md`
  - `clients/{slug}/site/reviews.html`
  - `clients/{slug}/site/tailwind.config.js`
  - `clients/{slug}/site/assets/` (processed assets referenced by the HTML)

Verify every file referenced by a `<link>`, `<script>`, `<img>` or `<a>` in the built pages resolves. This is a strict gate — broken references halt the run.

Update `brief.md` `status: built`.

### 9. Delegate Phase 6: Quality

**9a. `qa-auditor`** (SOP 11) runs `quality-gates/checklist.yml` against the built site. Produces `qa/report.md` with pass/fail for each gate.

**9b. If any gate fails**, delegate to `iterator` (SOP 12) with the failing-gate list. iterator applies fixes, writes a diff explanation to `qa/iterations/01/`, then loops back to qa-auditor.

Maximum 3 iterations. If gates still fail after 3 → halt with reason.

Update `brief.md` `status: qa-passed`.

### 10. Delegate Phase 8: Deploy (before Phase 7)

The proposal needs a live URL to embed, so deploy runs *before* proposal.

Delegate to `deploy-engineer` (SOP 14):
- Push `site/` to Vercel as a static project named `{slug}` under `actiondesignstudio.com`.
- Wait for `{slug}.actiondesignstudio.com` to return 200.
- Write `deploy/preview-url.txt`, `deploy/manifest.json`, `deploy/handoff.md`.

Update `brief.md` `status: deployed`.

### 11. Delegate Phase 7: Proposal

Delegate to `proposal-writer` (SOP 13). Inputs include `deploy/preview-url.txt`. Output: `proposal/proposal.pdf` + `proposal/cover.png`.

Update `brief.md` `status: proposal-ready`.

### 12. Final summary

Print one line:
```
{slug} | {pages_count} pages | {iterations_run}/3 iterations | preview: {url} | proposal: {pdf_path}
```

Update `brief.md` `status: complete`.

## Outputs

Per-client folder fully populated. `brief.md` final `status: complete`.

## Exit criteria

- All artifacts listed in steps 4–11 exist and are non-empty.
- `qa/report.md` shows all gates green (or explicitly marked deferred with rationale).
- HEAD request on `deploy/preview-url.txt` returns 200.
- `proposal/proposal.pdf` is > 0 bytes and opens.
- No `halt.md` present.

## Failure handling

Any halt writes `clients/{slug}/halt.md` containing:
- Phase number, substep, agent that halted
- The specific gate or expectation that failed
- A copy of the relevant logs/outputs
- Suggested operator action

The orchestrator then prints the halt summary and stops. It does not advance through halts under any circumstance.


## Pre-flight (operator responsibility, not orchestrator)

Before kicking off a run, the operator runs `scripts/check-setup.sh`. The orchestrator does not run this itself — if creds are missing, the relevant SOP halts at the appropriate phase with a clear error.

If the operator runs the orchestrator without prerequisites, expected halts:
- Phase 2 halts if GOOGLE_PLACES_API_KEY is missing → `halt.md` says "set GOOGLE_PLACES_API_KEY per docs/setup-checklist.md §2"
- Phase 8 halts if VERCEL_TOKEN is missing → `halt.md` says "set VERCEL_TOKEN per docs/setup-checklist.md §3"
