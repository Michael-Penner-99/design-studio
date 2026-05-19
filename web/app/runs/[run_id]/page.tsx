import { notFound } from "next/navigation";
import { getQueueSpec, getRun } from "../../../lib/github";
import { RunShell } from "../../../components/run-shell";
import type { RunStatus } from "../../../lib/schemas";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Params { run_id: string; }

export default async function RunDetailPage({ params }: { params: Params }) {
  const status = await getRun(params.run_id);
  let run: RunStatus | null = status;

  if (!run) {
    const spec = await getQueueSpec(params.run_id);
    if (!spec) notFound();
    run = {
      run_id: spec.run_id,
      slug: null,
      mode: spec.mode,
      url: spec.url ?? null,
      business_name: spec.business_name ?? null,
      started_at: spec.submitted_at,
      updated_at: null,
      status: "queued",
      current_phase: 0,
      phases: {},
      outputs: null,
      halt_reason: null,
      halt_phase: null,
    };
  }

  const formToken = process.env.FORM_SUBMIT_TOKEN ?? "";
  return <RunShell initialRun={run} formToken={formToken} />;
}
