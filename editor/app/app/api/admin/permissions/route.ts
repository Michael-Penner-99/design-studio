import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { TIERS } from "@action-studio/editor-engine";
import { getDb } from "../../../../src/db";
import { sessionFromRequest } from "../../../../src/session-request";
import { getManifest, saveManifest, upsertClient, getClient } from "../../../../src/repo";
import { applyPermissionChange } from "../../../../src/permissions-edit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  slug: z.string().min(1),
  tier: z.enum(TIERS).refine((t) => t !== "custom", "tier must be a preset, not 'custom'"),
  perField: z.record(z.string(), z.boolean()).optional(),
});

export async function POST(req: NextRequest) {
  const db = getDb();
  const session = await sessionFromRequest(db, req);
  if (!session || session.role !== "operator") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body;
  try { body = Body.parse(await req.json()); }
  catch (e) { return NextResponse.json({ error: "Invalid", detail: String(e) }, { status: 400 }); }

  const manifest = await getManifest(db, body.slug);
  if (!manifest) return NextResponse.json({ error: "Unknown client" }, { status: 404 });
  const client = await getClient(db, body.slug);
  if (!client) return NextResponse.json({ error: "Unknown client" }, { status: 404 });

  const { manifest: next } = applyPermissionChange(manifest, { tier: body.tier as any, perField: body.perField });
  await saveManifest(db, body.slug, next);
  await upsertClient(db, {
    slug: body.slug, displayName: client.display_name,
    vercelProjectId: client.vercel_project_id, customDomain: client.custom_domain,
    tier: next.tier,
  });
  return NextResponse.json({ ok: true, tier: next.tier });
}
