#!/usr/bin/env bash
# check-setup.sh — verify the factory has everything it needs before a run.
#
# Usage: scripts/check-setup.sh

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

fail=0
warn=0
ok=0

check_required() {
  local key="$1"
  local source="$2"
  if [ -z "${!key:-}" ]; then
    echo "  ❌ MISSING (required): $key   ← needed by $source"
    fail=$((fail+1))
  else
    echo "  ✓ $key set"
    ok=$((ok+1))
  fi
}

check_optional() {
  local key="$1"
  local source="$2"
  if [ -z "${!key:-}" ]; then
    echo "  ⚠ optional: $key not set   ← would enable $source"
    warn=$((warn+1))
  else
    echo "  ✓ $key set"
    ok=$((ok+1))
  fi
}

echo "Action Studio — setup check"
echo "==========================="

# Load .env if present
if [ -f .env ]; then
  echo "Loading .env"
  set -a; source .env; set +a
else
  echo "  ⚠ .env not found. Copy .env.example to .env and fill in values."
  warn=$((warn+1))
fi

echo ""
echo "Required credentials:"
check_required GOOGLE_PLACES_API_KEY "skills/review-scraper/ (Phase 2 will halt without)"
check_required VERCEL_TOKEN          "skills/deploy-vercel/ (Phase 8 will halt without)"
check_required VERCEL_TEAM_ID        "skills/deploy-vercel/ (Phase 8)"

echo ""
echo "Optional credentials:"
check_optional OPENAI_API_KEY              "skills/ai-image-generator/ (Phase 9 mascots)"
check_optional FB_PAGE_ACCESS_TOKEN        "skills/review-scraper/ Facebook reviews"
check_optional DATAFORSEO_LOGIN            "skills/seo-keyword-tool/ paid keyword data"
check_optional DEFAULT_CONTACT_FORM_ENDPOINT "default contact form endpoint for new clients"

echo ""
echo "Local tooling:"

for cmd in curl jq python3 vercel; do
  if command -v "$cmd" > /dev/null 2>&1; then
    echo "  ✓ $cmd installed"
    ok=$((ok+1))
  else
    if [ "$cmd" = "vercel" ]; then
      echo "  ❌ MISSING: $cmd   ← install with: npm i -g vercel"
    else
      echo "  ❌ MISSING: $cmd"
    fi
    fail=$((fail+1))
  fi
done

echo ""
echo "DNS / Vercel project:"
if [ -n "${VERCEL_TOKEN:-}" ]; then
  if curl -fsSL -H "Authorization: Bearer $VERCEL_TOKEN" "https://api.vercel.com/v9/projects?limit=1" > /dev/null 2>&1; then
    echo "  ✓ Vercel API reachable with token"
    ok=$((ok+1))
  else
    echo "  ❌ Vercel API call failed. Token may be invalid or revoked."
    fail=$((fail+1))
  fi
else
  echo "  (skipped — no VERCEL_TOKEN)"
fi

echo ""
echo "Summary: $ok ok / $warn warnings / $fail failed"

if [ "$fail" -gt 0 ]; then
  echo ""
  echo "Failures must be resolved before running the factory."
  echo "See docs/setup-checklist.md for the full setup walkthrough."
  exit 1
fi

echo ""
echo "Ready. Run: scripts/new-client.sh <slug> <url>  then  scripts/start-run.sh <slug>"
