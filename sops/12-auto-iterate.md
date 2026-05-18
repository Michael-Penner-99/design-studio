# SOP 12 — Auto-Iterate

## Purpose
Read the QA report and fix every FAIL, up to 3 iterations.

## Inputs
- `qa/report.md` (with FAIL entries)
- `site/` (the built site to be edited)
- `brief.md` (for the iteration counter)

## Steps

1. **Read iteration counter** from `brief.md.qa.iteration` (default 0). Set it to N+1 for this pass.
2. **Create iteration folder** `qa/iterations/{NN}/`.
3. **Process FAILs in order of severity.** For each FAIL:
   - Open the offending file in `site/`.
   - Diagnose: is the fix at the build layer (HTML edit), the copy layer (would require regenerating copy.md), or the data layer (missing evidence)?
   - If build-layer → apply edit directly. Save before-and-after to `qa/iterations/{NN}/diff.patch`.
   - If copy-layer → annotate FAIL as `DEFER_TO_PHASE_4`. The orchestrator will decide whether to restart Strategy.
   - If data-layer → annotate `DEFER_TO_PHASE_2`. Same.
4. **Write** `qa/iterations/{NN}/fixes.md` documenting every fix: gate ID, what was wrong, what changed, why this resolves the gate.
5. **Update** `brief.md.qa.iteration` to N+1.

## Outputs
- `qa/iterations/{NN}/fixes.md`
- `qa/iterations/{NN}/diff.patch` (optional)
- Edited `site/` files
- `brief.md.qa.iteration` incremented

## Exit criteria
- Every FAIL has either been edited or deferred.
- Iteration counter reflects the pass.

## Halt
- If iteration counter reaches 3 and FAILs remain → write `qa/halt.md` with the residual list, hand back to orchestrator.
