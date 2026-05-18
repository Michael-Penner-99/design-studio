# SOP 15 — Worker-invoked run

> When the Vercel operator app writes a queue spec, the local worker polls and invokes `claude -p "run job queue/{run-id}.json"`. This SOP is the contract the orchestrator follows when it receives that trigger.

## Purpose
Execute an 8-phase run end-to-end with status reporting flowing back to GitHub (and therefore to the operator dashboard) without any human in the loop.

## Inputs
- `queue/{run-id}.json` — the job spec, schema per `docs/queue-contract.md`.

## Steps

### 1. Parse the spec

Read `queue/{run-id}.json`. Validate against the schema. If invalid → write `runs/{run-id}.json` with `status: halted`, `halt_reason: "invalid-spec"`, commit + push, exit.

### 2. Derive the slug

- If `mode: "url"`: derive slug from URL per SOP 00 §2.
- If `mode: "name-and-reviews"`: kebab-case from `business_name` (lowercase, alphanum + dash, truncate 40 chars).

### 3. Initialize the runs status file

Write `runs/{run-id}.json`:

```json
{
  "run_id": "...",
  "slug": "...",
  "mode": "url" | "name-and-reviews",
  "url": "...",
  "started_at": "ISO8601 now",
  "updated_at": "ISO8601 now",
  "status": "running",
  "current_phase": 1,
  "phases": {
    "1": { "name": "Discovery",        "status": "pending" },
    "2": { "name": "Capture",          "status": "pending" },
    "3": { "name": "Brand DNA",        "status": "pending" },
    "4": { "name": "Strategy",         "status": "pending" },
    "5": { "name": "Build",            "status": "pending" },
    "6": { "name": "Quality",          "status": "pending" },
    "7": { "name": "Sales-Ready",      "status": "pending" },
    "8": { "name": "Deploy & Handoff", "status": "pending" }
  },
  "outputs": { "site_url": null, "sales_walkthrough_url": null, "proposal_pdf_path": null },
  "halt_reason": null,
  "halt_phase": null
}
```

Commit + push: `worker: pick up {run-id}`.

### 4. Scaffold the client folder

- `mode: "url"` → `scripts/new-client.sh {slug} {url}`
- `mode: "name-and-reviews"` → `scripts/new-client-from-name.sh {slug} "{business_name}" {trade_hint} "{primary_city}"`. Then write `evidence/reviews-raw.txt` from `spec.reviews_text` for the brief agent to parse.

### 5. Execute phases 1–8 per SOP 00

For each phase:
- Before starting: update `runs/{run-id}.json` — set `phases.{n}.status: "running"`, `phases.{n}.started_at: now`, `current_phase: n`, `updated_at: now`. Commit + push: `worker: phase {n} start {run-id}`.
- Execute the phase per SOP 00.
- After completion: set `phases.{n}.status: "completed"`, `phases.{n}.completed_at: now`, `updated_at: now`. Commit + push: `worker: phase {n} done {run-id}`.

On halt within any phase:
- Set `phases.{n}.status: "halted"`, `status: "halted"`, `halt_reason: "..."`, `halt_phase: n`.
- Commit + push: `worker: halt {run-id} at phase {n}`.
- Exit.

### 6. Finalize outputs (after Phase 8)

Populate `outputs`:
- `site_url`: from `clients/{slug}/deploy/manifest.json` (site deploy)
- `sales_walkthrough_url`: from `clients/{slug}/deploy/manifest.json` (sales deploy)
- `proposal_pdf_path`: from `clients/{slug}/proposal/proposal.pdf`

Set `status: "completed"`. Commit + push: `worker: complete {run-id}`.

### 7. Surface the cleanup prompt

Print to stdout (the worker logs it):

```
✓ Run complete. Local folder: clients/{slug}/ ({size})
  Site preview:        {site_url}
  Sales walkthrough:   {sales_walkthrough_url}
  Proposal PDF:        {proposal_pdf_path}
To remove local files now that everything is on Vercel:
  scripts/cleanup-client.sh {slug}
```

Do not auto-clean.

## Outputs

- `runs/{run-id}.json` — final state pushed to GitHub.
- `clients/{slug}/` — local artifacts as usual.
- Two Vercel deployments (site + sales walkthrough).

## Exit criteria

- `runs/{run-id}.json` `status: "completed"` or `status: "halted"`.
- The status file is pushed to GitHub.
- The operator dashboard at `factory.actiondesignstudio.com/runs/{run-id}` reflects the final state on next page load.

## Failure modes

- **Push fails (network/auth)**: retry up to 3 times with exponential backoff. If still failing, write `runs/{run-id}.json` locally only and surface to operator on next worker tick.
- **A phase fails irrecoverably**: SOP 00's halt logic applies. The orchestrator writes `clients/{slug}/halt.md` AND updates `runs/{run-id}.json` `status: "halted"`.
- **Worker process killed mid-phase**: `scripts/recover-stale-runs.sh` runs at next worker boot and marks running-but-stale runs as halted with reason `worker-crashed-or-restarted`.
