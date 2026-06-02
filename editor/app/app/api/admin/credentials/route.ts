import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "../../../../src/db";
import { setCredential } from "../../../../src/repo";
import { hashPassword } from "../../../../src/auth";
import { sessionFromRequest, operatorAuthorized } from "../../../../src/session-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  username: z.string().min(1),
  slug: z.string().min(1),
  password: z.string().min(8),
});

export async function POST(req: NextRequest) {
  const db = getDb();
  const session = await sessionFromRequest(db, req);
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!operatorAuthorized(session, bearer, process.env.OPERATOR_TOKEN)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try { body = Body.parse(await req.json()); }
  catch (e) { return NextResponse.json({ error: "Invalid", detail: String(e) }, { status: 400 }); }

  await setCredential(db, {
    username: body.username, slug: body.slug, role: "client",
    passwordHash: await hashPassword(body.password),
  });
  return NextResponse.json({ ok: true });
}
