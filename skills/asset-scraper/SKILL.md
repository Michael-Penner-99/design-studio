---
name: asset-scraper
description: Crawl a contractor's website and Google Business Profile to extract real assets — logo, owner photo, team photos, project gallery, certification badges. Real assets only; no stock.
---

# asset-scraper

## What this skill does
Walks the contractor's site looking for the real assets the factory needs. Writes raw files to `assets/raw/` and appends entries to `assets/manifest.json`.

## Inputs
- `domain` (string)
- `client_dir` (path)

## Asset discovery rules
- **Logo**: `<link rel="icon">`, `<link rel="apple-touch-icon">`, header `<img>` with alt containing brand name, footer logo image, Google Business Profile logo.
- **Owner photo**: /about, /our-team, /meet-{first-name}, LinkedIn link.
- **Team photos**: /team, /our-team, /staff.
- **Project gallery**: /gallery, /portfolio, /projects, /case-studies, /past-work, /our-work, plus any image on /services/* with dimensions ≥ 800×600.
- **Badges**: footer, header, /about, /credentials, /certifications.

## Implementation
Pure Bash + curl + a small HTML parser (Python `beautifulsoup4` acceptable). No headless browser required unless the contractor's site is React-rendered and the static HTML returns no `<img>` tags — then fall back to Playwright.

## Halt conditions
- No logo → halt the run.
- < 6 project photos → halt the run.

## TODO before first run
- Decide on Playwright vs static-only crawling. If Playwright, list Playwright in the repo's `package.json` and document install path.
