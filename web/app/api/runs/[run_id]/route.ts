import { NextRequest, NextResponse } from "next/server";
import { getQueueSpec, getRun } from "../../../../lib/github";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { run_id: string } },
) {
  try {
    const status = await getRun(params.run_id);
    if (status) {
      return NextResponse.json({ run: status });
    }
    // Maybe still queued and worker hasn't written runs/ yet.
    const spec = await getQueueSpec(params.run_id);
    if (!spec) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ run: null, spec });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to fetch run", details: message },
      { status: 502 },
    );
  }
}
