// Applies db/schema.sql to the database in POSTGRES_URL. Idempotent (CREATE TABLE IF NOT EXISTS).
// Usage: POSTGRES_URL=... node scripts/apply-schema.mjs
import { Pool } from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(here, "..", "db", "schema.sql"), "utf8");

const connectionString = process.env.POSTGRES_URL;
if (!connectionString) {
  console.error("POSTGRES_URL is not set");
  process.exit(1);
}

// Mirror the app's getDb() exactly: SSL behavior comes from the connection string
// (use ?sslmode=no-verify for Supabase's pooler cert).
const pool = new Pool({ connectionString });
try {
  await pool.query(sql);
  const { rows } = await pool.query(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"
  );
  console.log("schema applied. public tables:", rows.map((r) => r.tablename).join(", "));
} finally {
  await pool.end();
}
