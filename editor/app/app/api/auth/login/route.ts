import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "../../../../src/db";
import { login } from "../../../../src/auth";
import { SESSION_COOKIE, sessionCookieOptions } from "../../../../src/session-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ username: z.string().min(1), password: z.string().min(1) });

export async function POST(req: NextRequest) {
  let body;
  try { body = Body.parse(await req.json()); }
  catch { return NextResponse.json({ error: "Invalid" }, { status: 400 }); }

  const result = await login(getDb(), body.username, body.password);
  if (!result) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });

  const res = NextResponse.json({ ok: true, role: result.role, slug: result.slug });
  res.cookies.set(SESSION_COOKIE, result.sessionId, sessionCookieOptions(60 * 60 * 24 * 14));
  return res;
}
