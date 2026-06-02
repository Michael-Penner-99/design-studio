# Editor App (hosted)

Durable system of record for the client site editor (Plan 2b).

## Env
- `POSTGRES_URL` — Postgres connection string.
- `OPERATOR_TOKEN` — bearer token for `/api/ingest` and `/api/admin/credentials`.

## Schema
Apply `db/schema.sql` to the database once (e.g. `psql "$POSTGRES_URL" -f db/schema.sql`).

## Endpoints
- `POST /api/ingest` (operator token) — receive a pushed client.
- `POST /api/admin/credentials` (operator token) — set a client's password.
- `POST /api/auth/login` / `POST /api/auth/logout` — session cookie.

Publisher (preview/publish) and UIs are added in Plans 2c / 2d.

## Publishing (Plan 2c)
- `POST /api/preview` / `POST /api/publish` (session-authenticated; a client may only act on their own slug, operators on any).
- Publish merges published overrides into the site (HTML + stored assets) and deploys to the client's `{slug}-site` Vercel project (`target: production`), updating their custom domain. Preview deploys to a throwaway `*.vercel.app` URL.
- Requires `VERCEL_TOKEN` (+ `VERCEL_TEAM_ID`) on the app.
- **Clients pushed before Plan 2c must be re-pushed once** (the "Push to editor" button) so their assets are captured — otherwise a publish would deploy HTML without images.
