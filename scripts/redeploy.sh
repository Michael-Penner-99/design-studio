#!/usr/bin/env bash
# redeploy.sh — re-push an existing client's site to Vercel without rebuilding.
#
# Usage: scripts/redeploy.sh <slug>

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <slug>" >&2
  exit 1
fi

SLUG="$1"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SITE_DIR="$ROOT/clients/$SLUG/site"

if [ ! -d "$SITE_DIR" ]; then
  echo "No site folder at $SITE_DIR." >&2
  exit 1
fi

cd "$SITE_DIR"
vercel --prod --yes
