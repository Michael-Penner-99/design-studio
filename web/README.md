# Action Studio · Factory operator app

A Next.js 14 (App Router) front-end for queuing factory runs. Single operator, no database — every submission becomes a JSON file committed to the `design-studio` GitHub repo, which the local worker on Michael's Mac polls every 30 seconds. See `../docs/queue-contract.md` for the protocol.

## Local development

```bash
cd web
npm install
cp .env.example .env.local
# Fill in GITHUB_TOKEN (PAT, repo scope on Michael-Penner-99/design-studio)
# Fill in FORM_SUBMIT_TOKEN (any random string)
npm run dev
```

Open `http://localhost:3000`. Submitting the form will create real commits in GitHub, so use a sandbox token or be deliberate.

Type-check:
```bash
npx tsc --noEmit
```

## Deployment (Vercel)

1. Push the `design-studio` monorepo to GitHub if it is not already there.
2. In the Vercel dashboard click **Add New → Project** and import `Michael-Penner-99/design-studio`.
3. Configure the project:
   - **Project name:** `factory-actiondesignstudio`
   - **Root Directory:** `web`
   - **Framework Preset:** Next.js (auto-detected)
   - **Node version:** 20.x
4. Add the environment variables from `.env.example` under **Settings → Environment Variables** (Production + Preview):
   - `GITHUB_TOKEN` — fine-scoped PAT with `repo` scope on `Michael-Penner-99/design-studio`
   - `GITHUB_REPO_OWNER` — `Michael-Penner-99`
   - `GITHUB_REPO_NAME` — `design-studio`
   - `GITHUB_DEFAULT_BRANCH` — `main`
   - `FORM_SUBMIT_TOKEN` — random string (this is shared between the in-app form and the API route; it is not a public secret but it is also not a real auth boundary)
   - `NEXT_PUBLIC_FACTORY_DOMAIN` — `actiondesignstudio.com`
5. **Settings → Domains:** add `factory.actiondesignstudio.com`.
6. **Settings → Deployment Protection → Password Protection:** turn it on for Production and Preview, set a password. This is the only auth gate on the app — Vercel handles the password screen.
7. Deploy.

## How a run flows

1. Operator opens `https://factory.actiondesignstudio.com`, fills the form (URL mode or business-name + reviews mode), and clicks **Start run**.
2. `POST /api/runs` validates with `zod`, generates a `run-YYYYMMDD-HHMMSS-xxxx` identifier, and uses Octokit to commit `queue/{run-id}.json` to the design-studio repo (single commit on `main`).
3. The local worker on Michael's Mac polls `queue/` every 30 seconds via `git pull`, picks up the new spec, and starts driving Claude Code through the 8-phase pipeline.
4. After each phase the worker commits `runs/{run-id}.json` with updated status. The operator app reads that file on every page load — no database, no realtime layer.
5. `/runs/[run_id]` auto-refreshes every 30 seconds while `status: running`, so the operator sees progress without manual reload.

See `../docs/queue-contract.md` for the full job-spec and run-status schemas.

## Notes

- All API routes set `runtime = "nodejs"` because `@octokit/rest` uses Node-only features.
- The `runs/` directory is allowed to not exist yet — listing returns `[]` until the worker writes its first status file.
- The `/api/runs` POST is intentionally simple: validate → generate id → commit → return id. Concurrency is not a concern because there is one operator.
- No external auth providers, no database, no realtime layer. State lives in GitHub.
