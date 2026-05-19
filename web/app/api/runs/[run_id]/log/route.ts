import { NextRequest, NextResponse } from "next/server";
import { getRun } from "../../../../../lib/github";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(_req: NextRequest, { params }: { params: { run_id: string } }) {
  const run = await getRun(params.run_id).catch(() => null);
  const logPath = path.join(os.homedir(), "code", "design-studio", ".runs", `${params.run_id}.log`);
  let lines: string[] = [];
  try {
    if (fs.existsSync(logPath)) {
      lines = fs.readFileSync(logPath, "utf8").split("\n").filter(Boolean).slice(-100);
    }
  } catch {}
  return NextResponse.json({ run_id: params.run_id, log_available: lines.length > 0, lines, status: run?.status ?? "unknown" });
}
