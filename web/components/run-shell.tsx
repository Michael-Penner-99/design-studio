"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import type { RunStatus, PhaseStatus } from "../lib/schemas";
import { PHASE_NAMES } from "../lib/schemas";
import { LiveLog } from "./live-log";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActivityEntry {
  sha: string;
  message: string;
  timestamp: string;
}

interface Props {
  initialRun: RunStatus;
  formToken: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PHASE_KEYS = ["1","2","3","4","5","6","7","8"] as const;

const PHASE_ICONS: Record<string, string> = {
  "1": "🔍", "2": "📸", "3": "🎨", "4": "📐",
  "5": "🔨", "6": "✅", "7": "📋", "8": "🚀",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtTime(iso: string): string {
  try { return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }
  catch { return iso; }
}

function completedCount(phases: RunStatus["phases"]): number {
  return PHASE_KEYS.filter(k => phases?.[k]?.status === "completed").length;
}

function parseCommitLabel(msg: string): { icon: string; label: string } {
  const m = msg.toLowerCase();
  if (m.includes("phase 1") || m.includes("discovery") || m.includes("brief") || m.includes("research")) return { icon: "🔍", label: "Discovery" };
  if (m.includes("phase 2") || m.includes("capture") || m.includes("asset") || m.includes("review")) return { icon: "📸", label: "Capture" };
  if (m.includes("phase 3") || m.includes("brand") || m.includes("palette") || m.includes("typography")) return { icon: "🎨", label: "Brand DNA" };
  if (m.includes("phase 4") || m.includes("strategy") || m.includes("copy") || m.includes("seo") || m.includes("sitemap")) return { icon: "📐", label: "Strategy" };
  if (m.includes("phase 5") || m.includes("build") || m.includes("site/")) return { icon: "🔨", label: "Build" };
  if (m.includes("phase 6") || m.includes("qa") || m.includes("quality")) return { icon: "✅", label: "Quality" };
  if (m.includes("phase 7") || m.includes("proposal") || m.includes("sales")) return { icon: "📋", label: "Sales-Ready" };
  if (m.includes("phase 8") || m.includes("deploy")) return { icon: "🚀", label: "Deploy" };
  if (m.includes("halt")) return { icon: "🛑", label: "Halted" };
  if (m.includes("resume")) return { icon: "▶️", label: "Resumed" };
  if (m.includes("queue") || m.includes("submit")) return { icon: "📥", label: "Queued" };
  return { icon: "📝", label: "Update" };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: RunStatus["status"] }) {
  const map: Record<RunStatus["status"], string> = {
    queued:    "bg-yellow-500/15 text-yellow-300",
    running:   "bg-accent/20 text-accent-light",
    completed: "bg-emerald-500/15 text-emerald-300",
    halted:    "bg-rose-500/15 text-rose-300",
  };
  return (
    <span className={`tag ${map[status]}`}>
      {status === "running" && <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />}
      {status}
    </span>
  );
}

function PhaseSidebar({ run }: { run: RunStatus }) {
  const done = completedCount(run.phases ?? {});
  const pct = Math.round((done / 8) * 100);

  return (
    <aside className="flex flex-col gap-4 border-r border-white/10 bg-surface/50 p-4 overflow-y-auto">
      {/* Progress */}
      <div>
        <div className="flex items-center justify-between text-[11px] text-muted mb-1.5">
          <span>{done} of 8 phases</span>
          <span className="font-mono">{pct}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              run.status === "completed" ? "bg-emerald-400" :
              run.status === "halted" ? "bg-rose-400" : "bg-accent"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Phase list */}
      <ol className="space-y-0.5">
        {PHASE_KEYS.map(key => {
          const p: PhaseStatus = run.phases?.[key] ?? { name: PHASE_NAMES[key], status: "pending" };
          const isRunning = p.status === "running";
          const isDone = p.status === "completed";
          const isHalted = p.status === "halted";

          return (
            <li key={key} className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors ${
              isRunning ? "bg-accent/10 border border-accent/30" :
              isDone ? "opacity-80" : "opacity-50"
            }`}>
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                isDone ? "bg-emerald-400 text-black" :
                isHalted ? "bg-rose-400 text-white" :
                isRunning ? "bg-accent text-bg" :
                "bg-white/10 text-muted"
              }`}>
                {isDone ? "✓" : isHalted ? "✕" : key}
              </span>
              <div className="min-w-0 flex-1">
                <div className={`text-xs font-medium truncate ${isRunning ? "text-ink" : isDone ? "text-ink" : "text-muted"}`}>
                  {PHASE_NAMES[key]}
                </div>
                {isRunning && (
                  <div className="text-[10px] text-accent-light flex items-center gap-1 mt-0.5">
                    <span className="inline-block h-1 w-1 rounded-full bg-accent animate-pulse" />
                    running
                  </div>
                )}
                {p.started_at && p.completed_at && (
                  <div className="text-[10px] text-muted mt-0.5">
                    {Math.round((new Date(p.completed_at).getTime() - new Date(p.started_at).getTime()) / 60000)}m
                  </div>
                )}
              </div>
              {isRunning && <span className="text-base animate-spin" style={{ animationDuration: "3s" }}>❄</span>}
            </li>
          );
        })}
      </ol>

      {/* Spec */}
      <div className="border-t border-white/10 pt-3 space-y-1">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-2">Spec</div>
        {[
          ["mode", run.mode],
          run.slug ? ["slug", run.slug] : null,
          run.url ? ["url", run.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")] : null,
          run.business_name ? ["biz", run.business_name] : null,
          ["started", fmtTime(run.started_at)],
          run.updated_at ? ["updated", fmtTime(run.updated_at)] : null,
        ].filter((x): x is string[] => Array.isArray(x)).map(([k, v]) => (
          <div key={k} className="flex gap-2 text-[11px]">
            <span className="w-12 shrink-0 text-muted">{k}</span>
            <span className="text-ink truncate font-mono">{v}</span>
          </div>
        ))}
      </div>

      {/* Outputs */}
      {run.status === "completed" && run.outputs?.site_url && (
        <div className="border-t border-white/10 pt-3 space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-2">Deliverables</div>
          <a href={run.outputs.site_url} target="_blank" rel="noreferrer" className="btn-primary text-xs w-full justify-center">
            Open site →
          </a>
          {run.outputs.sales_walkthrough_url && (
            <a href={run.outputs.sales_walkthrough_url} target="_blank" rel="noreferrer" className="btn-secondary text-xs w-full justify-center">
              Sales walkthrough →
            </a>
          )}
        </div>
      )}
    </aside>
  );
}

function ActivityMessage({ entry, isLatest, isActive }: {
  entry: ActivityEntry;
  isLatest: boolean;
  isActive: boolean;
}) {
  const { icon, label } = parseCommitLabel(entry.message);
  return (
    <div className={`flex gap-3 rounded-lg px-3 py-2.5 transition-colors ${
      isLatest && isActive ? "bg-accent/5 border border-accent/20" : "hover:bg-white/5"
    }`}>
      <span className="text-base mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2 mb-0.5">
          <span className={`text-xs font-semibold ${isLatest && isActive ? "text-accent-light" : "text-ink"}`}>
            {label}
          </span>
          <span className="text-[10px] text-muted shrink-0 font-mono">{timeAgo(entry.timestamp)}</span>
        </div>
        <p className="text-[11px] text-muted leading-snug line-clamp-2" title={entry.message}>
          {entry.message}
        </p>
      </div>
    </div>
  );
}

function OperatorMessage({ text, time }: { text: string; time: string }) {
  return (
    <div className="flex gap-3 rounded-lg px-3 py-2.5 bg-white/5">
      <div className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-accent/20 flex items-center justify-center text-[10px] text-accent-light font-bold">
        You
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2 mb-0.5">
          <span className="text-xs font-semibold text-accent-light">Operator note</span>
          <span className="text-[10px] text-muted shrink-0">{time}</span>
        </div>
        <p className="text-[11px] text-muted leading-snug">{text}</p>
        <p className="text-[10px] text-muted/50 mt-1">Committed to operator-notes.md · picked up next tick</p>
      </div>
    </div>
  );
}

// ─── Main shell ───────────────────────────────────────────────────────────────

export function RunShell({ initialRun, formToken }: Props) {
  const [run, setRun] = useState<RunStatus>(initialRun);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [operatorMsgs, setOperatorMsgs] = useState<{ text: string; time: string }[]>([]);
  const [prompt, setPrompt] = useState("");
  const [sending, setSending] = useState(false);
  const [resumeText, setResumeText] = useState("");
  const [resumeSending, setResumeSending] = useState(false);
  const [resumeDone, setResumeDone] = useState(false);
  const [activeTab, setActiveTab] = useState<"log" | "activity">("log");
  const feedRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isActive = run.status === "running" || run.status === "queued";

  const fetchRun = useCallback(async () => {
    try {
      const res = await fetch(`/api/runs/${run.run_id}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.run) setRun(data.run);
    } catch { /* ignore */ }
  }, [run.run_id]);

  const fetchActivity = useCallback(async () => {
    try {
      const res = await fetch(`/api/runs/${run.run_id}/activity`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setActivity(data.activity ?? []);
    } catch { /* ignore */ }
  }, [run.run_id]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  useEffect(() => {
    if (!isActive) return;
    const ri = setInterval(fetchRun, 15000);
    const ai = setInterval(fetchActivity, 20000);
    return () => { clearInterval(ri); clearInterval(ai); };
  }, [isActive, fetchRun, fetchActivity]);

  // Scroll feed to bottom when activity updates
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [activity, operatorMsgs]);

  async function sendOperatorNote() {
    const text = prompt.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await fetch(`/api/runs/${run.run_id}/note`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-form-token": formToken },
        body: JSON.stringify({ note: text }),
      });
      setOperatorMsgs(prev => [...prev, { text, time: "just now" }]);
      setPrompt("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    } catch { /* ignore */ }
    setSending(false);
  }

  async function handleResume() {
    setResumeSending(true);
    try {
      const res = await fetch(`/api/runs/${run.run_id}/resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-form-token": formToken },
        body: JSON.stringify({ reviews_text: resumeText, notes: "" }),
      });
      if (res.ok) {
        setResumeDone(true);
        setTimeout(fetchRun, 3000);
      }
    } catch { /* ignore */ }
    setResumeSending(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendOperatorNote(); }
  }

  const title = run.business_name ?? run.url ?? run.slug ?? run.run_id;
  const needsReviews = run.halt_reason?.toLowerCase().includes("review");

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 120px)", minHeight: "600px" }}>
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4 mb-4 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/runs" className="text-xs text-muted hover:text-ink shrink-0">← runs</Link>
          <span className="text-muted">/</span>
          <h1 className="text-sm font-semibold text-ink truncate">{title}</h1>
          <StatusBadge status={run.status} />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-mono text-[10px] text-muted hidden md:block">{run.run_id}</span>
          <button onClick={() => { fetchRun(); fetchActivity(); }} className="btn-secondary text-xs py-1 px-2">
            ↻ refresh
          </button>
        </div>
      </div>

      {/* Main layout: sidebar + feed */}
      <div className="flex flex-1 gap-0 overflow-hidden rounded-lg border border-white/10">
        {/* Sidebar */}
        <div className="w-56 shrink-0 flex flex-col overflow-hidden">
          <PhaseSidebar run={run} />
        </div>

        {/* Feed + prompt */}
        <div className="flex flex-1 flex-col overflow-hidden bg-bg">

          {/* Halt banner */}
          {run.status === "halted" && !resumeDone && (
            <div className="flex-shrink-0 mx-4 mt-4 rounded-lg border border-rose-500/30 bg-rose-500/5 p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-rose-300 mb-1">
                Halted at phase {run.halt_phase ?? "?"} — input required
              </div>
              <p className="text-sm text-ink mb-3 leading-relaxed">{run.halt_reason ?? "No reason recorded."}</p>
              {needsReviews && (
                <textarea
                  value={resumeText}
                  onChange={e => setResumeText(e.target.value)}
                  placeholder="Paste 10+ customer reviews here (Google, Facebook, texts, emails)…"
                  rows={4}
                  className="field w-full text-xs font-mono mb-3"
                />
              )}
              <button
                onClick={handleResume}
                disabled={resumeSending || (needsReviews && !resumeText.trim())}
                className="btn-primary text-xs disabled:opacity-40"
              >
                {resumeSending ? "Re-queuing…" : `Resume from phase ${run.halt_phase ?? 2}`}
              </button>
            </div>
          )}
          {resumeDone && (
            <div className="flex-shrink-0 mx-4 mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-300">
              ✓ Re-queued — worker will pick up within 30 seconds
            </div>
          )}

          {/* Tabs */}
          <div className="flex-shrink-0 flex border-b border-white/10 px-4">
            {(["log", "activity"] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors -mb-px ${activeTab === tab ? "border-accent text-accent-light" : "border-transparent text-muted hover:text-ink"}`}>
                {tab === "log" ? <span className="flex items-center gap-1.5">{isActive && <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />}Live log</span>
                  : <span className="flex items-center gap-1.5">Commits{activity.length > 0 && <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px]">{activity.length}</span>}</span>}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-hidden">
            {activeTab === "log" ? <LiveLog runId={run.run_id} isActive={isActive} /> : (
          <div ref={feedRef} className="h-full overflow-y-auto p-4 space-y-1">
            {activity.length === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-muted">
                {isActive ? (
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
                    Worker picked up job — waiting for first commit…
                  </span>
                ) : "No activity yet."}
              </div>
            ) : (
              <>
                {activity.slice().reverse().map((entry, i) => (
                  <ActivityMessage
                    key={entry.sha}
                    entry={entry}
                    isLatest={i === activity.length - 1}
                    isActive={isActive}
                  />
                ))}
                {operatorMsgs.map((m, i) => (
                  <OperatorMessage key={i} text={m.text} time={m.time} />
                ))}
              </>
            )}
          </div>
            )}
          </div>

          {/* Prompt box */}
          <div className="flex-shrink-0 border-t border-white/10 p-3">
            <div className="flex items-end gap-2 rounded-lg border border-white/15 bg-surface px-3 py-2 focus-within:border-accent/50 transition-colors">
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={e => {
                  setPrompt(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = e.target.scrollHeight + "px";
                }}
                onKeyDown={handleKeyDown}
                placeholder="Add context, override a decision, or ask what's happening… (Enter to send)"
                rows={1}
                className="flex-1 bg-transparent text-sm text-ink placeholder:text-muted/50 resize-none outline-none max-h-32"
              />
              <button
                onClick={sendOperatorNote}
                disabled={sending || !prompt.trim()}
                className="shrink-0 h-7 w-7 rounded-full bg-accent flex items-center justify-center disabled:opacity-30 hover:bg-accent-light transition-colors"
                aria-label="Send"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 10V2M6 2L2 6M6 2L10 6" stroke="#0F172A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
            <p className="mt-1.5 text-[10px] text-muted/60 text-center">
              Notes commit to <span className="font-mono">clients/{run.slug ?? "…"}/operator-notes.md</span> · picked up on next worker tick
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
