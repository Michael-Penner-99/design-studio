---
name: deploy-vercel
description: Deploy a static site to Vercel under a custom subdomain of actiondesignstudio.com, alias the deployment, verify uptime.
---

# deploy-vercel

## What this skill does
Used in SOP 14 (Phase 8). Pushes `clients/{slug}/site/` to Vercel as a static project named `{slug}`, aliases it to `{slug}.actiondesignstudio.com`, polls until live.

## Inputs
- `slug` (string)
- `site_dir` (path)

## Output
```json
{
  "deployment_id": "...",
  "preview_url": "https://...",
  "custom_domain": "{slug}.actiondesignstudio.com",
  "deployed_at": "ISO8601"
}
```

## Implementation
Wraps the `vercel` CLI. Reads `VERCEL_TOKEN` from env.

```bash
cd "$site_dir"
vercel link --yes --project "$slug" --token "$VERCEL_TOKEN"
vercel deploy --prod --yes --token "$VERCEL_TOKEN"   # returns deployment URL
vercel alias set "$DEPLOYMENT_URL" "$slug.actiondesignstudio.com" --token "$VERCEL_TOKEN"

# Poll until live
for i in {1..30}; do
  if curl -fsSL --head "https://$slug.actiondesignstudio.com" > /dev/null; then
    break
  fi
  sleep 2
done
```

## TODO before first run
- Add `VERCEL_TOKEN` to `.env`.
- Configure wildcard CNAME for `*.actiondesignstudio.com` in DNS pointing to `cname.vercel-dns.com`.
- Verify Vercel team has wildcard subdomain enabled on the project plan.
