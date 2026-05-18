---
name: review-scraper
description: Fetch verified Google Business + Facebook reviews for a contractor by name and city. Returns structured JSON with rating, count, and per-review snippets (author, rating, date, text, source URL).
---

# review-scraper

## What this skill does
Given a contractor's brand_name + primary_city, return their public review evidence from Google Business Profile (via Google Places API) and Facebook (via public page scraping if accessible).

## Inputs
- `brand_name` (string)
- `primary_city` (string)
- `domain` (optional — used to disambiguate when brand_name is generic)

## Output
JSON written to `evidence/reviews.json`:
```json
{
  "google": {
    "rating": 4.8,
    "count": 127,
    "place_id": "...",
    "reviews": [
      { "author": "...", "rating": 5, "date": "2024-09-12", "text": "...", "source_url": "..." }
    ]
  },
  "facebook": { ... }
}
```

## Implementation
Reads `GOOGLE_PLACES_API_KEY` from env. Calls:
1. Places Text Search to find the place_id for "{brand_name} {primary_city}".
2. Places Details to get rating + user_ratings_total.
3. Places Details (with `reviews` field) for the most recent reviews (Google returns up to 5; for more, supplement with Places.reviews via paid scaling or partner tools).

Facebook portion is best-effort against the public page if the contractor links it from their website. If credentials or page access fail, return an empty facebook block — the run can still proceed if Google reviews are sufficient (≥ 10).

## TODO before first run
- Add `GOOGLE_PLACES_API_KEY` to `.env` at repo root.
- Decide on a Facebook strategy: official Graph API (requires app review + Page access) or polite public-page scraping. Document the decision here.
