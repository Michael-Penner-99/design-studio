import { cookies } from "next/headers";
import { getDb } from "../../../src/db";
import { getSession } from "../../../src/auth";
import { getManifest, getClient } from "../../../src/repo";
import { SESSION_COOKIE } from "../../../src/session-cookie";
import AdminPanel from "./AdminPanel";

export const dynamic = "force-dynamic";

export default async function AdminPage({ params }: { params: { slug: string } }) {
  const db = getDb();
  const sid = cookies().get(SESSION_COOKIE)?.value;
  const session = sid ? await getSession(db, sid) : null;
  if (!session || session.role !== "operator") return <main style={{ padding: 24 }}><p>Operator sign-in required.</p></main>;

  const manifest = await getManifest(db, params.slug);
  const client = await getClient(db, params.slug);
  if (!manifest || !client) return <main style={{ padding: 24 }}><p>Unknown client.</p></main>;
  return <AdminPanel slug={params.slug} tier={client.permission_tier}
    fields={manifest.fields.map((f) => ({ id: f.id, label: f.label, type: f.type, clientEditable: f.clientEditable }))} />;
}
