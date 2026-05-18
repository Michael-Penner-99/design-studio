# Action Studio — Design Studio monorepo

> One URL or business-name input → premium contractor website + sales walkthrough page + audit trail. Triggered from a Vercel-hosted operator app, executed by a local worker, deployed to per-client subdomains of `actiondesignstudio.com`.

This is a monorepo. Three layers, one repo:

| Layer | Lives at | Runs where |
|---|---|---|
| **Factory engine** | repo root (`CLAUDE.md`, `sops/`, `templates/`, `recipes/`, `skills/`, `quality-gates/`) | Claude Code on your Mac |
| **Operator app** | `web/` | Vercel — `factory.actiondesignstudio.com` |
| **Local worker** | `scripts/worker*.sh` | launchd agent on your Mac |

The three layers communicate through git: the operator app commits job specs to `queue/`, the worker pulls and runs them, the worker pushes status to `runs/`, the operator app reads them. No database. See `docs/queue-contract.md` for the protocol.

---

## First-time setup (one hour, top to bottom)

### 1. Push this code to GitHub (5 min)

You said the repo is `Michael-Penner-99/design-studio`. From this folder:

```bash
gh auth login                                          # one-time, if not already
gh repo create Michael-Penner-99/design-studio --private --source=. --remote=origin --push
```

Or if you'd rather create the repo via the web UI: create empty private repo `design-studio` on github.com, then:

```bash
git init
git add .
git commit -m "Initial: factory + web + worker"
git branch -M main
git remote add origin git@github.com:Michael-Penner-99/design-studio.git
git push -u origin main
```

### 2. Wire credentials in `.env` (10 min)

```bash
cp .env.example .env
```

Open `.env`, fill in:
- `GOOGLE_PLACES_API_KEY` — for review scraping. Get at https://console.cloud.google.com (enable Places API New). $200/month free credit covers ~2000+ runs.
- `VERCEL_TOKEN` + `VERCEL_TEAM_ID` — for site deploys. Token at https://vercel.com/account/tokens. Team ID via `vercel teams ls`.
- `OPENAI_API_KEY` — for the no-URL mode's AI-generated logo + photo placeholders. Get at https://platform.openai.com/api-keys.
- `DEFAULT_CONTACT_FORM_ENDPOINT` — optional, default contact-form webhook for generated contractor sites.

Then verify:

```bash
scripts/check-setup.sh
```

Should print "Ready."

### 3. DNS — point `*.actiondesignstudio.com` at Vercel (5 min + propagation)

You already own the domain. At your DNS registrar add:

| Type | Name | Value |
|---|---|---|
| A | @ | `76.76.21.21` |
| CNAME | www | `cname.vercel-dns.com` |
| CNAME | * | `cname.vercel-dns.com` |

Wait 5–30 min for propagation. Test: `dig +short factory.actiondesignstudio.com` should resolve to a Vercel IP.

### 4. Deploy the operator app (15 min)

```bash
cd web
npm install
npx vercel link                                        # interactive — pick "Other" framework
```

Inside the link wizard, configure:
- Set up and deploy: **Yes**
- Scope: pick your team
- Link to existing project: **No**
- Project name: **factory-actiondesignstudio**
- Directory: **`./`** (you're already in `web/`)
- Modify settings: **No**

Then:

```bash
npx vercel env add GITHUB_TOKEN                        # PAT with `repo` scope on Michael-Penner-99/design-studio
npx vercel env add GITHUB_REPO_OWNER                   # Michael-Penner-99
npx vercel env add GITHUB_REPO_NAME                    # design-studio
npx vercel env add FORM_SUBMIT_TOKEN                   # any random string, e.g. `openssl rand -hex 24`
npx vercel env add NEXT_PUBLIC_FACTORY_DOMAIN          # actiondesignstudio.com

npx vercel --prod                                      # production deploy
```

Then in the Vercel dashboard:
- **Settings → Domains** → add `factory.actiondesignstudio.com`
- **Settings → Deployment Protection** → enable **Password Protection**, set a password

Visit `factory.actiondesignstudio.com`. You should see the password prompt, then the operator form.

### 5. Install the local worker (3 min)

Back in the repo root on your Mac:

```bash
npm i -g @anthropic-ai/claude-code                     # the `claude` CLI, if not installed
scripts/install-worker.sh
```

This drops a launchd plist at `~/Library/LaunchAgents/com.actionstudio.factory-worker.plist` and loads it. The worker will tick every 30 seconds.

Watch it:

```bash
tail -f .worker.log
```

You'll see `worker-once tick` lines. While `queue/` is empty, it says "no pending jobs".

### 6. Try your first run (15 min wall-clock)

From the operator app at `factory.actiondesignstudio.com`:
- Click "From URL" tab
- Paste a contractor URL (try `https://capstonecontractingsolutions.com` for a known-good test)
- Click **Start Run**

What happens:
1. Vercel app commits `queue/run-{timestamp}-{rand}.json` to GitHub.
2. Worker `git pull`s within 30s, sees the new spec.
3. Worker invokes `claude -p "run job queue/{run-id}.json"`.
4. The Claude Code orchestrator on your Mac executes the 8 phases. Status is committed to `runs/{run-id}.json` after each phase.
5. The Vercel dashboard at `/runs/{run-id}` reflects progress on refresh.
6. When complete: two URLs appear in the dashboard — the contractor site and the sales walkthrough.

Total: ~40–90 minutes per run.

---

## Day-to-day operation

### Trigger a run (URL mode)
At `factory.actiondesignstudio.com` → "From URL" → paste URL → Start Run.

### Trigger a run (no-URL mode)
"From business name" → fill in name + trade + city + paste at least 10 reviews → Start Run. Factory builds with AI-generated logo + photos. Site will display the banner: "This preview uses placeholder photography. Send us your real photos and we'll swap them in before launch."

### Forward to the lead
After completion, the operator dashboard shows:
- **Sales walkthrough URL** — share this with the lead. "I built you a website. Want to see it?"
- **Contractor site URL** — embedded inside the walkthrough, also linkable directly.

### Close the deal
On the call, screenshare the walkthrough. Walk through the Traffic + Trust + Conversion framework. Lead approves → take payment → run `redeploy {slug}` if any final edits, then point their real domain CNAME at `cname.vercel-dns.com`.

### Reclaim local disk space
After successful deploy + handoff, run `scripts/cleanup-client.sh {slug}`. It verifies the site is still live, prompts for confirmation, removes `clients/{slug}/`. The site stays on Vercel.

### Edit a deployed site later
`scripts/fetch-client.sh {slug}` re-pulls the site files from Vercel. Edit. `scripts/redeploy.sh {slug}` pushes back.

---

## Repo layout (one-screen reference)

```
design-studio/
├── CLAUDE.md                           # Orchestrator instructions
├── README.md                           # This file
├── .env.example
├── .gitignore
├── .claude/                            # 12 subagent prompts
├── sops/                               # 16 SOPs (00 contract, 01..14 phases, 15 worker)
├── skills/                             # 7 reusable skills (review scrape, color extract, etc.)
├── templates/
│   ├── pages/                          # Home/About/Services/Reviews page templates
│   ├── sections/                       # 14 section partials
│   ├── shared/                         # head/header/footer/tailwind config
│   └── walkthrough/                    # Sales walkthrough page template (Traffic+Trust+Conversion)
├── recipes/                            # 6 contractor recipes (roofing, hvac, exteriors, remodel, plumbing, electrical)
├── quality-gates/checklist.yml         # 35 QA gates
├── scripts/                            # Operator entry points + worker
├── docs/                               # architecture, queue-contract, how-to-run, phase-reference, setup-checklist
├── clients/                            # Per-client outputs (gitignored except _deployed.json)
├── queue/                              # Pending job specs (committed by Vercel app)
├── runs/                               # Run status (committed by worker)
└── web/                                # Vercel operator app (Next.js, deployed separately)
```

---

## Docs to read when you need them

- `docs/architecture.md` — full system architecture, 8-phase pipeline, data flow.
- `docs/queue-contract.md` — the protocol between Vercel app, GitHub, and the worker.
- `docs/how-to-run.md` — operator handbook for direct Claude Code use (no operator app).
- `docs/phase-reference.md` — per-phase inputs/outputs/verification.
- `docs/setup-checklist.md` — credentials walkthrough.
- `sops/00-orchestrator-contract.md` — the orchestrator's procedure.
- `sops/15-worker-run.md` — how the orchestrator handles queue-driven invocations.

---

## What's NOT in v1

- Customer portal / auth on generated sites.
- Headless CMS for the blog.
- Multi-language sites.
- A/B testing infrastructure.
- HubSpot / Salesforce lead-routing integrations.

All of these are documented expansion hooks in `docs/phase-reference.md` under "Pro tier expansion hooks (deferred to v2)".

---

## Status

**v1 — built but unverified end-to-end.** All three layers exist. The factory engine has been demoed on a real contractor (Capstone). The web app type-checks and the worker scripts pass syntax check. **The full pipeline has not yet been run live with real Vercel + GitHub credentials wired.** Your first run is the integration test.

If anything in the first run breaks, the right thing to fix it is usually:
1. Worker not picking up jobs → check `.worker.log` and `gh auth status`.
2. Phase halts → open `clients/{slug}/halt.md` for the specific reason.
3. Vercel deploy fails → token expired or DNS not propagated; check `vercel logs`.
