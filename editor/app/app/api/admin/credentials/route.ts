import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "../../../../src/db";
import { setCredential } from "../../../../src/repo";
import { hashPassword } from "../../../../src/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  username: z.string().min(1),
  slug: z.string().min(1),
  password: z.string().min(8),
});

export async function POST(req: NextRequest) {
  const expected = process.env.OPERATOR_TOKEN;
  if (!expected) return NextResponse.json({ error: "OPERATOR_TOKEN not configured" }, { status: 500 });
  const got = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (got !== expected) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body;
  try { body = Body.parse(await req.json()); }
  catch (e) { return NextResponse.json({ error: "Invalid", detail: String(e) }, { status: 400 }); }

  await setCredential(getDb(), {
    username: body.username, slug: body.slug, role: "client",
    passwordHash: await hashPassword(body.password),
  });
  return NextResponse.json({ ok: true });
}
