#!/usr/bin/env bash
# new-client.sh — scaffold a fresh client folder.
#
# Usage: scripts/new-client.sh <slug> <url>
# Example: scripts/new-client.sh capstone-contracting https://capstonecontractingsolutions.com

set -euo pipefail

if [ $# -lt 2 ]; then
  echo "Usage: $0 <slug> <url>" >&2
  exit 1
fi

SLUG="$1"
URL="$2"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLIENT_DIR="$ROOT/clients/$SLUG"

if [ -d "$CLIENT_DIR" ]; then
  echo "Client folder already exists: $CLIENT_DIR" >&2
  echo "Use scripts/start-run.sh to resume, or delete the folder to start over." >&2
  exit 1
fi

# Create the per-client folder structure (matches docs/architecture.md §3)
mkdir -p "$CLIENT_DIR"/{research,assets/{raw,processed},evidence,brand,strategy,site,qa,proposal,deploy}

# Seed brief.md with just the frontmatter the orchestrator needs.
cat > "$CLIENT_DIR/brief.md" <<BRIEF
---
url: $URL
slug: $SLUG
status: scaffolded
created_at: $(date -u +%Y-%m-%dT%H:%M:%SZ)
brand_name: ""
owner_name: ""
trade: ""
sub_trade: ""
services: []
geography:
  primary_city: ""
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
---

# $SLUG — Brief

This brief will be populated by the discovery-researcher agent during Phase 1.
Until then this body is intentionally empty.

## Decision log

(no entries)
BRIEF

echo "Scaffolded $CLIENT_DIR"
echo "Next step: scripts/start-run.sh $SLUG"
