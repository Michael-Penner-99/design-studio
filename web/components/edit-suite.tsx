"use client";

import { useState, useRef, useEffect } from "react";

interface EditMessage {
  role: "operator" | "claude";
  text: string;
  timestamp: string;
  files?: string[]; // files touched
  redeployed?: boolean;
}

interface Props {
  slug: string;
  runId: string;
  formToken: string;
  siteUrl: string | null;
}

export function EditSuite({ slug, runId, formToken, siteUrl }: Props) {
  const [messages, setMessages] = useState<EditMessage[]>([
    {
      role: "claude",
      text: `Site editor ready for **${slug}**. Tell me what you want changed — copy, colors, layout, photos, anything. I'll edit the files and redeploy automatically.\n\nExamples:\n• "Change the hero headline to 'Saskatchewan's Most Trusted Radon Team'"\n• "Add a testimonial from John Smith: 5 stars, great service"\n• "Make the CTA button red instead of gold"\n• "Add a new service: Indoor Air Quality Testing"`,
      timestamp: new Date().toISOString(),
    }
  ]);
  const [prompt, setPrompt] = useState("");
  const [sending, setSending] = useState(false);
  const [redeploy, setRedeploy] = useState(true);
  const feedRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [messages]);

  async function sendEdit() {
    const text = prompt.trim();
    if (!text || sending) return;
    setSending(true);
    setPrompt("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const userMsg: EditMessage = {
      role: "operator",
      text,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);

    // Add thinking indicator
    const thinkingMsg: EditMessage = {
      role: "claude",
      text: "Working on it…",
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, thinkingMsg]);

    try {
      const res = await fetch(`/api/runs/${runId}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-form-token": formToken },
        body: JSON.stringify({ slug, prompt: text, redeploy }),
      });
      const data = await res.json();

      // Replace thinking message with real response
      setMessages(prev => [
        ...prev.slice(0, -1),
        {
          role: "claude",
          text: data.result ?? data.error ?? "Done.",
          timestamp: new Date().toISOString(),
          files: data.files_changed ?? [],
          redeployed: data.redeployed ?? false,
        }
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev.slice(0, -1),
        {
          role: "claude",
          text: `Error: ${err instanceof Error ? err.message : String(err)}`,
          timestamp: new Date().toISOString(),
        }
      ]);
    }
    setSending(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendEdit(); }
  }

  function fmt(iso: string) {
    return new Date(iso).toLocaleString("en-US", { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">Edit Suite</span>
          <span className="font-mono text-xs text-muted">→ {slug}</span>
        </div>
        <div className="flex items-center gap-3">
          {siteUrl && (
            <a href={siteUrl} target="_blank" rel="noreferrer"
              className="text-xs text-accent-light hover:text-accent transition-colors">
              View live site ↗
            </a>
          )}
          <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={redeploy}
              onChange={e => setRedeploy(e.target.checked)}
              className="accent-accent"
            />
            Auto-redeploy
          </label>
        </div>
      </div>

      {/* Message feed */}
      <div ref={feedRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === "operator" ? "flex-row-reverse" : ""}`}>
            <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${
              msg.role === "claude" ? "bg-accent/20 text-accent-light" : "bg-white/10 text-muted"
            }`}>
              {msg.role === "claude" ? "AI" : "You"}
            </div>
            <div className={`max-w-[80%] ${msg.role === "operator" ? "items-end" : "items-start"} flex flex-col gap-1`}>
              <div className={`rounded-lg px-3 py-2.5 text-sm leading-relaxed ${
                msg.role === "claude"
                  ? "bg-surface border border-white/10 text-ink"
                  : "bg-accent/15 border border-accent/20 text-ink"
              }`}>
                {msg.text === "Working on it…" ? (
                  <span className="flex items-center gap-2 text-muted">
                    <span className="flex gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-accent animate-bounce" style={{animationDelay:"0ms"}}/>
                      <span className="h-1.5 w-1.5 rounded-full bg-accent animate-bounce" style={{animationDelay:"150ms"}}/>
                      <span className="h-1.5 w-1.5 rounded-full bg-accent animate-bounce" style={{animationDelay:"300ms"}}/>
                    </span>
                    Working on it…
                  </span>
                ) : (
                  <pre className="whitespace-pre-wrap font-sans">{msg.text}</pre>
                )}
              </div>
              {msg.files && msg.files.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {msg.files.map(f => (
                    <span key={f} className="font-mono text-[10px] bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-muted">
                      {f}
                    </span>
                  ))}
                </div>
              )}
              {msg.redeployed && (
                <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                  <span>✓</span> Redeployed to {siteUrl}
                </span>
              )}
              <span className="text-[10px] text-muted">{fmt(msg.timestamp)}</span>
            </div>
          </div>
        ))}
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
            placeholder="Describe what you want changed… (Enter to send, Shift+Enter for new line)"
            rows={1}
            disabled={sending}
            className="flex-1 bg-transparent text-sm text-ink placeholder:text-muted/50 resize-none outline-none max-h-40 disabled:opacity-50"
          />
          <button
            onClick={sendEdit}
            disabled={sending || !prompt.trim()}
            className="shrink-0 h-7 w-7 rounded-full bg-accent flex items-center justify-center disabled:opacity-30 hover:bg-accent-light transition-colors"
            aria-label="Send edit"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 10V2M6 2L2 6M6 2L10 6" stroke="#0F172A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
        <p className="mt-1.5 text-[10px] text-muted/60 text-center">
          Edits go to <span className="font-mono">clients/{slug}/site/</span> · Claude makes the changes · auto-redeploys if checked
        </p>
      </div>
    </div>
  );
}
