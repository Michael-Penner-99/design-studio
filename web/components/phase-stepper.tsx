"use client";

import { useEffect, useState } from "react";
import type { RunStatus, PhaseStatus } from "../lib/schemas";
import { PHASE_NAMES } from "../lib/schemas";

interface Props {
  run: RunStatus;
  /** If true, poll /api/runs/{run_id} every 15s and update phases live */
  poll?: boolean;
}

const PHASE_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8"] as const;

// How many phases are done given a run status object
function completedCount(phases: RunStatus["phases"]): number {
  return PHASE_KEYS.filter((k) => phases?.[k]?.status === "completed").length;
}

export function PhaseStepper({ run: initialRun, poll = false }: Props) {
  const [run, setRun] = useState<RunStatus>(initialRun);

  useEffect(() => {
    if (!poll) return;
    if (run.status !== "running" && run.status !== "queued") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/runs/${run.run_id}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (data.run) setRun(data.run);
      } catch {
        // silently ignore — will retry
      }
    }, 15_000);

    return () => clearInterval(interval);
  }, [poll, run.run_id, run.status]);

  const phases = run.phases ?? {};
  const done = completedCount(phases);
  const total = 8;
  const pct = Math.round((done / total) * 100);
  const isActive = run.status === "running" || run.status === "queued";

  return (
    <div className="space-y-4">
      {/* Overall progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted">
          <span>{done} of {total} phases complete</span>
          <span className="font-mono">{pct}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${
              run.status === "completed"
                ? "bg-emerald-400"
                : run.status === "halted"
                ? "bg-rose-400"
                : "bg-accent"
            } ${isActive && pct < 100 ? "progress-shimmer" : ""}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Per-phase rows */}
      <ol className="space-y-2">
        {PHASE_KEYS.map((key) => {
          const p: PhaseStatus = phases[key] ?? {
            name: PHASE_NAMES[key],
            status: "pending",
          };
          return <PhaseRow key={key} index={key} phase={p} />;
        })}
      </ol>

      {isActive && (
        <p className="text-center text-xs text-muted animate-pulse">
          Auto-refreshing every 15 seconds…
        </p>
      )}
    </div>
  );
}

function PhaseRow({ index, phase }: { index: string; phase: PhaseStatus }) {
  const containerStyles: Record<PhaseStatus["status"], string> = {
    pending: "border-white/10 bg-surface text-muted",
    running: "border-accent/60 bg-accent/10 text-ink",
    completed: "border-emerald-500/40 bg-emerald-500/5 text-ink",
    halted: "border-rose-500/40 bg-rose-500/5 text-ink",
  };

  const dotBg: Record<PhaseStatus["status"], string> = {
    pending: "bg-white/15 text-muted",
    running: "bg-accent text-white animate-pulse",
    completed: "bg-emerald-400 text-black",
    halted: "bg-rose-400 text-white",
  };

  const icon: Record<PhaseStatus["status"], string> = {
    pending: index,
    running: index,
    completed: "✓",
    halted: "✕",
  };

  return (
    <li className={`rounded-md border px-4 py-3 transition-all duration-500 ${containerStyles[phase.status]}`}>
      <div className="flex items-center gap-4">
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-bold transition-all duration-300 ${dotBg[phase.status]}`}
        >
          {icon[phase.status]}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold">
              {phase.name ?? PHASE_NAMES[index]}
            </span>
            <span className={`text-[11px] uppercase tracking-wider font-mono ${
              phase.status === "running" ? "text-accent-light" :
              phase.status === "completed" ? "text-emerald-400" :
              phase.status === "halted" ? "text-rose-400" :
              "text-muted"
            }`}>
              {phase.status}
            </span>
          </div>
          {(phase.started_at || phase.completed_at) && (
            <div className="mt-0.5 text-[11px] text-muted">
              {formatRange(phase.started_at, phase.completed_at)}
            </div>
          )}
          {/* Running phase bar */}
          {phase.status === "running" && (
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-full rounded-full bg-accent/60 progress-shimmer" />
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function formatRange(start?: string | null, end?: string | null): string {
  if (!start && !end) return "";
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
