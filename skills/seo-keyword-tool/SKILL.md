---
name: seo-keyword-tool
description: Estimate local-SEO search volume and competition for a list of keywords. Returns volume tier, intent class, and competition tier per keyword.
---

# seo-keyword-tool

## What this skill does
Given a list of candidate keywords, return volume + competition estimates so the seo-strategist can prioritize.

## Inputs
```json
{
  "keywords": ["kansas city roof replacement", "kc roofers", "..."],
  "geo": "Kansas City, MO",
  "intent_filter": ["transactional", "commercial"]
}
```

## Output
```json
[
  { "keyword": "...", "volume_tier": "100-1k", "competition": "medium", "intent": "transactional", "suggested_page": "/services/roof-replacement" },
  ...
]
```

## Implementation
Choices, ordered by preference:
1. **DataForSEO API** (paid, accurate). Recommended.
2. **Google Keyword Planner** via Ads API (requires Ads account + token).
3. **Free fallback**: Use Google's autocomplete endpoint + SerpAPI to estimate competition from organic SERP density. Less accurate; flag as "estimate" in output.

## TODO before first run
- Pick a provider and add credentials to env.
