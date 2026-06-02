import { newDb } from "pg-mem";
import type { Queryable } from "../../src/db";
import { schemaSql } from "../../src/db";

/** An in-memory Postgres with the schema applied, satisfying Queryable. */
export async function makeTestDb(): Promise<Queryable> {
  const mem = newDb();
  const { Pool } = mem.adapters.createPg();
  const pool = new Pool();
  await pool.query(schemaSql());
  return pool as unknown as Queryable;
}
