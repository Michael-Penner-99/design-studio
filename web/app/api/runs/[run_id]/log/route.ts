import { NextRequest, NextResponse } from "next/server";
import { getRun } from "../../../../../lib/github";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: { run_id: string } },
) {
  const run = await getRun(params.run_id).catch(() => null);
  const runId = params.run_id;

  // Look for the run log at ~/code/design-studio/.runs/{run_id}.log
  // This only works in local dev — on Vercel this won't exist, return empty
  const logPath = path.join(os.homedir(), "code", "design-studio", ".runs", `${runId}.log`);

  let lines: string[] = [];
  try {
    if (fs.existsSync(logPath)) {
      const content = fs.readFileSync(logPath, "utf8");
      lines = content
        .split("\n")
        .filter(Boolean)
        .slice(-100); // last 100 lines
    }
  } catch {
    // ignore
  }

  return NextResponse.json({
    run_id: runId,
    log_available: lines.length > 0,
    lines,
    status: run?.status ?? "unknown",
    current_phase: run?.current_phase ?? null,
  });
}
