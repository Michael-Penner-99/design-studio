import { describe, it, expect } from "vitest";
import { makeTestDb } from "./helpers/pgmem";

describe("schema", () => {
  it("creates all tables and round-trips a row", async () => {
    const db = await makeTestDb();
    await db.query(
      "INSERT INTO clients (slug, display_name) VALUES ($1,$2)",
      ["acme", "Acme Co"]
    );
    const { rows } = await db.query("SELECT slug, permission_tier FROM clients WHERE slug=$1", ["acme"]);
    expect(rows[0]).toEqual({ slug: "acme", permission_tier: "Text only" });
  });
});
