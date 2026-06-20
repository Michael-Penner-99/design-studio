import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { put } from "@vercel/blob";
import { getDb } from "../../../../src/db";
import { ingestAssets } from "../../../../src/ingest-assets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  slug: z.string().min(1),
  assets: z.array(z.object({ path: z.string().min(1), base64: z.string() })),
});

function authorized(req: NextRequest): boolean {
  const expected = process.env.OPERATOR_TOKEN;
  if (!expected) return false;
  const got = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  return got === expected;
}

export async function POST(req: NextRequest) {
  if (!process.env.OPERATOR_TOKEN) return NextResponse.json({ error: "OPERATOR_TOKEN not configured" }, { status: 500 });
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body;
  try { body = Body.parse(await req.json()); }
  catch (e) { return NextResponse.json({ error: "Invalid payload", detail: String(e) }, { status: 400 }); }

  const blobPut = async (key: string, bytes: Buffer) => {
    const r = await put(key, bytes, { access: "public", addRandomSuffix: false });
    return { url: r.url };
  };
  const count = await ingestAssets(getDb(), blobPut, body.slug, body.assets);
  return NextResponse.json({ ok: true, count });
}
