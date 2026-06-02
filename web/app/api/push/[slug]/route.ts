import { NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const run = promisify(execFile);

// Operator app is run locally; this route only works where the repo + engine exist.
export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } },
) {
  const slug = params.slug;
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }
  const endpoint = process.env.EDITOR_APP_URL;
  const token = process.env.OPERATOR_TOKEN;
  if (!endpoint || !token) {
    return NextResponse.json({ error: "EDITOR_APP_URL / OPERATOR_TOKEN not set" }, { status: 500 });
  }
  const repoRoot = join(process.cwd(), "..");           // web/ lives under the repo root
  const engineCli = join(repoRoot, "editor", "engine", "src", "cli.ts");
  try {
    const { stdout } = await run(
      "npx",
      ["tsx", engineCli, "push", slug, "--root", repoRoot, "--endpoint", endpoint],
      { cwd: repoRoot, env: process.env },
    );
    return NextResponse.json({ ok: true, output: stdout.trim() });
  } catch (e: any) {
    return NextResponse.json({ error: "Push failed", detail: String(e?.stderr ?? e) }, { status: 500 });
  }
}
