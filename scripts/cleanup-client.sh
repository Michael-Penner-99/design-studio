#!/usr/bin/env bash
# cleanup-client.sh — safely remove a deployed client's local folder after successful deploy.
#
# Only runs if:
#   1. The client appears in clients/_deployed.json with a verified preview URL.
#   2. The preview URL returns 200 (i.e. the site is actually live).
#   3. The operator confirms.
#
# Halted runs are never touched — they still contain halt.md the operator needs.
#
# Usage: scripts/cleanup-client.sh <slug>

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <slug>" >&2
  exit 1
fi

SLUG="$1"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLIENT_DIR="$ROOT/clients/$SLUG"
MANIFEST="$ROOT/clients/_deployed.json"

if [ ! -d "$CLIENT_DIR" ]; then
  echo "No local folder at clients/$SLUG. Nothing to clean up."
  exit 0
fi

# Halt-mode guard: if halt.md exists, refuse to clean up.
if [ -f "$CLIENT_DIR/halt.md" ]; then
  echo "❌ clients/$SLUG/halt.md exists — this run halted and cannot be cleaned up."
  echo "Resolve the halt first (see halt.md for the suggested action), or delete manually if you're certain."
  exit 1
fi

# Manifest check: client must appear in _deployed.json.
if ! python3 -c "
import json, sys
m = json.load(open('$MANIFEST'))
slugs = [c['slug'] for c in m.get('clients', [])]
sys.exit(0 if '$SLUG' in slugs else 1)
" 2>/dev/null; then
  echo "❌ clients/$SLUG is not in clients/_deployed.json."
  echo "This means Phase 8 (Deploy) didn't complete cleanly. Refusing to clean up."
  exit 1
fi

# Liveness check: preview URL must return 200.
PREVIEW_URL=$(python3 -c "
import json
m = json.load(open('$MANIFEST'))
for c in m['clients']:
    if c['slug'] == '$SLUG':
        print(c['preview_url'])
        break
")

if [ -z "$PREVIEW_URL" ]; then
  echo "❌ No preview_url for $SLUG in _deployed.json. Refusing to clean up."
  exit 1
fi

echo "Verifying $PREVIEW_URL is live..."
if ! curl -fsSL --head --max-time 10 "$PREVIEW_URL" > /dev/null 2>&1; then
  echo "❌ $PREVIEW_URL did not return 200. Site may be down."
  echo "Refusing to clean up while remote copy is unverified."
  exit 1
fi

# Confirmation prompt.
SIZE=$(du -sh "$CLIENT_DIR" 2>/dev/null | cut -f1)
echo ""
echo "  Slug:        $SLUG"
echo "  Preview URL: $PREVIEW_URL (live, 200)"
echo "  Local size:  $SIZE"
echo "  To restore:  scripts/fetch-client.sh $SLUG"
echo ""
read -p "Delete clients/$SLUG/ from local? [y/N] " -n 1 -r REPLY
echo ""

if [[ ! "$REPLY" =~ ^[Yy]$ ]]; then
  echo "Cancelled. Local folder unchanged."
  exit 0
fi

# Update manifest before deletion: mark cleaned_at timestamp.
python3 -c "
import json, datetime
m = json.load(open('$MANIFEST'))
for c in m['clients']:
    if c['slug'] == '$SLUG':
        c['cleaned_up_at'] = datetime.datetime.utcnow().isoformat() + 'Z'
        c['local_present'] = False
        break
json.dump(m, open('$MANIFEST', 'w'), indent=2)
"

# Delete the folder.
rm -rf "$CLIENT_DIR"
echo "✓ Removed clients/$SLUG/"
echo "  Site remains live at $PREVIEW_URL"
echo "  To re-fetch for edits later: scripts/fetch-client.sh $SLUG"
