# SOP 01 — Brief

## Purpose
Produce the single source of truth that every downstream phase reads. No client questionnaire, no interview — everything is inferred from the contractor's existing online presence.

## Inputs
- `clients/{slug}/brief.md` (frontmatter has `url` and `slug` only, body empty)
- The contractor's URL

## Steps

1. **Fetch the homepage HTML.** WebFetch the URL. If it returns < 200 or > 399, halt.
2. **Identify brand_name.** From `<title>`, `og:site_name`, header logo alt text, or repeated phrasing across pages. Strip generic suffixes like "Inc.", "LLC" unless the brand actually uses them. If three sources disagree, pick the one in the logo alt and footer copyright.
3. **Identify owner_name.** WebFetch /about, /our-team, /meet-{first-name}. Look for "Owner", "Founder", "Started by", "Run by", LinkedIn link. If not on the site, search Google Business Profile for the owner association.
4. **Identify trade and sub_trade.** Match against the vocabulary in `recipes/contractor-*.yml`. Trade is the major category (roofing, hvac, exteriors, remodel). Sub-trade is residential/commercial/both based on dominant evidence.
5. **List services.** Pull from /services, /what-we-do, the homepage services section, the nav menu, the footer. Dedupe. Use canonical names from the recipe for the trade.
6. **Geography.** Primary city from contact-page address. Service-areas page (or footer) gives the broader list. Metro inferred from primary city. service_radius_miles from explicit statement on site, or default to the recipe value.
7. **Certifications.** All badge images on the site. Match against the known list in `recipes/contractor-*.yml.certifications_master`. Include only verified matches.
8. **review_summary.** Google rating + count from Google Places API (via the `review-scraper` skill, even though full reviews come later in Phase 2 — we just need totals here). Facebook from public page if available.
9. **Competitors.** Defer to SOP 02 for the actual scoring, but populate the `competitors[]` list here with 3-5 URLs the research substep will analyze.
10. **ranking_keywords.** Top 5-10 keywords the contractor currently ranks for in their primary metro (from local-SEO tools or by inspecting their title tags + H1s across pages).
11. **gaps.** Free-form list, 3-5 items, derived from comparing the homepage to the trade recipe's "expected sections". Examples: "no service-area pages", "no financing info", "no real owner photo", "no project gallery", "no FAQs".
12. **Write the narrative body.** Two paragraphs explaining who this contractor is and what the website opportunity is. Action Studio voice — direct, evidence-anchored.
13. **Set `status: brief-complete` in frontmatter.**

## Outputs
- `clients/{slug}/brief.md` — full schema populated per `docs/architecture.md` §5.

## Exit criteria
- All required frontmatter keys present and non-empty.
- `competitors[]` has ≥ 3 entries.
- `gaps[]` has ≥ 3 entries.
- `review_summary.google_count` is a number (0 is acceptable; missing is not).

---

## Phase 1 — `name-and-reviews` mode

This mode runs when the operator submits a job with `mode: "name-and-reviews"` (see `docs/queue-contract.md`). There is no contractor URL — the scaffold script `scripts/new-client-from-name.sh` has already pre-filled `brand_name`, `trade`, `geography.primary_city`, and written `_meta.mode: name-and-reviews` to the brief frontmatter.

Detect this mode by checking `_meta.mode` in `brief.md`. If it's `name-and-reviews`, follow this procedure **instead of** Steps 1–9 above. Steps 10–13 still apply.

### Steps (name-and-reviews mode)

1. **Skip the URL fetch.** There is no `url` to WebFetch. Do not error on the empty `url:` field — that's correct for this mode.

2. **Read manual notes.** If `clients/{slug}/brief.md` has a markdown body section with operator notes (the queue contract's `manual_notes` is prepended to brief.md body at scaffold time), read it as raw context for downstream phases. Don't try to parse it.

3. **Parse `reviews_text` into structured reviews.** The queue spec's `reviews_text` (or its scaffolded local copy at `clients/{slug}/evidence/reviews-raw.txt`) is free-form text — one review per blank-line-separated block. Run the parser:

   ```python
   # Pseudocode — implement as skills/review-parser/parse.py
   import re, json
   blocks = [b.strip() for b in raw.split('\n\n') if b.strip()]
   reviews = []
   for b in blocks:
       # Heuristics: a leading "Author Name:" or "— Author" line is the author.
       # A trailing "5 stars" / "★★★★★" / "Rating: 5/5" line is the rating.
       author = extract_author(b) or "Verified customer"
       rating = extract_rating(b) or 5
       text = strip_meta_lines(b)
       reviews.append({"author": author, "rating": rating, "text": text, "platform": "google", "date": None})
   ```

   Write the parsed reviews to `clients/{slug}/evidence/reviews.json`:

   ```json
   {
     "source": "operator-pasted",
     "count": 12,
     "rating": 4.83,
     "platform_breakdown": { "google": 12, "facebook": 0 },
     "reviews": [
       { "author": "...", "rating": 5, "text": "...", "platform": "google", "date": null }
     ]
   }
   ```

   Calculate `rating` as the mean of per-review ratings, rounded to 2 decimals.

4. **Halt condition — review count.** If the parsed `reviews.json` contains fewer than 10 entries, halt the run with reason `name-and-reviews-mode-needs-10-reviews`. Phase 2 enforces the same gate, but failing here saves the wasted asset-extraction work.

5. **trade is pre-filled.** The scaffold script wrote `trade` from the operator's `trade_hint`. Validate it matches one of the recipes in `recipes/contractor-*.yml`. If not, halt with `unknown-trade-{value}`.

6. **owner_name and certifications.** Run a WebSearch for `"{{brand_name}}" {{primary_city}} owner` and `"{{brand_name}}" {{primary_city}} site:linkedin.com`. If a credible owner name surfaces, fill it. Otherwise leave `owner_name: ""` (Phase 3 brand audit can flag this as a gap rather than halt). Same approach for certifications — search but don't halt if empty.

7. **services.** The scaffold doesn't know the contractor's exact service mix. Default to the `services_canonical` list from `recipes/contractor-{trade}.yml`, taking the priority-1 services. The brand audit (Phase 3) can override with anything mentioned in the review text.

8. **geography.metro and service_areas.** WebSearch for `"{{brand_name}}" service area` and `"{{brand_name}}" cities served`. Failing that, default metro to the metro that contains `primary_city` and leave `service_areas: []` (Phase 4 strategy will fill from `primary_city` alone in that case).

9. **review_summary.** Compute `google_rating` and `google_count` directly from `evidence/reviews.json`. Set `facebook_rating: 0` and `facebook_count: 0` unless the operator's reviews_text explicitly tagged Facebook reviews (rare in v1; don't try too hard).

10. **competitors.** Skip the URL-derived competitor list — there is no contractor URL to compare against. Instead, run a WebSearch for `"{{trade}} {{primary_city}}" site:*.com` and pick the top 3-5 non-aggregator local competitors. Write them to `competitors[]` in brief.md. SOP 02 (Research) handles the actual teardown without needing the contractor's own URL.

11. **gaps.** Without an existing site to audit, the gap list is generic-for-the-trade: pull the bottom-half of `recipes/contractor-{trade}.yml.signature_moves_defaults` and frame them as "site doesn't yet exist — gap is everything baseline" plus 3-5 conversion-specific gaps the trade typically has. The site-scorecard step in SOP 02 will assign these a `0/120` baseline since there is no existing site to score.

12. **Continue to Steps 10-13 above** — write the narrative body, set `status: brief-complete`, etc. Make sure `_meta.mode: name-and-reviews` survives the frontmatter rewrite.

### Outputs (name-and-reviews mode)

Same as URL mode, plus:

- `clients/{slug}/evidence/reviews.json` is written here (in URL mode it's written by SOP 03 instead).

### Exit criteria (name-and-reviews mode)

- All standard exit criteria above.
- `_meta.mode: name-and-reviews` preserved in frontmatter.
- `evidence/reviews.json` exists with `count >= 10`.
- `url:` may remain empty (this is correct for this mode).
