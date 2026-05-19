"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface Props {
  runId: string;
  isActive: boolean;
}

// Clean up Claude Code's verbose output into readable lines
function cleanLine(line: string): { text: string; type: "tool" | "text" | "system" | "skip" } | null {
  const t = line.trim();
  if (!t) return null;

  // Skip noisy internal lines
  if (t.startsWith("⎿") || t.startsWith("↳") || t.match(/^\s*\d+\s*$/)) return null;
  if (t.includes("TokenUsage") || t.includes("input_tokens") || t.includes("cache_")) return null;
  if (t.startsWith("Using model") || t.startsWith("Claude Code")) return null;

  // Tool use lines
  if (t.startsWith("●") || t.startsWith("✓") || t.startsWith("→") || t.startsWith("•")) {
    return { text: t, type: "tool" };
  }

  // File operations
  if (t.match(/\b(read|write|create|edit|bash|grep|find|git|curl|fetch|python)\b/i) && t.length < 200) {
    return { text: t, type: "tool" };
  }

  // Skip very long lines (raw HTML/JSON dumps)
  if (t.length > 300) return null;

  return { text: t, type: "text" };
}

export function LiveLog({ runId, isActive }: Props) {
  const [lines, setLines] = useState<string[]>([]);
  const [logAvailable, setLogAvailable] = useState(false);
  const [lastCount, setLastCount] = useState(0);
  const logRef = useRef<HTMLDivElement>(null);

  const fetchLog = useCallback(async () => {
    try {
      const res = await fetch(`/api/runs/${runId}/log`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setLogAvailable(data.log_available);
      if (data.lines?.length) {
        setLines(data.lines);
        setLastCount(data.lines.length);
      }
    } catch { /* ignore */ }
  }, [runId]);

  useEffect(() => { fetchLog(); }, [fetchLog]);

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(fetchLog, 5000);
    return () => clearInterval(interval);
  }, [isActive, fetchLog]);

  // Auto-scroll to bottom when new lines arrive
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [lines]);

  if (!logAvailable) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted">
        {isActive ? (
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
            Claude Code is working — log will appear shortly…
          </span>
        ) : (
          <span>No log available.</span>
        )}
      </div>
    );
  }

  const displayLines = lines
    .map(cleanLine)
    .filter((l): l is NonNullable<ReturnType<typeof cleanLine>> => l !== null && l.type !== "skip");

  return (
    <div ref={logRef} className="h-full overflow-y-auto font-mono text-[11px] leading-relaxed p-3 space-y-0.5">
      {displayLines.map((line, i) => (
        <div
          key={i}
          className={`${
            line.type === "tool" ? "text-accent-light" :
            line.text.toLowerCase().includes("error") || line.text.toLowerCase().includes("fail") ? "text-rose-300" :
            line.text.toLowerCase().includes("complet") || line.text.toLowerCase().includes("success") || line.text.includes("✓") ? "text-emerald-300" :
            "text-muted"
          }`}
        >
          {line.text}
        </div>
      ))}
      {isActive && (
        <div className="flex items-center gap-1.5 text-accent-light pt-1">
          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
          <span>running…</span>
        </div>
      )}
    </div>
  );
}
