import { NextRequest, NextResponse } from "next/server";
import { getRun, writeResumeInput, requeueRun, getRecentActivity } from "../../../../../lib/github";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function checkAuth(req: NextRequest): NextResponse | null {
  const expected = process.env.FORM_SUBMIT_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: "Server misconfigured: FORM_SUBMIT_TOKEN not set" },
      { status: 500 },
    );
  }
  const header =
    req.headers.get("x-form-token") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    "";
  if (header !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { run_id: string } },
) {
  const activity = await getRecentActivity(params.run_id);
  return NextResponse.json({ activity });
}
export async function POST(
  req: NextRequest,
  { params }: { params: { run_id: string } },
) {
  const authFail = checkAuth(req);
  if (authFail) return authFail;

  const run = await getRun(params.run_id);
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }
  if (run.status !== "halted") {
    return NextResponse.json(
      { error: "Run is not halted" },
      { status: 400 },
    );
  }
  if (!run.slug) {
    return NextResponse.json(
      { error: "Run has no slug — cannot locate client folder" },
      { status: 400 },
    );
  }

  let body: { reviews_text?: string; notes?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const resumePhase = run.halt_phase ?? 2;

  try {
    // 1. Write the supplied reviews/notes into the client folder on GitHub
    await writeResumeInput({
      slug: run.slug,
      runId: run.run_id,
      resumePhase,
      reviewsText: body.reviews_text ?? "",
      notes: body.notes ?? "",
    });

    // 2. Reset run status to queued + write a new queue spec with resume_from_phase
    await requeueRun(run, resumePhase);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to commit resume input", details: message },
      { status: 502 },
    );
  }

  return NextResponse.json({ queued: true, resume_from_phase: resumePhase });
}
