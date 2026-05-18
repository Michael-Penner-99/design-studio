#!/usr/bin/env bash
# fetch-client.sh — re-pull a deployed client's source files from Vercel back to local.
#
# Used when you need to edit a client site that was previously cleaned up. Restores
# enough of clients/{slug}/ to run `redeploy {slug}` after edits.
#
# Usage: scripts/fetch-client.sh <slug>

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <slug>" >&2
  exit 1
fi

SLUG="$1"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLIENT_DIR="$ROOT/clients/$SLUG"
MANIFEST="$ROOT/clients/_deployed.json"

if [ -d "$CLIENT_DIR" ]; then
  echo "clients/$SLUG/ already exists locally. Nothing to fetch."
  exit 0
fi

# Manifest check
VERCEL_PROJECT=$(python3 -c "
import json
m = json.load(open('$MANIFEST'))
for c in m['clients']:
    if c['slug'] == '$SLUG':
        print(c.get('vercel_project_id', c['slug']))
        break
")

if [ -z "$VERCEL_PROJECT" ]; then
  echo "❌ $SLUG not found in _deployed.json. Cannot fetch."
  echo "If this client was never deployed, run a fresh factory pass instead."
  exit 1
fi

# Verify vercel CLI present
if ! command -v vercel > /dev/null 2>&1; then
  echo "❌ vercel CLI not found. Install: npm i -g vercel"
  exit 1
fi

mkdir -p "$CLIENT_DIR/site"
cd "$CLIENT_DIR/site"

echo "Linking Vercel project $VERCEL_PROJECT..."
vercel link --yes --project "$VERCEL_PROJECT" --token "${VERCEL_TOKEN:?VERCEL_TOKEN not set in .env}"

echo "Pulling latest production source..."
vercel pull --yes --environment=production --token "$VERCEL_TOKEN"

# Update manifest
python3 -c "
import json, datetime
m = json.load(open('$MANIFEST'))
for c in m['clients']:
    if c['slug'] == '$SLUG':
        c['local_present'] = True
        c['last_fetched_at'] = datetime.datetime.utcnow().isoformat() + 'Z'
        break
json.dump(m, open('$MANIFEST', 'w'), indent=2)
"

echo "✓ Restored clients/$SLUG/site/ from Vercel"
echo "  Edit files, then run: scripts/redeploy.sh $SLUG"
echo ""
echo "Note: only site/ is restored. brief.md, research/, brand/, strategy/, qa/, proposal/"
echo "are not stored on Vercel. If you need to regenerate any of those, run a fresh phase."
