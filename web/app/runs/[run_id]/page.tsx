import Link from "next/link";
import { notFound } from "next/navigation";
import { getQueueSpec, getRun } from "../../../lib/github";
import { PhaseStepper } from "../../../components/phase-stepper";
import type { RunStatus } from "../../../lib/schemas";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Params {
  run_id: string;
}

export default async function RunDetailPage({
  params,
}: {
  params: Params;
}) {
  const status = await getRun(params.run_id);
  // If no status yet, fall back to the queue spec so we can show "queued".
  let synthetic: RunStatus | null = status;
  if (!synthetic) {
    const spec = await getQueueSpec(params.run_id);
    if (!spec) notFound();
    synthetic = {
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

  const run = synthetic;
  const isRunning = run.status === "running" || run.status === "queued";

  return (
    <div className="space-y-8">
      {/* Auto-refresh while running. <meta refresh> works on a server-rendered page. */}
      {isRunning && (
        // eslint-disable-next-line @next/next/no-head-element
        <meta httpEquiv="refresh" content="30" />
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/runs"
            className="text-xs text-muted hover:text-ink"
          >
            ← All runs
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            {run.business_name ?? run.url ?? run.slug ?? "Run"}
          </h1>
          <div className="mt-1 font-mono text-xs text-muted">{run.run_id}</div>
        </div>
        <StatusBadge status={run.status} />
      </div>

      <SpecPanel run={run} />

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
          Phase progress
        </h2>
        <PhaseStepper run={run} />
      </section>

      {run.status === "completed" && run.outputs ? (
        <OutputsPanel outputs={run.outputs} />
      ) : null}

      {run.status === "halted" ? (
        <HaltPanel run={run} />
      ) : null}
    </div>
  );
}

function StatusBadge({ status }: { status: RunStatus["status"] }) {
  const styles: Record<RunStatus["status"], string> = {
    queued: "bg-white/10 text-muted",
    running: "bg-accent/20 text-accent-light",
    completed: "bg-emerald-500/15 text-emerald-300",
    halted: "bg-rose-500/15 text-rose-300",
  };
  return (
    <span className={`tag text-xs ${styles[status]}`}>{status}</span>
  );
}

function SpecPanel({ run }: { run: RunStatus }) {
  return (
    <section className="card">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
        Spec
      </h2>
      <dl className="grid grid-cols-1 gap-y-2 text-sm md:grid-cols-2">
        <Row label="Mode" value={run.mode} />
        {run.url ? <Row label="URL" value={run.url} mono /> : null}
        {run.business_name ? (
          <Row label="Business" value={run.business_name} />
        ) : null}
        {run.slug ? <Row label="Slug" value={run.slug} mono /> : null}
        <Row label="Started" value={formatDate(run.started_at)} />
        {run.updated_at ? (
          <Row label="Updated" value={formatDate(run.updated_at)} />
        ) : null}
      </dl>
    </section>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <dt className="w-24 text-xs uppercase tracking-wider text-muted">
        {label}
      </dt>
      <dd className={`flex-1 ${mono ? "font-mono text-xs" : "text-sm"}`}>
        {value}
      </dd>
    </div>
  );
}

function OutputsPanel({
  outputs,
}: {
  outputs: NonNullable<RunStatus["outputs"]>;
}) {
  return (
    <section className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-emerald-300">
        Deliverables
      </h2>
      <div className="flex flex-wrap gap-3">
        {outputs.site_url ? (
          <a
            href={outputs.site_url}
            target="_blank"
            rel="noreferrer"
            className="btn-primary"
          >
            Open contractor site →
          </a>
        ) : null}
        {outputs.sales_walkthrough_url ? (
          <a
            href={outputs.sales_walkthrough_url}
            target="_blank"
            rel="noreferrer"
            className="btn-secondary"
          >
            Open sales walkthrough →
          </a>
        ) : null}
        {outputs.proposal_pdf_path ? (
          <span className="text-xs text-muted self-center font-mono">
            Proposal: {outputs.proposal_pdf_path}
          </span>
        ) : null}
      </div>
    </section>
  );
}

function HaltPanel({ run }: { run: RunStatus }) {
  return (
    <section className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-5">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-rose-300">
        Halted at phase {run.halt_phase ?? "—"}
      </h2>
      <p className="text-sm text-ink">
        {run.halt_reason ?? "No reason recorded."}
      </p>
      <p className="mt-3 text-xs text-muted">
        Suggested next: open <span className="font-mono">clients/{run.slug ?? "{slug}"}/halt.md</span> on the worker
        and run <span className="font-mono">resume {run.slug ?? "{slug}"}</span> in Claude Code.
      </p>
    </section>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
