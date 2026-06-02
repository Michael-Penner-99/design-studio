import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../src/db";
import { ingest, IngestPayloadSchema } from "../../../src/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(req: NextRequest): boolean {
  const expected = process.env.OPERATOR_TOKEN;
  if (!expected) return false;
  const got = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  return got === expected;
}

export async function POST(req: NextRequest) {
  if (!process.env.OPERATOR_TOKEN) {
    return NextResponse.json({ error: "OPERATOR_TOKEN not configured" }, { status: 500 });
  }
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let parsed;
  try {
    parsed = IngestPayloadSchema.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ error: "Invalid payload", detail: String(e) }, { status: 400 });
  }
  await ingest(getDb(), parsed);
  return NextResponse.json({ ok: true, slug: parsed.slug, pages: parsed.pages.length });
}
