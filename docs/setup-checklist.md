# Setup checklist

> One-time setup before your first factory run. Walk through top to bottom; estimated 30 minutes.

## 1. Clone the factory and copy the env template

```bash
cd action-studio-factory
cp .env.example .env
```

## 2. Get a Google Places API key (10 minutes)

The factory's `review-scraper` skill uses Google Places for verified review evidence. Without it, Phase 2 halts every run.

1. Go to https://console.cloud.google.com.
2. Create a new project named "Action Studio" (or use existing).
3. Navigate: **APIs & Services → Library**. Search "Places API (New)" and **Enable**.
4. Navigate: **APIs & Services → Credentials → Create credentials → API key**.
5. Restrict the key to the Places API (under "API restrictions") for safety.
6. Set `GOOGLE_PLACES_API_KEY=` in `.env`.

Cost note: Google Places gives a $200/month free credit which covers about 11,000 Place Details calls. One factory run consumes ~2–5 calls. You can run 2000+ clients/month for free.

## 3. Set up Vercel for hosting (10 minutes)

The factory deploys every client site to a subdomain of `actiondesignstudio.com`.

1. If you don't have a Vercel account, sign up at https://vercel.com.
2. Buy or transfer `actiondesignstudio.com` to a registrar that lets you point DNS at Vercel. You said you've already purchased the domain — good.
3. In Vercel: **Add a domain → actiondesignstudio.com**. Vercel will give you DNS instructions.
4. Configure wildcard DNS so every `{slug}.actiondesignstudio.com` resolves:
   - At your registrar, add a CNAME record: `*` → `cname.vercel-dns.com.`
   - Plus the root: `@` (apex) → Vercel's IP per their dashboard.
5. Generate a Vercel token: https://vercel.com/account/tokens. Scope: "Full Account" or scoped to your team.
6. Find your team ID: run `npx vercel teams ls` after installing the CLI (`npm i -g vercel`).
7. Set `VERCEL_TOKEN=` and `VERCEL_TEAM_ID=` in `.env`.

## 4. (Optional) Image generation for mascots (5 minutes)

Only needed if you want the factory to auto-generate mascots when a contractor doesn't have one. Most premium/commercial archetypes skip this — only Hero/Everyman archetypes default to mascot.

Pick one:
- **OpenAI**: https://platform.openai.com/api-keys → `OPENAI_API_KEY=` in `.env`.
- **Replicate**: https://replicate.com/account/api-tokens → uncomment `REPLICATE_API_TOKEN=`.

## 5. (Optional) Facebook reviews (variable)

Facebook's Graph API requires app review for Page access. Most operators skip this and rely on Google Places alone — if you have ≥ 10 Google reviews per contractor (which most established contractors do), G-07 passes.

If you do want Facebook reviews:
- Create a Facebook app at https://developers.facebook.com.
- Request the `pages_read_user_content` and `pages_show_list` permissions; submit for app review.
- Once approved, generate a long-lived Page Access Token per contractor and set `FB_PAGE_ACCESS_TOKEN=`.

## 6. (Optional) Paid keyword data (5 minutes)

The `seo-keyword-tool` skill defaults to free Google autocomplete + SerpAPI estimates, which are usable but rough. For agency-grade output, wire DataForSEO.

- Sign up at https://dataforseo.com.
- Get login + password; set both in `.env`.

## 7. Install local tooling

```bash
npm i -g vercel              # Vercel CLI for deploys
pip3 install pyyaml beautifulsoup4 pillow scikit-learn  # for the skills
```

## 8. Verify your setup

```bash
scripts/check-setup.sh
```

This walks through every required and optional variable, confirms tools are installed, and pings the Vercel API to validate your token. If you see "Ready", you're done.

## 9. First run

```bash
scripts/new-client.sh capstone-contracting https://capstonecontractingsolutions.com
```

Then open this repo in Claude Code:

```
claude
```

Inside Claude Code:

```
run a fresh lead for https://capstonecontractingsolutions.com
```

You should see the orchestrator delegate Phase 1, 2, 3, etc. Tail `clients/capstone-contracting/brief.md` to watch the `status:` field advance.

## Troubleshooting setup

### "Vercel API call failed"
Token may be expired or scoped wrong. Regenerate at https://vercel.com/account/tokens and re-export.

### "Google Places returns 403"
You forgot to enable the Places API (New) in the GCP console, or your API key restriction is too tight. Loosen the restriction to "Places API (New)" only.

### "Wildcard DNS not resolving"
Cloudflare-proxied wildcards don't work with Vercel out of the box. Either disable Cloudflare proxy on the `*` record (DNS only — gray cloud) or use Cloudflare's "CNAME flattening" with a worker. Easiest: use a non-Cloudflare DNS provider for the apex while wildcard points at Vercel.

### "npm i -g vercel fails on macOS"
Use `sudo npm i -g vercel` if you don't have a user-writable npm prefix, or set up nvm.
