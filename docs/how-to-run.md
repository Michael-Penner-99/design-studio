# How to run the factory

> Operator handbook. Read once before your first run, refer back during runs.

## Prerequisites

Before any run, confirm:

1. **Claude Code** is installed and you can `cd` into this repo and start a session.
2. **Environment** — these env vars or files are present and current:
   - `GOOGLE_PLACES_API_KEY` (for review scraping)
   - `VERCEL_TOKEN` and `VERCEL_TEAM_ID` (for deploys)
   - `OPENAI_API_KEY` or equivalent (for mascot generation — optional, only fires if a mascot is missing)
3. **Disk** — each run produces ~50–150 MB in `clients/{slug}/` (mostly assets).
4. **DNS** — `actiondesignstudio.com` is delegated to Vercel so wildcard subdomains resolve.

## Trigger phrases (the operator-to-orchestrator API)

Type any of these into Claude Code while inside this repo:

| Phrase | Effect |
|---|---|
| `run a fresh lead for {URL}` | Full 8-phase run end-to-end |
| `build a site for {URL}` | Synonym of the above |
| `run {URL}` | Same, terser |
| `resume {slug}` | Continue from the last completed phase recorded in `brief.md` |
| `run phase {n} for {slug}` | Execute one phase only (useful for factory debugging) |
| `re-qa {slug}` | Re-run QA + iterate against the current build |
| `redeploy {slug}` | Push current `site/` to Vercel without rebuilding |
| `cleanup {slug}` | After deploy, remove `clients/{slug}/` from local (with confirmation). Site stays live. |
| `fetch {slug}` | Re-pull a cleaned-up client's source from Vercel for editing |

If you type anything else, the orchestrator responds with the supported list rather than guessing.

## A first run, step-by-step

```bash
# 1. Scaffold the client folder. URL gets validated and slug derived.
scripts/new-client.sh capstone-contracting https://capstonecontractingsolutions.com

# 2. Open this directory in Claude Code (your usual command).
claude

# 3. Inside Claude Code, type:
run a fresh lead for https://capstonecontractingsolutions.com
```

The orchestrator delegates each phase. You'll see Task tool calls for `discovery-researcher`, `asset-extractor`, etc. Each finishes with a one-line completion report. The orchestrator verifies artifacts before advancing.

Total wall-clock time: 30–90 minutes per client depending on how much asset scraping and how many iteration loops.

## Where to look while a run is happening

- `clients/{slug}/brief.md` — `status:` field updates after every phase. Tail it.
- `clients/{slug}/research/`, `assets/`, `brand/`, `strategy/`, `site/`, `qa/`, `proposal/`, `deploy/` — populated in order.
- `clients/{slug}/halt.md` — if this appears, the run stopped. Open it for the reason.

## After a successful run

The orchestrator prints:

```
{slug} | {pages} pages | {iterations}/3 iterations | preview: {url} | proposal: {pdf_path}
```

Forward the proposal PDF to the lead. The preview URL lives at `{slug}.actiondesignstudio.com` and stays live indefinitely until you decommission it. When the lead signs:

1. Open `clients/{slug}/deploy/handoff.md` — it has the four operator instructions for production cutover.
2. Point the contractor's real domain CNAME at `cname.vercel-dns.com`.
3. Run `scripts/redeploy.sh {slug}` if you've made edits since the last deploy.

## Troubleshooting

### "Halt: cannot extract logo"
The contractor's site doesn't expose a logo from the usual locations. Check `clients/{slug}/halt.md` for what was tried. Options:
- Hand-place a logo into `assets/raw/logo.{ext}` and re-run from Phase 2: `run phase 2 for {slug}`.
- If the contractor doesn't have a usable logo at all, the factory cannot proceed. Surface to the lead — this is a real input gap.

### "Halt: fewer than 6 real project photos"
The contractor's site has no gallery or fewer than 6 photos.
- Inspect `clients/{slug}/halt.md` for which pages were crawled.
- Ask the contractor for additional photos (operator-side; the factory itself doesn't ask). Drop them into `assets/raw/project-{n}.{ext}` and re-run Phase 2.

### "Halt: QA failed after 3 iterations"
Open `clients/{slug}/qa/halt.md` for the residual FAIL list. Common causes:
- A signature move in `design-direction.md` references a section partial that doesn't exist. Add the partial under `templates/sections/{name}/` and re-run from Phase 5.
- Evidence is thin (G-07 / G-11 fails). May require re-running Phase 2 with manual asset additions.

### "Halt: Vercel deploy failed"
Check `vercel logs` for the deployment ID in `deploy/manifest.json`. Common causes:
- Token expired → refresh `VERCEL_TOKEN`.
- Wildcard DNS not propagated → wait, then `redeploy`.

## When to override the factory

The factory is designed to run hands-off, but you may want to override:

- **Service-area pages.** The recipe enables them when ≥ 3 service areas. If you want fewer or more, edit `clients/{slug}/strategy/sitemap.md` after Phase 4 and re-run from Phase 5.
- **Voice.** If `brand/voice.md` got the tone wrong, edit it and re-run from Phase 4 (Strategy → Copy).
- **Hero photo.** If the design-director picked the wrong project photo, edit `strategy/design-direction.md` and re-run from Phase 5.

In every override, the orchestrator's resume logic respects your edits. Don't overwrite the artifacts the operator hand-edited unless explicitly told to.

## Per-client time budget (rough)

| Phase | Time |
|---|---|
| 1 Discovery | 5–10 min |
| 2 Capture | 5–15 min (slowest if many photos) |
| 3 Brand DNA | 3–5 min |
| 4 Strategy | 10–20 min |
| 5 Build | 5–15 min |
| 6 Quality (1 iteration) | 5–10 min |
| 7 Proposal | 5–10 min |
| 8 Deploy | 1–3 min |
| **Total typical** | **40–90 min** |


## Local storage hygiene (the cleanup loop)

Per-client folders grow to 50–150 MB. To keep your machine clean, run `scripts/cleanup-client.sh {slug}` after every successful run.

The script will refuse to delete anything if:
- The client has a `halt.md` (run failed and needs debugging).
- The client is not registered in `clients/_deployed.json` (Phase 8 didn't complete).
- The preview URL is not currently returning 200 (site is down — don't orphan local files).

If those three checks pass, you get a confirmation prompt with the slug, preview URL, and current local size. Hit `y` to delete.

To restore a cleaned-up client later for edits:

```bash
scripts/fetch-client.sh {slug}
# edits in clients/{slug}/site/...
scripts/redeploy.sh {slug}
```

`fetch-client.sh` only restores `site/` (the deployable). Earlier-phase folders (brief.md, research/, brand/, strategy/, qa/, proposal/) are NOT stored on Vercel — they're regeneratable on demand by `run phase {n} for {slug}` if you need them back.
