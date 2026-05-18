#!/usr/bin/env bash
# worker-once.sh — execute ONE poll cycle of the factory worker.
#
# What it does:
#   1. git pull --rebase to fetch any new queue specs from GitHub
#   2. find queue/*.json files that don't yet have a corresponding runs/{run-id}.json
#   3. for each pending spec: invoke Claude Code in non-interactive mode (claude -p)
#      with the "run job {run-id}" trigger
#   4. Claude Code (the orchestrator) handles all status updates + git commits
#
# Intended to be called either:
#   - from a `while true` loop in worker.sh
#   - from launchd every 30 seconds
#   - manually for testing
#
# Usage: scripts/worker-once.sh

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

LOG="$ROOT/.worker.log"
exec > >(tee -a "$LOG") 2>&1

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] worker-once tick"

# Bail if we don't have a clean working tree — won't mess with operator's WIP.
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  echo "  ⚠ working tree dirty; skipping this tick. Stash or commit, then resume."
  exit 0
fi

# Bail if claude CLI not available.
if ! command -v claude > /dev/null 2>&1; then
  echo "  ❌ 'claude' CLI not found in PATH. Install Claude Code first."
  exit 1
fi

# Bail if git not authed for push (we'll find out fast either way).
if ! git pull --rebase --quiet 2>/dev/null; then
  echo "  ⚠ git pull failed. Check auth (gh auth status) or network. Skipping tick."
  exit 0
fi

# Collect pending run IDs: any queue/*.json without a matching runs/*.json
mkdir -p queue runs
pending=()
for spec in queue/*.json; do
  [ -f "$spec" ] || continue
  run_id=$(basename "$spec" .json)
  if [ ! -f "runs/${run_id}.json" ]; then
    pending+=("$run_id")
  fi
done

if [ ${#pending[@]} -eq 0 ]; then
  echo "  no pending jobs"
  exit 0
fi

echo "  pending: ${pending[*]}"

for run_id in "${pending[@]}"; do
  echo ""
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] picking up $run_id"

  # Hand off to Claude Code. The orchestrator reads queue/{run_id}.json,
  # executes all 8 phases, writes runs/{run_id}.json incrementally, and
  # commits + pushes at the end.
  #
  # -p (--print) runs non-interactively and exits when the task is done.
  if ! claude -p "Execute queue job queue/${run_id}.json. Follow CLAUDE.md and sops/00-orchestrator-contract.md. Write status updates to runs/${run_id}.json after each phase. Commit and push when complete or halted." 2>&1; then
    echo "  ❌ claude CLI returned non-zero for $run_id. See $LOG for details."
    # Mark the run halted at the worker layer so the operator app shows the failure.
    python3 - <<PYEOF
import json, datetime, os
status = {
  "run_id": "${run_id}",
  "status": "halted",
  "halt_reason": "worker-invocation-failed",
  "halt_phase": 0,
  "updated_at": datetime.datetime.utcnow().isoformat() + "Z"
}
path = f"runs/${run_id}.json"
if os.path.isfile(path):
  existing = json.load(open(path))
  existing.update(status)
  status = existing
json.dump(status, open(path, "w"), indent=2)
PYEOF
    git add "runs/${run_id}.json"
    git commit -m "worker: halt ${run_id} (claude invocation failed)" --quiet
    git push --quiet || echo "  ⚠ push failed; will retry next tick"
  fi
done

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] tick complete"
