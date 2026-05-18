# Phase reference

> Per-phase quick reference. One row per substep. Read top-to-bottom for a full run, or jump to a phase when you need to verify or resume.

## Phase 1 — Discovery

### 01 Brief
- **Agent**: `discovery-researcher`
- **SOP**: `sops/01-brief.md`
- **Inputs**: contractor URL
- **Outputs**: `clients/{slug}/brief.md` (frontmatter fully populated + narrative body)
- **Verify**: `grep -c '^[a-z_]\+:' clients/{slug}/brief.md` returns the full schema count
- **Halt if**: trade unidentifiable

### 02 Research
- **Agent**: `discovery-researcher`
- **SOP**: `sops/02-research.md`
- **Inputs**: `brief.md`
- **Outputs**: `research/market.md`, `research/site-scorecard.md`, `research/competitors.md`
- **Verify**: 3 files exist; competitors.md has ≥ 3 H2 headings
- **Halt if**: < 3 viable competitors

## Phase 2 — Capture

### 03 Asset Extraction
- **Agent**: `asset-extractor`
- **SOP**: `sops/03-asset-extraction.md`
- **Inputs**: `brief.md`
- **Outputs**: `assets/raw/`, `assets/processed/`, `assets/manifest.json`, `evidence/reviews.json`, `evidence/badges.json`
- **Verify**: `assets/raw/logo.*` exists; ≥ 6 `project-*` files; `jq 'length' evidence/reviews.json` ≥ 10
- **Halt if**: no logo, < 6 photos, or < 10 reviews

## Phase 3 — Brand DNA

### 04 Brand Audit
- **Agent**: `brand-auditor`
- **SOP**: `sops/04-brand-audit.md`
- **Inputs**: `brief.md`, `assets/raw/`
- **Outputs**: `brand/palette.json`, `brand/typography.json`, `brand/brand-dna.md`, `brand/voice.md`
- **Verify**: palette has all required roles; typography has heading + body; brand-dna.md names an archetype

## Phase 4 — Strategy

### 05 Content Architecture
- **Agent**: `content-architect`
- **SOP**: `sops/05-content-architecture.md`
- **Inputs**: `brief.md`, `research/`, `brand/brand-dna.md`, recipe yaml
- **Outputs**: `strategy/sitemap.md`
- **Verify**: at minimum Home, About, Services index, ≥ 1 Services detail, Reviews, Contact

### 06 Information Design
- **Agent**: `content-architect`
- **SOP**: `sops/06-information-design.md`
- **Inputs**: `strategy/sitemap.md`, `brand/brand-dna.md`
- **Outputs**: `strategy/wireframes.md`
- **Verify**: every sitemap page has a wireframe; token list at bottom is non-empty

### 07 SEO + Content
- **Agent**: `seo-strategist`
- **SOP**: `sops/07-seo-content.md`
- **Inputs**: `strategy/sitemap.md`, `wireframes.md`, `brand/voice.md`, `evidence/reviews.json`, `research/`
- **Outputs**: `strategy/keywords.md`, `strategy/copy.md`
- **Verify**: every token in wireframe token plan has a value in copy.md; numeric claims annotated with source

### 08 Design Intelligence
- **Agent**: `design-director`
- **SOP**: `sops/08-design-intelligence.md`
- **Inputs**: `brand/brand-dna.md`, `research/competitors.md`
- **Outputs**: `strategy/design-direction.md` (Style stance section)
- **Verify**: one style chosen and justified

### 09 Creative Direction
- **Agent**: `design-director`
- **SOP**: `sops/09-creative-direction.md`
- **Inputs**: `strategy/design-direction.md`, `brand/`, `assets/`
- **Outputs**: `strategy/design-direction.md` (Hero + Motifs + Signatures + Mascot)
- **Verify**: 8–12 signature moves named; each maps to a section partial (existing or NEW)

## Phase 5 — Build

### 10 Build
- **Agent**: `site-builder`
- **SOP**: `sops/10-build.md`
- **Inputs**: `brief.md`, `brand/`, `strategy/`, `assets/`, `templates/`
- **Outputs**: `site/index.html`, `about.html`, `services/index.html`, `services/{slug}.html`, `reviews.html`, `tailwind.config.js`, `site/assets/`
- **Verify**: every page in sitemap exists; link-check passes; HTML lint passes

## Phase 6 — Quality

### 11 QA Audit
- **Agent**: `qa-auditor`
- **SOP**: `sops/11-qa-audit.md`
- **Inputs**: `site/`, `quality-gates/checklist.yml`
- **Outputs**: `qa/report.md`
- **Verify**: every gate has an entry; summary verdict line present

### 12 Auto-Iterate
- **Agent**: `iterator`
- **SOP**: `sops/12-auto-iterate.md`
- **Inputs**: `qa/report.md`, `site/`
- **Outputs**: `qa/iterations/{NN}/fixes.md` and edits to `site/`
- **Verify**: every FAIL either edited or deferred
- **Halt if**: 3 iterations reached and FAILs remain

## Phase 7 — Sales-Ready

### 13 Proposal
- **Agent**: `proposal-writer`
- **SOP**: `sops/13-proposal.md`
- **Inputs**: `brief.md`, `research/competitors.md`, `brand/`, `evidence/`, `deploy/preview-url.txt`
- **Outputs**: `proposal/cover.png`, `proposal/proposal.pdf`
- **Verify**: PDF > 0 bytes and opens

## Phase 8 — Deploy & Handoff

### 14 Deploy
- **Agent**: `deploy-engineer`
- **SOP**: `sops/14-deploy.md`
- **Inputs**: `site/` (QA-passed)
- **Outputs**: `deploy/manifest.json`, `deploy/preview-url.txt`, `deploy/handoff.md`
- **Verify**: HEAD on the preview URL returns 200

---

## Pro tier expansion hooks (deferred to v2)

These are documented now so the v1 architecture doesn't paint v2 into a corner. None are implemented yet.

| Feature | Where it goes | What it needs |
|---|---|---|
| Customer portal / auth | `templates/pages/portal/`, new SOP 15 | Auth provider (Clerk, Auth0); per-client database |
| Blog / CMS | `templates/pages/blog/`, `templates/sections/blog-post/` | Headless CMS (Sanity, Contentful) wired per client |
| Service-area landing-page fanout | already supported by recipe `geography` block | Just enable in recipe; SOP 05 already handles |
| Financing calculator | `templates/sections/financing-calculator/` | Calculator widget + financing-partner data |
| Multi-language | `templates/i18n/` | Translation pipeline + URL strategy decision |
| A/B testing | inside `site/` + edge-runtime layer | Vercel Edge Functions or third-party |
| HubSpot / Salesforce lead-routing | contact form action endpoint | Per-client webhook in `brief.md.contact_form_endpoint` |
| Booking widget | `templates/sections/booking/` | Calendly/Acuity per-client embed |

When v2 work starts, each row above becomes a new SOP (`sops/15-portal.md`, etc.) plus an agent if the substep is non-trivial.
