import { cookies } from "next/headers";
import { getDb } from "../../src/db";
import { getSession } from "../../src/auth";
import { listClients } from "../../src/repo";
import { SESSION_COOKIE } from "../../src/session-cookie";

export const dynamic = "force-dynamic";

export default async function AdminIndex() {
  const db = getDb();
  const sid = cookies().get(SESSION_COOKIE)?.value;
  const session = sid ? await getSession(db, sid) : null;
  if (!session || session.role !== "operator") {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui" }}>
        <p>Operator sign-in required. <a href="/login">Sign in</a></p>
      </main>
    );
  }

  const clients = await listClients(db);
  return (
    <main style={{ maxWidth: 760, margin: "24px auto", fontFamily: "system-ui" }}>
      <h1>Clients</h1>
      {clients.length === 0 ? (
        <p>No clients yet.</p>
      ) : (
        <ul>
          {clients.map((c) => (
            <li key={c.slug} style={{ margin: "6px 0" }}>
              <a href={`/admin/${c.slug}`}>{c.display_name}</a>{" "}
              <small style={{ color: "#777" }}>({c.slug} · {c.permission_tier})</small>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
