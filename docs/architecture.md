# Action Studio — Website Factory Architecture

> One URL goes in. A complete, evidence-backed, brand-DNA-matched contractor website comes out. In a single automated run.

This document is the single source of truth for how the factory is organized, how a run flows, and which artifact each phase produces. Every other document in this repo points back here.

---

## 1. What this is (and isn't)

**This is** a Claude-orchestrated content + design pipeline that turns a contractor's existing online presence into a $20K–$30K-grade multi-page website. The work that a traditional agency stretches over 3 months — discovery calls, brand audits, competitor decks, copywriting rounds, design comps, QA passes, proposal write-ups — is executed by a chain of specialized subagents reading from versioned SOPs.

**This is not** a templated site builder. Two contractors in the same city in the same trade get two different sites because the inputs (their brand, their reviews, their photos, their gaps) are different. Templates are scaffolding; the content is bespoke and evidence-backed.

---

## 2. The 8 phases

| # | Phase | Substeps | Primary agent | Output artifacts |
|---|---|---|---|---|
| 1 | **Discovery** | 01 Brief · 02 Research | `discovery-researcher` | `brief.md`, `research/competitors.md`, `research/market.md`, `research/site-scorecard.md` |
| 2 | **Capture** | 03 Asset Extraction | `asset-extractor` | `assets/raw/`, `assets/manifest.json`, `evidence/reviews.json` |
| 3 | **Brand DNA** | 04 Brand Audit | `brand-auditor` | `brand/brand-dna.md`, `brand/palette.json`, `brand/typography.json`, `brand/voice.md` |
| 4 | **Strategy** | 05 Content Architecture · 06 Information Design · 07 SEO + Content · 08 Design Intelligence · 09 Creative Direction | `content-architect`, `seo-strategist`, `design-director` | `strategy/sitemap.md`, `strategy/wireframes.md`, `strategy/keywords.md`, `strategy/copy.md`, `strategy/design-direction.md` |
| 5 | **Build** | 10 Build | `site-builder` | `site/` — Home, About, Services (+ per-service detail), Reviews, plus shared header/footer/tailwind config |
| 6 | **Quality** | 11 QA Audit · 12 Auto-Iterate | `qa-auditor`, `iterator` | `qa/report.md`, `qa/iterations/01..03/` |
| 7 | **Sales-Ready** | 13 Proposal | `proposal-writer` | `proposal/proposal.pdf`, `proposal/cover.png` |
| 8 | **Deploy & Handoff** | 14 Deploy | `deploy-engineer` | `deploy/manifest.json`, `deploy/preview-url.txt`, `deploy/handoff.md` |

The two new substeps (05 Content Architecture, 06 Information Design) fill the gap that existed in the original 7-Phase doc between Brand Audit and SEO + Content. Without them, the Strategy phase had no place where the *sitemap* and *section-by-section information hierarchy* were committed to paper before copy was written.

Phase 8 (Deploy) is new — it pushes the built site to Vercel under a preview subdomain and generates the handoff packet so the proposal in Phase 7 can embed a working live URL.

---

## 3. Repository layout

```
action-studio-factory/
├── CLAUDE.md                       # Master orchestrator instructions. Every run reads this first.
├── README.md                       # How to run the factory.
├── .claude/
│   ├── settings.json               # Allowed tools, MCP wiring.
│   └── agents/                     # One file per subagent. Each is a tight system prompt.
├── sops/                           # 00..14. The authoritative procedure for each substep.
├── skills/                         # Reusable capabilities (review scraping, color extraction, etc.).
├── templates/
│   ├── pages/                      # Full-page templates with {{tokens}}.
│   ├── sections/                   # Section partials reused across pages.
│   ├── shared/                     # header/footer/tailwind config shared across pages.
│   └── proposal/                   # Proposal cover + body templates.
├── recipes/                        # Per-sub-vertical defaults (roofing, hvac, exteriors, remodel).
├── quality-gates/checklist.yml     # 30+ pass/fail gates the QA agent enforces.
├── scripts/                        # Operator entry points (new-client.sh, start-run.sh).
├── clients/{slug}/                 # One folder per client. Created at runtime. Everything below.
└── docs/                           # Architecture, how-to-run, phase reference.
```

### Per-client folder (created at run time)

```
clients/{slug}/
├── brief.md                        # Phase 1: single source of truth
├── research/
│   ├── competitors.md              # 3–5 competitor teardowns
│   ├── market.md                   # Local market map
│   └── site-scorecard.md           # Contractor's existing site scored on 12 axes
├── assets/
│   ├── raw/                        # Scraped assets, unmodified
│   ├── processed/                  # Resized/optimized variants
│   └── manifest.json               # Type, source URL, license claim, dimensions
├── evidence/
│   ├── reviews.json                # Verified Google + Facebook reviews
│   └── badges.json                 # Certifications/affiliations scraped
├── brand/
│   ├── brand-dna.md                # Audit + positioning
│   ├── palette.json                # Extracted color system
│   ├── typography.json             # Font pairings + sizes
│   └── voice.md                    # Tone, vocabulary, do/don't
├── strategy/
│   ├── sitemap.md
│   ├── wireframes.md               # Section order per page
│   ├── keywords.md                 # Local-SEO keyword plan
│   ├── copy.md                     # Every headline, sub, CTA, bullet
│   └── design-direction.md         # Hero composition, motif, mascot decision
├── site/                           # The actual built website
│   ├── index.html
│   ├── about.html
│   ├── services/
│   │   ├── index.html
│   │   └── {service-slug}.html
│   ├── reviews.html
│   ├── assets/
│   └── tailwind.config.js
├── qa/
│   ├── report.md                   # Pass/fail across the 30+ gates
│   └── iterations/01..03/          # Diff + rationale per fix
├── proposal/
│   ├── proposal.pdf
│   └── cover.png
└── deploy/
    ├── manifest.json
    ├── preview-url.txt
    └── handoff.md
```

The folder structure *is* the audit trail. Anything a lead asks about how their site got built is documented inside.

### 3.1 Template syntax (the resolver)

Templates under `templates/pages/`, `templates/sections/`, and `templates/walkthrough/` use a small custom syntax resolved at build/proposal time. The resolver handles four constructs, in this order of precedence:

| Construct | Syntax | Resolved by | Notes |
|---|---|---|---|
| **Conditional block** | `{{#if_<condition>}}...{{/if_<condition>}}` | SOP 10 (build), SOP 13 (proposal) | Evaluated first. Strips the entire block if false. |
| **Section include** | `{{section:<name>}}` | SOP 10 (build) | Splices in `templates/sections/<name>/index.html.template`. |
| **Loop** | `{{#loop:<name>}}...{{item.field}}...{{/loop:<name>}}` | SOP 10 (build) | Iterates over the named collection in `strategy/copy.md`. |
| **Token / asset** | `{{token}}`, `{{asset:<name>}}` | SOP 10 (build), SOP 13 (proposal) | Token lookup in `strategy/copy.md` (or proposal-specific sources). Asset resolves to relative path inside `site/assets/` or `sales/assets/`. |

**Conditional list (v1).** Conditionals are evaluated against the run context (brief.md frontmatter + spec options). Supported names:

| Condition | True when |
|---|---|
| `if_mode_url` | `brief.md` frontmatter `_meta.mode == "url"` (or unset — URL mode is the default) |
| `if_mode_name_and_reviews` | `brief.md` frontmatter `_meta.mode == "name-and-reviews"` |
| `if_standard_tier` | run was triggered with `tier == "standard"` (default) |
| `if_pro_tier` | run was triggered with `tier == "pro"` |

**Resolver rules:**

- Conditionals are evaluated **before** token substitution — a token might land inside a stripped block, in which case the token never needs to resolve.
- Conditionals **do not nest** in v1. Each `{{#if_X}}...{{/if_X}}` block is a flat pair on the same nesting level. If you need both conditions, write the inner content twice.
- An unknown condition name (typo, deprecated condition) raises a build error rather than silently treating as false. This prevents stale conditionals from hiding template bugs.
- An unresolved `{{token}}` after the full resolution pass halts the build with the token name surfaced. There is no silent fallback.

The walkthrough template (`templates/walkthrough/walkthrough.html.template`) is the first user of conditionals. See `templates/walkthrough/README.md` and `sops/13-proposal.md` for the per-token resolution table and the rendering procedure.

---

## 4. The orchestrator contract

When an operator says any of:

- `run a fresh lead for {URL}`
- `build a site for {URL}`
- `run {URL}`

…the orchestrator (defined in `CLAUDE.md` and `.claude/agents/orchestrator.md`) executes the following loop:

1. **Slug.** Derive `{slug}` from the URL (`https://capstonecontractingsolutions.com` → `capstone-contracting`).
2. **Scaffold.** Run `scripts/new-client.sh {slug} {URL}` — creates `clients/{slug}/` with the empty sub-folders above and writes `brief.md` with `url: {URL}`, `status: scaffolded`.
3. **Delegate each phase to its agent**, in order, using the SOP files as the authoritative procedure. After each phase:
   - Verify the expected output artifacts exist.
   - Update `brief.md` `status:` field (`research-complete`, `assets-complete`, …).
   - Fail fast if a quality gate fails irrecoverably (see §6).
4. **QA loop.** After Build, run QA. If gates fail, hand off to `iterator` with the failure list. Re-run QA. Maximum 3 iterations.
5. **Proposal.** Embed the live preview URL produced in Deploy.
6. **Deploy.** Push site to Vercel under `{slug}.actiondesignstudio.com`. Write `handoff.md`.
7. **Done.** Print one-line summary: `{slug} | {pages} pages | {iterations} iterations | preview: {url}`.

---

## 5. Data flow between phases (the brief is the spine)

`brief.md` is the contractor's master profile. Every downstream phase reads it before doing anything. Every phase that produces structured findings appends to it (under timestamped headings) and writes detail to its own sub-folder.

Minimum schema for `brief.md` after Phase 1:

```yaml
---
url: https://...
slug: ...
status: research-complete
brand_name: ...
owner_name: ...
trade: roofing | hvac | exteriors | remodel | ...
sub_trade: residential | commercial | both
services: [..., ...]
geography:
  primary_city: ...
  metro: ...
  service_radius_miles: ...
  service_areas: [..., ...]
certifications: [..., ...]
review_summary:
  google_rating: 4.8
  google_count: 127
  facebook_rating: 4.9
  facebook_count: 64
competitors: [..., ..., ...]   # 3–5 URLs
ranking_keywords: [..., ...]
gaps: [..., ...]
---
```

Phases 2–8 may add fields but never overwrite Phase 1's values without an entry in a `# Decision Log` section explaining why.

---

## 6. Quality gates (fail-fast philosophy)

Quality gates run in two places:

- **Inline gates** — each SOP has exit criteria. If those are not met, the SOP halts and reports up. The orchestrator decides whether to retry or stop the run.
- **Aggregate QA pass** — after Build, `qa-auditor` runs every check in `quality-gates/checklist.yml`. Failures route to `iterator` for auto-fix.

A run that exits cleanly has:

1. All expected output artifacts present in the expected folders.
2. `qa/report.md` shows all gates green.
3. `deploy/preview-url.txt` returns 200 on HEAD request.
4. `proposal/proposal.pdf` exists and is non-zero bytes.

If any of those fail at completion time, the orchestrator marks `status: failed` in `brief.md` and surfaces the failure to the operator.

---

## 7. Run modes

| Mode | Trigger | Behaviour |
|---|---|---|
| **Fresh lead** | `run a fresh lead for {URL}` | Full 8-phase run end-to-end. |
| **Resume** | `resume {slug}` | Continue from the last completed phase recorded in `brief.md`. |
| **Single phase** | `run phase {n} for {slug}` | Execute one phase only. Used for iteration during factory development. |
| **Re-QA only** | `re-qa {slug}` | Skip build, just re-run QA + iterate. |

---

## 8. Tech stack of the *generated* sites

- **HTML** — semantic, accessible, one file per page.
- **CSS** — Tailwind via CDN (matches the Capstone reference); shared `tailwind.config.js` per client overrides theme tokens from `brand/palette.json` and `brand/typography.json`.
- **JS** — vanilla, minimal. Used only for FAQ accordions, mobile nav, form validation. No build step.
- **Pages (Standard tier, day-one):** Home, About, Services index + per-service detail pages, Reviews. Each contractor recipe defines its services list, so Services fans out automatically.
- **Pages (Pro tier, expansion):** customer portal, blog/CMS, gallery search, online booking, financing widget, multi-language. Hooks documented in `docs/phase-reference.md` so the factory can pick up these requirements when recipes opt into the pro tier.
- **Deploy target:** Vercel as static site. Each client's `site/` becomes a Vercel project; preview lives at `{slug}.actiondesignstudio.com`.

---

## 9. What this architecture deliberately rejects

- **Client questionnaires.** Phase 1 scrapes existing online presence rather than asking. If a contractor wanted to fill out a form, they'd have hired a normal agency.
- **Stock photography.** Phase 2 fails if it cannot extract a real logo and at least 6 real project photos. The factory does not paper over missing real assets.
- **Unverified claims.** Every star rating, every "trusted by 100+ homeowners" claim must trace to a row in `evidence/reviews.json`. The QA gates enforce this.
- **Sequential dependence on a human.** The only human input is the URL at the start and the approval at the end. Everything between is automated.

---

## 10. What is *intentionally* deferred to a later version

- Multi-language sites (hook exists in recipes; not built in v1).
- A/B testing infrastructure.
- Lead-routing integrations (HubSpot, Salesforce). The factory produces a contact form that posts to a configurable webhook; integrations are the operator's concern.
- Customer portal / auth (mentioned for Pro tier — hooks documented, not implemented in v1).

See `docs/phase-reference.md` for the full deferred-features list and the file location where each will live.
