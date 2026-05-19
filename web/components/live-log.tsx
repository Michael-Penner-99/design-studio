"use client";
import { useEffect, useRef, useState, useCallback } from "react";
interface Props { runId: string; isActive: boolean; }
function cleanLine(line: string): { text: string; type: string } | null {
  const t = line.trim();
  if (!t) return null;
  if (t.startsWith("⎿") || t.startsWith("↳") || t.match(/^\s*\d+\s*$/)) return null;
  if (t.includes("TokenUsage") || t.includes("input_tokens") || t.includes("cache_")) return null;
  if (t.startsWith("Using model") || t.startsWith("Claude Code")) return null;
  if (t.length > 300) return null;
  if (t.startsWith("●") || t.startsWith("✓") || t.startsWith("→") || t.startsWith("•")) return { text: t, type: "tool" };
  if (t.match(/\b(read|write|create|edit|bash|grep|find|git|curl|fetch|python)\b/i) && t.length < 200) return { text: t, type: "tool" };
  return { text: t, type: "text" };
}
export function LiveLog({ runId, isActive }: Props) {
  const [lines, setLines] = useState<string[]>([]);
  const [logAvailable, setLogAvailable] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const fetchLog = useCallback(async () => {
    try {
      const res = await fetch(`/api/runs/${runId}/log`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setLogAvailable(data.log_available);
      if (data.lines?.length) setLines(data.lines);
    } catch {}
  }, [runId]);
  useEffect(() => { fetchLog(); }, [fetchLog]);
  useEffect(() => {
    if (!isActive) return;
    const i = setInterval(fetchLog, 5000);
    return () => clearInterval(i);
  }, [isActive, fetchLog]);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [lines]);
  if (!logAvailable) return (
    <div className="flex items-center justify-center h-full text-sm text-muted">
      {isActive ? <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-accent animate-pulse" />Claude Code is working — log appears after next worker tick…</span> : <span>No log available.</span>}
    </div>
  );
  const display = lines.map(cleanLine).filter((l): l is NonNullable<ReturnType<typeof cleanLine>> => l !== null);
  return (
    <div ref={logRef} className="h-full overflow-y-auto font-mono text-[11px] leading-relaxed p-3 space-y-0.5">
      {display.map((line, i) => (
        <div key={i} className={line.type === "tool" ? "text-accent-light" : line.text.toLowerCase().includes("error") || line.text.toLowerCase().includes("fail") ? "text-rose-300" : line.text.toLowerCase().includes("complet") || line.text.includes("✓") ? "text-emerald-300" : "text-muted"}>{line.text}</div>
      ))}
      {isActive && <div className="flex items-center gap-1.5 text-accent-light pt-1"><span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" /><span>running…</span></div>}
    </div>
  );
}
