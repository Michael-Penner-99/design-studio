#!/usr/bin/env bash
# install-worker.sh — install the factory worker as a launchd agent on macOS.
#
# After install, the worker runs every 30 seconds in the background, surviving
# logout but not full restart (Mac's standard LaunchAgent semantics).
#
# Usage: scripts/install-worker.sh

set -euo pipefail

if [[ "$(uname)" != "Darwin" ]]; then
  echo "❌ install-worker is macOS-only (uses launchd)."
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LABEL="com.actionstudio.factory-worker"
PLIST_DIR="$HOME/Library/LaunchAgents"
PLIST="$PLIST_DIR/${LABEL}.plist"

mkdir -p "$PLIST_DIR"

cat > "$PLIST" <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${LABEL}</string>

    <key>ProgramArguments</key>
    <array>
        <string>${ROOT}/scripts/worker-once.sh</string>
    </array>

    <key>WorkingDirectory</key>
    <string>${ROOT}</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    </dict>

    <key>StartInterval</key>
    <integer>30</integer>

    <key>RunAtLoad</key>
    <true/>

    <key>StandardOutPath</key>
    <string>${ROOT}/.worker.out.log</string>

    <key>StandardErrorPath</key>
    <string>${ROOT}/.worker.err.log</string>
</dict>
</plist>
PLISTEOF

echo "✓ wrote $PLIST"

# Stop if already loaded, then reload
launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"

echo "✓ worker loaded into launchd"
echo ""
echo "Status:"
launchctl list | grep "${LABEL}" || echo "  (not yet running — first tick fires within 30 seconds)"
echo ""
echo "Logs:"
echo "  ${ROOT}/.worker.log      ← per-tick activity"
echo "  ${ROOT}/.worker.out.log  ← stdout (launchd)"
echo "  ${ROOT}/.worker.err.log  ← stderr (launchd)"
echo ""
echo "Uninstall: scripts/uninstall-worker.sh"
echo "Manual run: scripts/worker-once.sh"
echo "Long-running terminal: scripts/worker.sh"
