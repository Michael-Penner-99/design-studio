import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../src/db";
import { sessionFromRequest, authorizeSlug } from "../../../src/session-request";
import { getManifest } from "../../../src/repo";
import { corsForReq } from "../../../src/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const db = getDb();
  const session = await sessionFromRequest(db, req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsForReq(req) });
  const slug = req.nextUrl.searchParams.get("slug") ?? "";
  if (!authorizeSlug(session, slug)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: corsForReq(req) });
  const manifest = await getManifest(db, slug);
  if (!manifest) return NextResponse.json({ error: "Unknown client" }, { status: 404, headers: corsForReq(req) });
  return NextResponse.json({ manifest }, { headers: corsForReq(req) });
}

export function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsForReq(req) });
}
