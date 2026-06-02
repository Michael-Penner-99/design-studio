import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../src/db";
import { deleteSession } from "../../../../src/repo";
import { SESSION_COOKIE } from "../../../../src/session-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const id = req.cookies.get(SESSION_COOKIE)?.value;
  if (id) await deleteSession(getDb(), id);
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
