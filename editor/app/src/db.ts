import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Pool } from "pg";

/** Minimal query surface shared by the production pg Pool and the pg-mem test pool. */
export interface Queryable {
  query(text: string, params?: unknown[]): Promise<{ rows: any[] }>;
}

let pool: Pool | undefined;
export function getDb(): Queryable {
  if (!pool) {
    const connectionString = process.env.POSTGRES_URL;
    if (!connectionString) throw new Error("POSTGRES_URL is not set");
    pool = new Pool({ connectionString });
  }
  return pool;
}

export function schemaSql(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return readFileSync(join(here, "..", "db", "schema.sql"), "utf8");
}

export async function applySchema(db: Queryable): Promise<void> {
  await db.query(schemaSql());
}
