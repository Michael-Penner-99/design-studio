import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { newRunInputSchema, type JobSpec } from "../../../lib/schemas";
import { generateRunId } from "../../../lib/run-id";
import { listRuns, writeQueueSpec } from "../../../lib/github";

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

export async function POST(req: NextRequest) {
  const authFail = checkAuth(req);
  if (authFail) return authFail;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = newRunInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const run_id = generateRunId();
  const submitted_at = new Date().toISOString();
  const submitted_by = "michael@innovusaccounting.com";

  const baseOptions = {
    skip_deploy: input.options?.skip_deploy ?? false,
    force_archetype: input.options?.force_archetype ?? null,
    ai_image_provider: input.options?.ai_image_provider ?? "openai",
  };

  let spec: JobSpec;
  if (input.mode === "url") {
    spec = {
      run_id,
      submitted_at,
      submitted_by,
      mode: "url",
      url: input.url,
      manual_notes: input.manual_notes,
      options: baseOptions,
    };
  } else {
    spec = {
      run_id,
      submitted_at,
      submitted_by,
      mode: "name-and-reviews",
      business_name: input.business_name,
      trade_hint: input.trade_hint,
      primary_city: input.primary_city,
      reviews_text: input.reviews_text,
      manual_notes: input.manual_notes,
      options: baseOptions,
    };
  }

  try {
    await writeQueueSpec(spec);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to commit queue spec", details: message },
      { status: 502 },
    );
  }

  revalidatePath("/");
  revalidatePath("/runs");

  return NextResponse.json({ run_id, queued: true });
}

export async function GET() {
  try {
    const runs = await listRuns();
    return NextResponse.json({ runs });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to list runs", details: message },
      { status: 502 },
    );
  }
}
