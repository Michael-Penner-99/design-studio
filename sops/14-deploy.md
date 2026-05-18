# SOP 14 — Deploy & Handoff

## Purpose

Push two artifacts to Vercel under two different subdomains, verify both, write the handoff packet, register the client in `_deployed.json`, and surface the optional cleanup prompt.

The two artifacts:

1. **Contractor site** — `clients/{slug}/site/` → `{slug}.actiondesignstudio.com` (public, the lead's preview URL).
2. **Sales walkthrough** — `clients/{slug}/sales/` → `{slug}-sales.actiondesignstudio.com` (public, but only Michael shares the URL — it's the page Action Studio uses to argue the case).

Both projects live in the same `clients/{slug}/` folder under the same slug, and both are registered as a single entry in `clients/_deployed.json`.

## Inputs

- `clients/{slug}/site/` (QA-passed, from SOP 11)
- `clients/{slug}/sales/` (from SOP 13)
- Vercel API token + team configured in `.env` (`VERCEL_TOKEN`, `VERCEL_TEAM_ID`)

## Steps

### Part A — Deploy the contractor site

1. **Project setup.** Use `skills/deploy-vercel/`:
   - Project name: `{slug}-site` (note: `-site` suffix — was bare `{slug}` in v1; renamed so the paired sales project doesn't collide)
   - Framework preset: `other` (static)
   - Build command: none
   - Output directory: `.`
   - Root directory: `clients/{slug}/site`
2. **Deploy.** `vercel deploy --prod`. Capture the preview URL printed.
3. **Alias.** `vercel alias set {deployment-url} {slug}.actiondesignstudio.com`.
4. **Verify.** Poll `https://{slug}.actiondesignstudio.com` with `curl -I` until 200, max 60s. Halt if not.

### Part B — Deploy the sales walkthrough

5. **Project setup.** Same skill, second project:
   - Project name: `{slug}-sales`
   - Framework preset: `other` (static)
   - Build command: none
   - Output directory: `.`
   - Root directory: `clients/{slug}/sales`
6. **Deploy.** `vercel deploy --prod`. Capture the preview URL printed.
7. **Alias.** `vercel alias set {deployment-url} {slug}-sales.actiondesignstudio.com`.
8. **Verify.** Poll `https://{slug}-sales.actiondesignstudio.com` with `curl -I` until 200, max 60s. Halt if not.

### Part C — Write artifacts and register

9. **Write artifacts** to `clients/{slug}/deploy/`:

   - `deploy/manifest.json`:
     ```json
     {
       "slug": "{slug}",
       "site": {
         "vercel_project_id": "...",
         "vercel_project_name": "{slug}-site",
         "deployment_id": "...",
         "preview_url": "https://{slug}.actiondesignstudio.com",
         "deployment_url_raw": "https://{slug}-site-xxxx.vercel.app",
         "deployed_at": "ISO8601",
         "file_count": 12,
         "pages": ["index.html", "about.html", "services/index.html", "..."]
       },
       "sales": {
         "vercel_project_id": "...",
         "vercel_project_name": "{slug}-sales",
         "deployment_id": "...",
         "preview_url": "https://{slug}-sales.actiondesignstudio.com",
         "deployment_url_raw": "https://{slug}-sales-xxxx.vercel.app",
         "deployed_at": "ISO8601",
         "file_count": 2,
         "pages": ["index.html"]
       }
     }
     ```

   - `deploy/preview-url.txt` — just the canonical contractor-site URL (the proposal embeds this). One line, no trailing newline ceremony.
   - `deploy/sales-url.txt` — the canonical sales-walkthrough URL. Operator copies this to send the lead.
   - `deploy/handoff.md` — operator instructions for production cutover (DNS, ownership transfer, decommission of old site).

10. **Register in `_deployed.json`.** Append/update an entry in `clients/_deployed.json` under the same slug:

    ```json
    {
      "slug": "{slug}",
      "site": {
        "vercel_project_id": "...",
        "preview_url": "https://{slug}.actiondesignstudio.com"
      },
      "sales": {
        "vercel_project_id": "...",
        "preview_url": "https://{slug}-sales.actiondesignstudio.com"
      },
      "deployed_at": "ISO8601",
      "last_status": "deployed",
      "local_present": true,
      "cleaned_up_at": null
    }
    ```

    Note: the v1 schema had `vercel_project_id` and `preview_url` at the top level. This is now a nested `site` + `sales` structure. Migration: any pre-existing v1 entry without `site.`/`sales.` keys is still readable — treat the top-level `preview_url` as the `site.preview_url` and leave `sales` null.

11. **Set `status: deployed` in `brief.md`.**

12. **Cleanup prompt (post-run, surfaced by the orchestrator).** After Phase 7 (Proposal) also completes successfully, the orchestrator prints:

    ```
    ✓ Run complete.
      Site:  https://{slug}.actiondesignstudio.com
      Sales: https://{slug}-sales.actiondesignstudio.com  (private — do not link publicly)
      PDF:   clients/{slug}/proposal/proposal.pdf
    Local folder: clients/{slug}/ ({size})
    To remove the local copy now that both sites are live and the proposal is sent:
      scripts/cleanup-client.sh {slug}
    ```

    The orchestrator does NOT auto-clean. The operator runs the script when ready.

## Outputs

- `clients/{slug}/deploy/manifest.json`
- `clients/{slug}/deploy/preview-url.txt`
- `clients/{slug}/deploy/sales-url.txt`
- `clients/{slug}/deploy/handoff.md`
- `clients/_deployed.json` updated with nested site/sales entry

## Exit criteria

- `preview-url.txt` and `sales-url.txt` both exist and contain one canonical URL each.
- HEAD on both URLs returns 200.
- `handoff.md` exists with the operator cutover instructions.
- `_deployed.json` contains an entry for this slug with both `site.preview_url` and `sales.preview_url` populated, and `local_present: true`.

## Halt

- Contractor site non-2xx for > 60s → halt before deploying the sales walkthrough. Don't half-deploy.
- Sales walkthrough non-2xx for > 60s → halt with both deployments rolled into `manifest.json` for forensics, but do not write `handoff.md` or register in `_deployed.json`.
- DNS doesn't resolve to Vercel for either domain within 120s → halt with `dns-{which}-not-resolving`.

## After cleanup (downstream behaviour)

When `scripts/cleanup-client.sh {slug}` runs:
- It verifies BOTH preview URLs still return 200 (defence against orphan cleanup of either project).
- It removes `clients/{slug}/` entirely.
- It updates `_deployed.json`: `local_present: false`, `cleaned_up_at: ISO8601`.

To restore for editing: `scripts/fetch-client.sh {slug}` pulls `site/` AND `sales/` back from Vercel via two `vercel pull` calls. Other folders (brief.md, research/, brand/, etc.) are not stored on Vercel — they're regenerable per-phase if needed.
