import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "../../../src/db";
import { sessionFromRequest, authorizeSlug } from "../../../src/session-request";
import { publish } from "../../../src/publisher";
import { corsForReq } from "../../../src/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ slug: z.string().min(1) });

export async function POST(req: NextRequest) {
  const db = getDb();
  const session = await sessionFromRequest(db, req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body;
  try { body = Body.parse(await req.json()); }
  catch { return NextResponse.json({ error: "Invalid" }, { status: 400 }); }
  if (!authorizeSlug(session, body.slug)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const r = await publish(db, body.slug, "preview");
    return NextResponse.json({ ok: true, url: r.url }, { headers: corsForReq(req) });
  } catch (e: any) {
    return NextResponse.json({ error: "Preview failed", detail: String(e?.message ?? e) }, { status: 500 });
  }
}

export function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsForReq(req) });
}
