# SOP 11 — QA Audit

## Purpose
Run every gate in `quality-gates/checklist.yml` against the built site. Produce a structured pass/fail report. Don't fix anything — fixing is the iterator's job.

## Inputs
- `clients/{slug}/site/` (built)
- `clients/{slug}/brief.md`, `brand/`, `strategy/`, `evidence/`, `assets/`
- `quality-gates/checklist.yml`

## Steps

1. **Read** `quality-gates/checklist.yml`. Each gate has: `id`, `name`, `severity` (critical|major|minor), `check` (executable description), `pass_when` (expected condition).
2. **Run each gate.** Most are one of:
   - **File existence** — check a path.
   - **Grep / regex** — check pattern present or absent in HTML.
   - **DOM count** — count elements matching a selector.
   - **JSON traceability** — check that a claim on the page traces to a row in `evidence/`.
   - **Visual / judgment** — read a section and assess against the spec.
   - **Editor-readiness (G-EDIT-01).** From repo root run `cd editor/engine && npx tsx src/cli.ts check ../../clients/{slug}/site`. It must print `ok` and exit 0. If it lists pages missing the color block, that is a critical FAIL — route to the iterator to re-inject `{{section:head}}` into those pages.
3. **Write `qa/report.md`** with one entry per gate:
   ```
   ### Gate: G-04 — Real review evidence on Home
   Status: PASS
   Severity: critical
   Evidence: site/index.html#reviews quotes 6 reviews; each text appears verbatim in evidence/reviews.json
   Notes: —
   ```
4. **Summary** at the top: total / pass / fail / defer, with a verdict line: "READY TO DEPLOY" or "FIXES NEEDED".

## Outputs
- `qa/report.md`

## Exit criteria
- Every gate from the checklist has an entry.
- Summary verdict line present.
