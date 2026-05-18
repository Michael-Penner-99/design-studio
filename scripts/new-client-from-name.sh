#!/usr/bin/env bash
# new-client-from-name.sh — scaffold a fresh client folder when no URL is available.
#
# Use this when the operator only has a business name, trade, city, and pasted reviews.
# Companion to scripts/new-client.sh (URL mode). Sets mode: name-and-reviews in brief.md.
#
# Usage: scripts/new-client-from-name.sh <slug> <business_name> <trade> <primary_city>
# Example: scripts/new-client-from-name.sh example-hvac "Example HVAC" hvac "Kansas City, MO"

set -euo pipefail

if [ $# -lt 4 ]; then
  echo "Usage: $0 <slug> <business_name> <trade> <primary_city>" >&2
  echo "Example: $0 example-hvac \"Example HVAC\" hvac \"Kansas City, MO\"" >&2
  exit 1
fi

SLUG="$1"
BUSINESS_NAME="$2"
TRADE="$3"
PRIMARY_CITY="$4"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLIENT_DIR="$ROOT/clients/$SLUG"

if [ -d "$CLIENT_DIR" ]; then
  echo "Client folder already exists: $CLIENT_DIR" >&2
  echo "Use scripts/start-run.sh to resume, or delete the folder to start over." >&2
  exit 1
fi

# Create the per-client folder structure (matches docs/architecture.md §3).
# Note: same shape as URL mode so every downstream phase reads the same paths.
mkdir -p "$CLIENT_DIR"/{research,assets/{raw,processed},evidence,brand,strategy,site,sales,qa,proposal,deploy}

# Seed brief.md with frontmatter the orchestrator needs.
# Key difference from URL mode: `_meta.mode: name-and-reviews`, no URL,
# and business_name + trade + primary_city are pre-filled (not inferred).
cat > "$CLIENT_DIR/brief.md" <<BRIEF
---
url: ""
slug: $SLUG
status: scaffolded
created_at: $(date -u +%Y-%m-%dT%H:%M:%SZ)
brand_name: "$BUSINESS_NAME"
owner_name: ""
trade: "$TRADE"
sub_trade: ""
services: []
geography:
  primary_city: "$PRIMARY_CITY"
  metro: ""
  service_radius_miles: 0
  service_areas: []
certifications: []
review_summary:
  google_rating: 0
  google_count: 0
  facebook_rating: 0
  facebook_count: 0
competitors: []
ranking_keywords: []
gaps: []
qa:
  iteration: 0
_meta:
  mode: name-and-reviews
  reviews_source: operator-pasted
---

# $SLUG — Brief (name-and-reviews mode)

No URL was provided. This client folder was seeded with the operator-supplied
business name, trade, and city. The discovery-researcher agent will fill the
rest of the brief using WebSearch + the pasted review corpus (in
\`evidence/reviews.json\`, written by Phase 1).

In this mode:
- Phase 1 does **not** fetch a contractor URL — there is none.
- Phase 2 does **not** scrape contractor-site assets — instead the
  asset-extractor uses the \`ai-image-generator\` skill to produce
  placeholder logo + project photography + an owner-style headshot.
- The walkthrough template (\`templates/walkthrough/walkthrough.html.template\`)
  renders a small banner notifying the lead that the photography is
  AI-generated and will be swapped for their real photos before launch.

## Decision log

(no entries)
BRIEF

# Drop a placeholder for the pasted reviews. Phase 1 parses reviews_text from
# the queue spec (or from this file's body if the operator pasted them locally)
# into structured records, then writes evidence/reviews.json.
cat > "$CLIENT_DIR/evidence/reviews-raw.txt" <<RAW
# Paste reviews here (or have the operator app inject them via reviews_text).
# Phase 1 (SOP 01, name-and-reviews mode) reads this file and produces evidence/reviews.json.
# Format: one review per blank-line-separated block. The Phase 1 parser will
# extract author and rating heuristically.
RAW

echo "Scaffolded $CLIENT_DIR (mode: name-and-reviews)"
echo "Next step: paste reviews into $CLIENT_DIR/evidence/reviews-raw.txt, then scripts/start-run.sh $SLUG"
