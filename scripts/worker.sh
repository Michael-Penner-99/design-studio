#!/usr/bin/env bash
# worker.sh — long-running poll loop. Calls worker-once.sh every 30 seconds.
#
# Use this when you want to "set it and forget it" in a terminal tab.
# For background auto-start, use launchd (see scripts/install-worker.sh).
#
# Usage: scripts/worker.sh

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
INTERVAL="${WORKER_POLL_INTERVAL_SEC:-30}"

trap 'echo "  [worker] stopping"; exit 0' INT TERM

echo "[worker] starting, polling every ${INTERVAL}s. Ctrl-C to stop."
echo "[worker] repo: $ROOT"
echo "[worker] log:  $ROOT/.worker.log"

while true; do
  "$ROOT/scripts/worker-once.sh" || echo "[worker] worker-once exited non-zero; continuing"
  sleep "$INTERVAL"
done
