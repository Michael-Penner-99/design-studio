import type { RunStatus, PhaseStatus } from "../lib/schemas";
import { PHASE_NAMES } from "../lib/schemas";

interface Props {
  run: RunStatus;
}

const PHASE_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8"] as const;

export function PhaseStepper({ run }: Props) {
  const phases = run.phases ?? {};
  return (
    <ol className="space-y-2">
      {PHASE_KEYS.map((key) => {
        const p: PhaseStatus = phases[key] ?? {
          name: PHASE_NAMES[key],
          status: "pending",
        };
        return <PhaseRow key={key} index={key} phase={p} />;
      })}
    </ol>
  );
}

function PhaseRow({ index, phase }: { index: string; phase: PhaseStatus }) {
  const styles: Record<PhaseStatus["status"], string> = {
    pending: "border-white/10 bg-surface text-muted",
    running: "border-accent/60 bg-accent/10 text-ink",
    completed: "border-emerald-500/40 bg-emerald-500/5 text-ink",
    halted: "border-rose-500/40 bg-rose-500/5 text-ink",
  };
  const dot: Record<PhaseStatus["status"], string> = {
    pending: "bg-white/15",
    running: "bg-accent animate-pulse",
    completed: "bg-emerald-400",
    halted: "bg-rose-400",
  };
  return (
    <li className={`flex items-center gap-4 rounded-md border px-4 py-3 ${styles[phase.status]}`}>
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-bold ${dot[phase.status]}`}
        aria-hidden
      >
        <span className="text-bg">{index}</span>
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold">
            {phase.name ?? PHASE_NAMES[index]}
          </span>
          <span className="text-[11px] uppercase tracking-wider text-muted">
            {phase.status}
          </span>
        </div>
        <div className="mt-0.5 text-[11px] text-muted">
          {formatRange(phase.started_at, phase.completed_at)}
        </div>
      </div>
    </li>
  );
}

function formatRange(start?: string | null, end?: string | null): string {
  if (!start && !end) return "—";
  if (start && end) return `${fmt(start)} → ${fmt(end)}`;
  if (start) return `started ${fmt(start)}`;
  return `ended ${fmt(end!)}`;
}

function fmt(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
