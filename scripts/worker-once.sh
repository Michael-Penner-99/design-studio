#!/usr/bin/env bash
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

LOG="$ROOT/.worker.log"
exec > >(tee -a "$LOG") 2>&1

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] worker-once tick"

if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  echo "  ⚠ working tree dirty; skipping this tick."
  exit 0
fi

if ! command -v claude > /dev/null 2>&1; then
  echo "  ❌ 'claude' CLI not found in PATH. Install Claude Code first."
  exit 1
fi

if ! git pull --rebase --quiet 2>/dev/null; then
  echo "  ⚠ git pull failed. Check auth or network. Skipping tick."
  exit 0
fi

mkdir -p queue runs
pending=()
resume_phases=()

for spec in queue/*.json; do
  [ -f "$spec" ] || continue
  run_id=$(basename "$spec" .json)
  run_file="runs/${run_id}.json"

  if [ ! -f "$run_file" ]; then
    pending+=("$run_id")
    resume_phases+=("1")
  else
    run_status=$(python3 -c "import json; d=json.load(open('$run_file')); print(d.get('status',''))" 2>/dev/null || echo "")
    if [ "$run_status" = "queued" ]; then
      resume_phase=$(python3 -c "import json; d=json.load(open('$spec')); print(d.get('resume_from_phase','1'))" 2>/dev/null || echo "1")
      pending+=("$run_id")
      resume_phases+=("${resume_phase:-1}")
    fi
  fi
done

if [ ${#pending[@]} -eq 0 ]; then
  echo "  no pending jobs"
  exit 0
fi

echo "  pending: ${pending[*]}"

PHASE_SOPS=(
  ""
  "sops/01-brief.md sops/02-research.md"
  "sops/03-asset-extraction.md"
  "sops/04-brand-audit.md"
  "sops/05-sitemap.md sops/06-wireframes.md sops/07-seo.md sops/08-design-direction.md"
  "sops/10-build.md"
  "sops/11-qa.md sops/12-iterate.md"
  "sops/13-proposal.md"
  "sops/14-deploy.md"
)

PHASE_NAMES=(
  ""
  "Discovery"
  "Capture"
  "Brand DNA"
  "Strategy"
  "Build"
  "Quality"
  "Sales-Ready"
  "Deploy & Handoff"
)

for i in "${!pending[@]}"; do
  run_id="${pending[$i]}"
  start_phase="${resume_phases[$i]}"
  slug=$(python3 -c "import json; d=json.load(open('runs/${run_id}.json')); print(d.get('slug',''))" 2>/dev/null || echo "")

  echo ""
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] picking up $run_id (starting at phase $start_phase)"

  # Run one phase at a time
  for phase in 1 2 3 4 5 6 7 8; do
    # Skip already-completed phases
    if [ "$phase" -lt "$start_phase" ]; then
      continue
    fi

    # Check if this phase is already completed in the run file
    phase_status=$(python3 -c "
import json
d=json.load(open('runs/${run_id}.json'))
phases=d.get('phases',{})
print(phases.get('${phase}',{}).get('status','pending'))
" 2>/dev/null || echo "pending")

    if [ "$phase_status" = "completed" ]; then
      echo "  phase $phase already completed, skipping"
      continue
    fi

    phase_name="${PHASE_NAMES[$phase]}"
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] running phase $phase: $phase_name"

    PROMPT="Execute ONLY phase ${phase} (${phase_name}) of queue job queue/${run_id}.json. Follow CLAUDE.md and sops/00-orchestrator-contract.md. Update runs/${run_id}.json status after this phase completes. Commit and push after this phase. Do NOT proceed to phase $((phase+1)) — stop after phase ${phase} is done."

    if ! claude -p --dangerously-skip-permissions "$PROMPT" 2>&1; then
      echo "  ❌ phase $phase failed for $run_id"
      python3 - << PYEOF
import json, datetime, os
path = "runs/${run_id}.json"
d = json.load(open(path)) if os.path.isfile(path) else {"run_id": "${run_id}"}
d.update({
  "status": "halted",
  "halt_reason": "worker-invocation-failed at phase ${phase} (${phase_name})",
  "halt_phase": ${phase},
  "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
})
json.dump(d, open(path, "w"), indent=2)
PYEOF
      git add "runs/${run_id}.json"
      git commit -m "worker: halt ${run_id} at phase ${phase} (invocation failed)" --quiet
      git push --quiet || echo "  ⚠ push failed"
      break
    fi

    echo "  ✓ phase $phase complete"

    # Re-pull after each phase in case Claude committed
    git pull --rebase --quiet 2>/dev/null || true
  done
done

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] tick complete"
