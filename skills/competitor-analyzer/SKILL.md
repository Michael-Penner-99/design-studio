---
name: competitor-analyzer
description: Fetch a competitor's website, score it on the 12-axis rubric, and identify their primary differentiator + the gap the contractor will exploit.
---

# competitor-analyzer

## What this skill does
Pure read-only analysis tool used in SOP 02. Given a competitor URL, returns a structured analysis.

## Inputs
- `competitor_url` (string)

## Output
```json
{
  "url": "...",
  "scores_12_axis": { "hero_clarity": 7, "value_prop": 5, ... },
  "total": 78,
  "top_keyword": "...",
  "differentiator": "...",
  "their_gap": "..."
}
```

## Implementation
Static fetch + parse. Uses the same logic as site-scorecard.md production for the contractor's own site.
