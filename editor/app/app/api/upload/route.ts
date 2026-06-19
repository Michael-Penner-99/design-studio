import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getDb } from "../../../src/db";
import { sessionFromRequest, authorizeSlug } from "../../../src/session-request";
import { getManifest } from "../../../src/repo";
import { canEditField } from "../../../src/overrides-edit";
import { validateUpload, blobKey } from "../../../src/upload-helper";
import { corsForReq } from "../../../src/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const db = getDb();
  const session = await sessionFromRequest(db, req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const slug = String(form.get("slug") ?? "");
  const fieldId = String(form.get("fieldId") ?? "");
  const file = form.get("file");
  if (!authorizeSlug(session, slug)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });

  const v = validateUpload(file.type, file.size);
  if (!v.ok) return NextResponse.json({ error: v.reason }, { status: 400 });

  const manifest = await getManifest(db, slug);
  const role = session.role === "operator" ? "operator" : "client";
  if (!manifest || !canEditField(manifest, role, fieldId)) {
    return NextResponse.json({ error: "Field not editable" }, { status: 403 });
  }

  const blob = await put(blobKey(slug, fieldId, file.name), file, { access: "public" });
  return NextResponse.json({ ok: true, url: blob.url }, { headers: corsForReq(req) });
}

export function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsForReq(req) });
}
