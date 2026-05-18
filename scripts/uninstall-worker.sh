#!/usr/bin/env bash
# uninstall-worker.sh — remove the factory worker launchd agent.
#
# Usage: scripts/uninstall-worker.sh

set -uo pipefail

LABEL="com.actionstudio.factory-worker"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"

if [ ! -f "$PLIST" ]; then
  echo "Not installed (no plist at $PLIST)."
  exit 0
fi

launchctl unload "$PLIST" 2>/dev/null || true
rm -f "$PLIST"

echo "✓ worker uninstalled"
echo "  log files at .worker.{log,out.log,err.log} remain — delete manually if you want."
