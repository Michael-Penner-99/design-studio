import { NextRequest, NextResponse } from "next/server";
import { getRun } from "../../../../../lib/github";
import { execSync } from "child_process";
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
    return NextResponse.json({ error: `Site directory not found: ${siteDir}` }, { status: 404 });
  }

  const vercelToken = process.env.VERCEL_TOKEN;
  const vercelScope = process.env.VERCEL_SCOPE;

  // Build the Claude prompt
  const fullPrompt = `You are editing the website for client "${slug}" located at ${siteDir}.

The operator has requested the following change:
"${prompt}"

Instructions:
1. Read the relevant HTML/CSS files in ${siteDir}
2. Make ONLY the requested change — don't rewrite or restructure anything else
3. Preserve all existing classes, IDs, and structure
4. After editing, print a short summary: what files you changed and exactly what you changed
5. Format your summary as:
   FILES_CHANGED: file1.html, file2.html
   SUMMARY: [what changed]

Do the edits now.`;

  try {
    // Run Claude Code on the site directory
    const claudeOutput = execSync(
      `cd "${root}" && claude -p --dangerously-skip-permissions "${fullPrompt.replace(/"/g, '\\"')}"`,
      { timeout: 120000, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 }
    );

    // Parse files changed from output
    const filesMatch = claudeOutput.match(/FILES_CHANGED:\s*(.+)/);
    const filesChanged = filesMatch
      ? filesMatch[1].split(",").map(f => f.trim()).filter(Boolean)
      : [];

    const summaryMatch = claudeOutput.match(/SUMMARY:\s*(.+)/s);
    const summary = summaryMatch ? summaryMatch[1].trim() : claudeOutput.slice(-500);

    // Redeploy if requested and Vercel token is available
    let redeployed = false;
    let deployUrl = null;

    if (redeploy && vercelToken) {
      try {
        const deployOutput = execSync(
          `cd "${siteDir}" && vercel deploy --prod --yes${vercelScope ? ` --scope ${vercelScope}` : ""} --token "${vercelToken}"`,
          { timeout: 120000, encoding: "utf8" }
        );
        deployUrl = deployOutput.trim().split("\n").pop();
        redeployed = true;
      } catch (deployErr) {
        console.error("Deploy failed:", deployErr);
      }
    }

    return NextResponse.json({
      result: summary,
      files_changed: filesChanged,
      redeployed,
      deploy_url: deployUrl,
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message.slice(0, 500) }, { status: 500 });
  }
}
