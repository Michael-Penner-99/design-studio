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
