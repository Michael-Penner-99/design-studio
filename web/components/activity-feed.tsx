"use client";

import { useEffect, useState } from "react";
import type { ActivityEntry } from "../lib/github";

interface Props {
  runId: string;
  slug: string | null;
  isActive: boolean; // poll only when running/queued
}

// Map commit message prefixes to readable labels + icons
function parseCommit(message: string): { icon: string; label: string; detail: string } {
  const m = message.toLowerCase();

  if (m.includes("phase 1") || m.includes("discovery")) return { icon: "🔍", label: "Discovery", detail: message };
  if (m.includes("phase 2") || m.includes("capture") || m.includes("asset")) return { icon: "📸", label: "Capture", detail: message };
  if (m.includes("phase 3") || m.includes("brand")) return { icon: "🎨", label: "Brand DNA", detail: message };
  if (m.includes("phase 4") || m.includes("strategy") || m.includes("copy") || m.includes("seo") || m.includes("keyword")) return { icon: "📐", label: "Strategy", detail: message };
  if (m.includes("phase 5") || m.includes("build") || m.includes("site/")) return { icon: "🔨", label: "Build", detail: message };
  if (m.includes("phase 6") || m.includes("qa") || m.includes("quality")) return { icon: "✅", label: "Quality", detail: message };
  if (m.includes("phase 7") || m.includes("proposal") || m.includes("sales")) return { icon: "📋", label: "Sales-Ready", detail: message };
  if (m.includes("phase 8") || m.includes("deploy")) return { icon: "🚀", label: "Deploy", detail: message };
  if (m.includes("halt")) return { icon: "🛑", label: "Halted", detail: message };
  if (m.includes("resume")) return { icon: "▶️", label: "Resumed", detail: message };
  if (m.includes("queue") || m.includes("submit")) return { icon: "📥", label: "Queued", detail: message };
  if (m.includes("worker")) return { icon: "⚙️", label: "Worker", detail: message };

  return { icon: "📝", label: "Update", detail: message };
}

function timeAgo(iso: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function ActivityFeed({ runId, isActive }: Props) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  async function fetchActivity() {
    try {
      const res = await fetch(`/api/runs/${runId}/activity`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setEntries(data.activity ?? []);
      setLastUpdated(new Date());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchActivity();
  }, [runId]);

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(fetchActivity, 20_000);
    return () => clearInterval(interval);
  }, [isActive, runId]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
          Activity
        </h2>
        <div className="flex items-center gap-2">
          {isActive && (
            <span className="flex items-center gap-1 text-[11px] text-accent-light">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
              live
            </span>
          )}
          {lastUpdated && (
            <span className="text-[11px] text-muted">
              {timeAgo(lastUpdated.toISOString())}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1 max-h-[600px] pr-1">
        {loading ? (
          <div className="space-y-2 animate-pulse">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 rounded-md bg-white/5" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <p className="text-xs text-muted py-4 text-center">
            No activity yet — worker picks up within 30s
          </p>
        ) : (
          entries.map((entry, i) => {
            const { icon, label, detail } = parseCommit(entry.message);
            const isFirst = i === 0;
            return (
              <div
                key={entry.sha}
                className={`group flex gap-3 rounded-md px-3 py-2.5 transition-colors ${
                  isFirst && isActive
                    ? "border border-accent/30 bg-accent/5"
                    : "hover:bg-white/5"
                }`}
              >
                <span className="mt-0.5 text-base shrink-0">{icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={`text-xs font-semibold ${isFirst && isActive ? "text-accent-light" : "text-ink"}`}>
                      {label}
                    </span>
                    <span className="text-[10px] text-muted shrink-0 font-mono">
                      {timeAgo(entry.timestamp)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted leading-snug truncate" title={detail}>
                    {detail}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {isActive && (
        <p className="mt-3 text-center text-[11px] text-muted animate-pulse">
          Refreshing every 20 seconds…
        </p>
      )}
    </div>
  );
}
