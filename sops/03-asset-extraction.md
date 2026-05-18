# SOP 03 — Asset Extraction

## Purpose
Pull every real asset from the contractor's existing online presence and verify their reviews. Real photos. Real proof. No stock.

## Inputs
- `clients/{slug}/brief.md` (status: research-complete)

## Steps

1. **Logo.**
   - First look: `<link rel="icon">`, `<link rel="apple-touch-icon">`, header `<img>` with alt containing brand name.
   - Second look: footer logo image.
   - Third look: Google Business Profile logo.
   - Prefer SVG, then PNG with alpha, then JPEG.
   - Save as `assets/raw/logo.{ext}` and `assets/raw/logo-favicon.{ext}` if separate.

2. **Owner photo.**
   - Look at /about, /our-team, /meet-{first}, LinkedIn link, Google Business Profile owner photo.
   - Save as `assets/raw/owner.{ext}`.
   - If not found, skip — owner photo is not a halt condition (some contractors don't show owner).

3. **Team photos.**
   - Look at /team, /our-team, /staff. Save each as `assets/raw/team-{n}.{ext}`.

4. **Project gallery.**
   - Look at /gallery, /portfolio, /projects, /case-studies, /past-work, /our-work. Also crawl /services/* pages for embedded project photos.
   - Save as `assets/raw/project-{n}.{ext}`. Minimum 6 — if exhausted at < 6, halt.

5. **Badges/certifications.**
   - Look in footer, header, /about, /credentials, /certifications.
   - Match images against the certifications_master list in the recipe.
   - Save as `assets/raw/badge-{name}.{ext}` and append entry to `evidence/badges.json` with `{name, image_path, verifying_url}`.

6. **Reviews.**
   - Use the `review-scraper` skill at `skills/review-scraper/`. Inputs: contractor name + primary city.
   - Google: pull rating, count, and the most recent 50 reviews (text + author + date + 5★ filter).
   - Facebook: pull rating, count, and recent 20 reviews from the public page if accessible.
   - Write all to `evidence/reviews.json`.

7. **Manifest.** For every file in `assets/raw/`, append to `assets/manifest.json`:
   ```json
   { "file": "...", "type": "logo|owner|team|project|badge|favicon", "source_url": "...", "dimensions": "WxH", "mime": "...", "license_claim": "contractor-owned" }
   ```

8. **Processed assets.** Resize/optimize each raw asset for web use. Output to `assets/processed/`:
   - Logo: produce SVG (if source was vector) or PNG @ 1x, 2x, 3x for retina.
   - Photos: produce 1920w (hero), 1200w (wide), 800w (card), 400w (thumb), 200w (badge) WebP variants.

9. **Set `status: assets-complete`.**

## Outputs
- `assets/raw/*` (originals)
- `assets/processed/*` (optimized)
- `assets/manifest.json`
- `evidence/reviews.json`
- `evidence/badges.json`

## Exit criteria
- Logo present.
- ≥ 6 project photos.
- ≥ 10 reviews across Google + Facebook combined.
- manifest.json validates as JSON.

---

## Phase 2 — `name-and-reviews` mode

This mode runs when `brief.md` frontmatter has `_meta.mode: name-and-reviews`. There is no contractor URL to crawl. Instead, the asset-extractor produces AI-generated placeholder assets and pulls the review corpus from the pre-populated `evidence/reviews.json` (written by SOP 01 in this mode).

Detect this mode by reading `_meta.mode` in `brief.md`. If `name-and-reviews`, follow this procedure **instead of** Steps 1-6 above. Steps 7-9 still apply (manifest, processed variants, status).

### Steps (name-and-reviews mode)

1. **Skip the contractor-site asset crawl entirely.** There is no URL, no logo source, no project gallery to scrape. Do not attempt WebFetch.

2. **Generate the logo.** Use the `ai-image-generator` skill (`skills/ai-image-generator/`). Prompt template:

   ```
   modern minimal wordmark logo for "{{brand_name}}", a {{trade}} contractor in {{primary_city}}.
   dark navy text on white background, clean sans-serif, no taglines, no icons,
   centered, 1024x256 transparent PNG, vector-clean edges.
   ```

   Save as `clients/{slug}/assets/raw/logo.png`. If the provider returns multiple candidates, pick the one with the highest contrast and crispest edges (let the operator override later via `redeploy` if needed).

3. **Generate 6+ project photos.** Vary the prompt 6-8 times so the set doesn't look identical. Trade-specific prompt template — see `skills/ai-image-generator/trade-prompts.md`. Examples:

   - **roofing:** "professional photo of a roofing crew installing architectural shingles on a residential home, sunny clear sky, clean job site, telephoto compression, photographic realism, 1920x1080"
   - **hvac:** "professional photo of an HVAC technician installing a modern split-system AC condenser next to a single-family residence, clean uniform, daylight, 1920x1080"
   - **plumbing:** "professional photo of a licensed plumber repairing a copper pipe under a kitchen sink, clean toolbox visible, neutral lighting, 1920x1080"
   - **electrical:** "professional photo of a licensed electrician installing a residential electrical panel upgrade, neat wire dressing, code-compliant, daylight, 1920x1080"

   Vary by service (interior vs exterior, install vs repair, residential vs commercial) so the gallery reads as a real portfolio. Save as `assets/raw/project-1.png` through `project-N.png` (minimum 6, target 8).

4. **Generate 1 owner-style photo.** Prompt:

   ```
   professional friendly headshot of a tradesman in a clean uniform with the
   {{trade}} contractor brand name implied (no visible logo), neutral light-gray
   background, looking at camera, warm but professional, 1024x1024.
   ```

   Save as `assets/raw/owner.png`. Note this is **placeholder-only** — the QA report flags it as `placeholder: true` so the operator knows to swap before launch.

5. **Skip badges.** Generate no certification badges — they would be untrue. `evidence/badges.json` is written as `[]` in this mode. The brand audit (Phase 3) and copy phase will avoid claiming any specific certification.

6. **Reviews come from `evidence/reviews.json`** (already written by SOP 01 in this mode). Do not call Google Places API. Read the file, verify `count >= 10`, and if not, halt with `name-and-reviews-mode-needs-10-reviews` (same gate as SOP 01).

7. **Continue to Steps 7-9 above** with one change to the manifest: every generated asset gets `license_claim: "ai-generated-concept"` and `is_placeholder: true`:

   ```json
   {
     "file": "assets/raw/project-3.png",
     "type": "project",
     "source_url": null,
     "source": "ai-image-generator",
     "ai_prompt": "professional photo of a roofing crew...",
     "ai_provider": "openai",
     "dimensions": "1920x1080",
     "mime": "image/png",
     "license_claim": "ai-generated-concept",
     "is_placeholder": true
   }
   ```

   The `is_placeholder: true` flag is read by SOP 13 to render the AI-photo banner in the walkthrough template.

### Halt conditions (name-and-reviews mode)

- AI image generation fails on > 3 retries for the logo → halt with `ai-logo-generation-failed`.
- AI image generation produces fewer than 6 acceptable project photos → halt with `ai-project-photos-insufficient`.
- `evidence/reviews.json` count < 10 → halt with `name-and-reviews-mode-needs-10-reviews`.

### Outputs (name-and-reviews mode)

Same as URL mode (manifest, raw/, processed/), with the added flags above. `evidence/reviews.json` is not written by this SOP in this mode (it was written by SOP 01).
