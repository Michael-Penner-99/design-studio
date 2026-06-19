import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "../../../../src/db";
import { sessionFromRequest } from "../../../../src/session-request";
import { changeOperatorPassword } from "../../../../src/auth";
import { corsForReq } from "../../../../src/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8) });

export async function PUT(req: NextRequest) {
  const db = getDb();
  const session = await sessionFromRequest(db, req);
  if (!session || session.role !== "operator") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsForReq(req) });
  }
  let body;
  try { body = Body.parse(await req.json()); }
  catch { return NextResponse.json({ error: "Invalid" }, { status: 400, headers: corsForReq(req) }); }

  const ok = await changeOperatorPassword(db, session.username, body.currentPassword, body.newPassword);
  if (!ok) return NextResponse.json({ error: "Current password incorrect" }, { status: 403, headers: corsForReq(req) });
  return NextResponse.json({ ok: true }, { headers: corsForReq(req) });
}

export function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsForReq(req) });
}
