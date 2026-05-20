import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function checkAuth(req: NextRequest): NextResponse | null {
  const expected = process.env.FORM_SUBMIT_TOKEN;
  if (!expected) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  const header = req.headers.get("x-form-token") || req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (header !== expected) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { run_id: string } },
) {
  const authFail = checkAuth(req);
  if (authFail) return authFail;

  let body: { slug: string; prompt: string; redeploy?: boolean };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { slug, prompt, redeploy = true } = body;
  if (!slug || !prompt) return NextResponse.json({ error: "Missing slug or prompt" }, { status: 400 });

  const root = path.join(os.homedir(), "code", "design-studio");
  const siteDir = path.join(root, "clients", slug, "site");

  if (!fs.existsSync(siteDir)) {
    return NextResponse.json({ error: `Site not found: ${siteDir}` }, { status: 404 });
  }

  const vercelToken = process.env.VERCEL_TOKEN;
  const vercelScope = process.env.VERCEL_SCOPE;

  const redeployCmd = redeploy && vercelToken
    ? `cd "${siteDir}" && vercel deploy --prod --yes${vercelScope ? ` --scope ${vercelScope}` : ""} --token "${vercelToken}"`
    : "";

  const fullPrompt = `You are editing the website for client "${slug}" at ${siteDir}.

Operator request: "${prompt}"

Instructions:
1. Read the relevant HTML files in ${siteDir}
2. Make ONLY the requested change — preserve all existing structure
3. After editing, print exactly:
   FILES_CHANGED: file1.html, file2.html
   SUMMARY: one sentence describing what changed

Do the edits now.`;

  // Write prompt to a temp file to avoid shell escaping issues
  const tmpPrompt = path.join(os.tmpdir(), `edit-${params.run_id}-${Date.now()}.txt`);
  fs.writeFileSync(tmpPrompt, fullPrompt);

  return new Promise<NextResponse>((resolve) => {
    let output = "";
    let errOutput = "";
    const timeout = setTimeout(() => {
      resolve(NextResponse.json({ 
        error: "Claude Code timed out (5 min). The edit may still be running — check the site in a moment.",
        result: "Timed out — try a simpler edit or check the site manually.",
        files_changed: [],
        redeployed: false,
      }));
    }, 300000); // 5 minutes

    const proc = spawn("bash", ["-c", 
      `cd "${root}" && claude -p --dangerously-skip-permissions "$(cat ${tmpPrompt})"`
    ], { env: { ...process.env, PATH: `/Users/${os.userInfo().username}/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin` } });

    proc.stdout.on("data", (d: Buffer) => { output += d.toString(); });
    proc.stderr.on("data", (d: Buffer) => { errOutput += d.toString(); });

    proc.on("close", async (code) => {
      clearTimeout(timeout);
      fs.unlinkSync(tmpPrompt);

      const filesMatch = output.match(/FILES_CHANGED:\s*(.+)/);
      const filesChanged = filesMatch ? filesMatch[1].split(",").map(f => f.trim()) : [];
      const summaryMatch = output.match(/SUMMARY:\s*(.+)/);
      const summary = summaryMatch ? summaryMatch[1].trim() : output.slice(-800).trim() || errOutput.slice(-400);

      let redeployed = false;
      if (redeployCmd && code === 0) {
        try {
          await new Promise<void>((res, rej) => {
            const dp = spawn("bash", ["-c", redeployCmd]);
            dp.on("close", c => c === 0 ? res() : rej(new Error("deploy failed")));
          });
          redeployed = true;
        } catch { /* deploy failed silently */ }
      }

      resolve(NextResponse.json({ result: summary, files_changed: filesChanged, redeployed }));
    });
  });
}
