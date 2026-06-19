import { cookies } from "next/headers";
import { getDb } from "../../../src/db";
import { getSession } from "../../../src/auth";
import { getManifest, getClient, getOverrides } from "../../../src/repo";
import { SESSION_COOKIE } from "../../../src/session-cookie";
import { visibleFields, groupFields } from "../../../src/view";
import AdminPanel from "./AdminPanel";
import EditorForm from "../../edit/EditorForm";

export const dynamic = "force-dynamic";

export default async function AdminPage({ params }: { params: { slug: string } }) {
  const db = getDb();
  const sid = cookies().get(SESSION_COOKIE)?.value;
  const session = sid ? await getSession(db, sid) : null;
  if (!session || session.role !== "operator") return <main style={{ padding: 24 }}><p>Operator sign-in required.</p></main>;

  const manifest = await getManifest(db, params.slug);
  const client = await getClient(db, params.slug);
  if (!manifest || !client) return <main style={{ padding: 24 }}><p>Unknown client.</p></main>;

  const overrides = await getOverrides(db, params.slug, "draft");
  const groups = groupFields(visibleFields(manifest, "operator"));

  const customDomain = client.custom_domain
    ? (/^https?:\/\//.test(client.custom_domain) ? client.custom_domain : `https://${client.custom_domain}`)
    : null;
  const siteUrl = customDomain ?? `https://${params.slug}.actiondesignstudio.com`;

  return (
    <>
      <AdminPanel slug={params.slug} tier={client.permission_tier} siteUrl={siteUrl}
        fields={manifest.fields.map((f) => ({ id: f.id, label: f.label, type: f.type, clientEditable: f.clientEditable }))} />
      <EditorForm slug={params.slug} groups={groups} initialOverrides={overrides} />
    </>
  );
}
