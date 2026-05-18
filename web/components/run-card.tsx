import Link from "next/link";
import type { RunSummary } from "../lib/types";
import { PHASE_NAMES } from "../lib/schemas";

function StatusTag({ status }: { status: RunSummary["status"] }) {
  const styles: Record<RunSummary["status"], string> = {
    queued: "bg-white/10 text-muted",
    running: "bg-accent/20 text-accent-light",
    completed: "bg-emerald-500/15 text-emerald-300",
    halted: "bg-rose-500/15 text-rose-300",
  };
  return <span className={`tag ${styles[status]}`}>{status}</span>;
}

export function RunCard({ run }: { run: RunSummary }) {
  const label = run.business_name ?? run.url ?? run.slug ?? run.run_id;
  const phaseLabel =
    run.current_phase && PHASE_NAMES[String(run.current_phase)]
      ? `Phase ${run.current_phase} · ${PHASE_NAMES[String(run.current_phase)]}`
      : run.status === "queued"
      ? "Queued — awaiting worker"
      : "—";

  return (
    <Link
      href={`/runs/${run.run_id}`}
      className="block rounded-lg border border-white/10 bg-surface p-4 transition hover:border-white/25 hover:bg-surface/80"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-ink">{label}</div>
          <div className="mt-0.5 truncate font-mono text-[11px] text-muted">
            {run.run_id}
          </div>
        </div>
        <StatusTag status={run.status} />
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-muted">
        <span>{phaseLabel}</span>
        <span>{formatDate(run.started_at)}</span>
      </div>
    </Link>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
