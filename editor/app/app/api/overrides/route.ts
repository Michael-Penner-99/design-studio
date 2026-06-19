import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { LinkValueSchema } from "@action-studio/editor-engine";
import { getDb } from "../../../src/db";
import { sessionFromRequest, authorizeSlug } from "../../../src/session-request";
import { getManifest, getOverrides, saveOverrides } from "../../../src/repo";
import { canEditField, applyFieldOverride } from "../../../src/overrides-edit";
import { corsForReq } from "../../../src/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const db = getDb();
  const session = await sessionFromRequest(db, req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsForReq(req) });
  const slug = req.nextUrl.searchParams.get("slug") ?? "";
  if (!authorizeSlug(session, slug)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: corsForReq(req) });
  return NextResponse.json({ overrides: await getOverrides(db, slug, "draft") }, { headers: corsForReq(req) });
}

const PutBody = z.object({
  slug: z.string().min(1),
  fieldId: z.string().min(1),
  value: z.union([z.string(), LinkValueSchema]),
});

export async function PUT(req: NextRequest) {
  const db = getDb();
  const session = await sessionFromRequest(db, req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsForReq(req) });

  let body;
  try { body = PutBody.parse(await req.json()); }
  catch { return NextResponse.json({ error: "Invalid" }, { status: 400, headers: corsForReq(req) }); }
  if (!authorizeSlug(session, body.slug)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: corsForReq(req) });

  const manifest = await getManifest(db, body.slug);
  if (!manifest) return NextResponse.json({ error: "Unknown client" }, { status: 404, headers: corsForReq(req) });
  const role = session.role === "operator" ? "operator" : "client";
  if (!canEditField(manifest, role, body.fieldId)) {
    return NextResponse.json({ error: "Field not editable" }, { status: 403, headers: corsForReq(req) });
  }
  const draft = await getOverrides(db, body.slug, "draft");
  await saveOverrides(db, body.slug, "draft", applyFieldOverride(draft, body.fieldId, body.value));
  return NextResponse.json({ ok: true }, { headers: corsForReq(req) });
}

export function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsForReq(req) });
}
