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

## UI & uploads (Plan 2d)
Page routes:
- `/login` — username + password sign-in (sets the session cookie).
- `/edit` — client editor: fields grouped by page → section, only the fields the operator unlocked, with autosave (draft), Preview, and Publish.
- `/admin/{slug}` — operator: permission tier + per-field toggles, and (stub) client password.

Env:
- `BLOB_READ_WRITE_TOKEN` — required for image uploads (`POST /api/upload`). Vercel sets it automatically when a Blob store is linked to the project.

### Setting a client password (v1)
The `/api/admin/credentials` route is operator-token protected (server-to-server), so the admin panel's "Set password" button does not work from the browser yet. For now, set a client's password by calling it directly with the operator token:
```
curl -X POST "$EDITOR_APP_URL/api/admin/credentials" \
  -H "authorization: Bearer $OPERATOR_TOKEN" \
  -H "content-type: application/json" \
  -d '{"username":"{slug}","slug":"{slug}","password":"<min-8-chars>"}'
```
Then send the client the `/login` link, their username (the slug), and the password.
**Follow-up:** add a session-protected admin credentials route so the button works in-browser.
