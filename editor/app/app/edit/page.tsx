import { cookies } from "next/headers";
import { getDb } from "../../src/db";
import { getSession } from "../../src/auth";
import { getManifest, getOverrides } from "../../src/repo";
import { SESSION_COOKIE } from "../../src/session-cookie";
import { visibleFields, groupFields } from "../../src/view";
import EditorForm from "./EditorForm";

export const dynamic = "force-dynamic";

export default async function EditPage() {
  const db = getDb();
  const sid = cookies().get(SESSION_COOKIE)?.value;
  const session = sid ? await getSession(db, sid) : null;
  if (!session || !session.slug) return <main style={{ padding: 24 }}><p>Please <a href="/login">sign in</a>.</p></main>;

  const manifest = await getManifest(db, session.slug);
  if (!manifest) return <main style={{ padding: 24 }}><p>No site found for your account.</p></main>;
  const overrides = await getOverrides(db, session.slug, "draft");
  const groups = groupFields(visibleFields(manifest, "client"));
  return <EditorForm slug={session.slug} groups={groups} initialOverrides={overrides} />;
}
