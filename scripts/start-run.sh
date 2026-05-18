#!/usr/bin/env bash
# start-run.sh — kick off the orchestrator for a scaffolded client.
#
# This script prints the operator trigger phrase. The actual orchestration
# happens inside Claude Code by typing one of the trigger patterns from CLAUDE.md.
#
# Usage: scripts/start-run.sh <slug>

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <slug>" >&2
  exit 1
fi

SLUG="$1"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLIENT_DIR="$ROOT/clients/$SLUG"

if [ ! -d "$CLIENT_DIR" ]; then
  echo "No client folder at $CLIENT_DIR." >&2
  echo "Run: scripts/new-client.sh $SLUG <url>" >&2
  exit 1
fi

URL=$(grep -m1 '^url:' "$CLIENT_DIR/brief.md" | sed 's/^url: *//')

cat <<MSG
Client scaffolded: $CLIENT_DIR
URL on file:       $URL

To kick off the orchestrator, open this repo in Claude Code and type:

    run a fresh lead for $URL

Or to resume from the last completed phase:

    resume $SLUG

The orchestrator reads CLAUDE.md and sops/00-orchestrator-contract.md, then
delegates each of the 8 phases to its named subagent in .claude/agents/.
MSG
