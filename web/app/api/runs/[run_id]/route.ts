import { NextRequest, NextResponse } from "next/server";
import { getQueueSpec, getRun } from "../../../../lib/github";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { run_id: string } },
) {
  try {
    // In local dev, read directly from disk — fast and always fresh
    const localPath = path.join(os.homedir(), "code", "design-studio", "runs", `${params.run_id}.json`);
    if (fs.existsSync(localPath)) {
      const run = JSON.parse(fs.readFileSync(localPath, "utf8"));
      return NextResponse.json({ run });
    }
    // Fallback to GitHub API (production/Vercel)
    const status = await getRun(params.run_id);
    if (status) return NextResponse.json({ run: status });
    const spec = await getQueueSpec(params.run_id);
    if (!spec) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ run: null, spec });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Failed to fetch run", details: message }, { status: 502 });
  }
}
