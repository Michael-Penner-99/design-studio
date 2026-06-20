CREATE TABLE IF NOT EXISTS clients (
  slug            TEXT PRIMARY KEY,
  display_name    TEXT NOT NULL,
  vercel_project_id TEXT,
  custom_domain   TEXT,
  permission_tier TEXT NOT NULL DEFAULT 'Text only',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS credentials (
  username      TEXT PRIMARY KEY,
  slug          TEXT,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS manifests (
  slug       TEXT PRIMARY KEY,
  manifest   JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tagged_pages (
  slug TEXT NOT NULL,
  path TEXT NOT NULL,
  html TEXT NOT NULL,
  PRIMARY KEY (slug, path)
);

CREATE TABLE IF NOT EXISTS overrides (
  slug       TEXT NOT NULL,
  state      TEXT NOT NULL,
  data       JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (slug, state)
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  username   TEXT NOT NULL,
  slug       TEXT,
  role       TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS assets (
  slug     TEXT NOT NULL,
  path     TEXT NOT NULL,
  blob_url TEXT NOT NULL,
  size     INTEGER NOT NULL,
  PRIMARY KEY (slug, path)
);

CREATE TABLE IF NOT EXISTS publish_locks (
  slug        TEXT PRIMARY KEY,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
