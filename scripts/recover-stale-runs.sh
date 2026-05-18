#!/usr/bin/env bash
# recover-stale-runs.sh — mark any runs/*.json that are still status:running
# but older than 30 minutes as halted with reason "worker-crashed-or-restarted".
#
# Called once at worker startup. Idempotent.
#
# Usage: scripts/recover-stale-runs.sh

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

python3 - <<'PYEOF'
import json, os, datetime, glob, subprocess

STALE_MINUTES = 30
now = datetime.datetime.utcnow()
recovered = []

for path in glob.glob("runs/*.json"):
    try:
        data = json.load(open(path))
    except Exception:
        continue

    if data.get("status") != "running":
        continue

    updated = data.get("updated_at") or data.get("started_at")
    if not updated:
        continue

    try:
        last = datetime.datetime.fromisoformat(updated.replace("Z", ""))
    except Exception:
        continue

    age_min = (now - last).total_seconds() / 60.0
    if age_min < STALE_MINUTES:
        continue

    data["status"] = "halted"
    data["halt_reason"] = "worker-crashed-or-restarted"
    data["halt_phase"] = data.get("current_phase", 0)
    data["updated_at"] = now.isoformat() + "Z"
    json.dump(data, open(path, "w"), indent=2)
    recovered.append(path)

if recovered:
    print(f"recovered {len(recovered)} stale run(s): {recovered}")
    subprocess.run(["git", "add"] + recovered, check=True)
    subprocess.run(["git", "commit", "-m", f"worker: recover {len(recovered)} stale run(s)", "--quiet"], check=True)
    subprocess.run(["git", "push", "--quiet"], check=False)
else:
    print("no stale runs")
PYEOF
