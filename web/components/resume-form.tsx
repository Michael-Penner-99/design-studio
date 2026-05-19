"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RunStatus } from "../lib/schemas";

interface Props {
  run: RunStatus;
  formToken: string;
}

export function ResumeForm({ run, formToken }: Props) {
  const router = useRouter();
  const [reviewsText, setReviewsText] = useState("");
  const [notes, setNotes] = useState("");
  const [state, setState] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const haltPhase = run.halt_phase ?? 2;
  const needsReviews = run.halt_reason?.toLowerCase().includes("review");
  const needsPhotos = run.halt_reason?.toLowerCase().includes("photo");

  async function handleSubmit() {
    setState("submitting");
    setErrorMsg("");
    try {
      const res = await fetch(`/api/runs/${run.run_id}/resume`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-form-token": formToken,
        },
        body: JSON.stringify({ reviews_text: reviewsText, notes }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Unknown error");
      }
      setState("done");
      // Refresh the page after 2s so the status updates
      setTimeout(() => router.refresh(), 2000);
    } catch (err) {
      setState("error");
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-5">
        <p className="text-sm font-semibold text-emerald-300">
          ✓ Re-queued from phase {haltPhase}
        </p>
        <p className="mt-1 text-xs text-muted">
          The worker will pick this up within 30 seconds and resume the pipeline.
          This page will refresh automatically.
        </p>
      </div>
    );
  }

  return (
    <section className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-5 space-y-5">
      {/* Halt reason */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-rose-300 mb-2">
          Halted at phase {haltPhase} — operator input required
        </h2>
        <p className="text-sm text-ink leading-relaxed">
          {run.halt_reason ?? "No reason recorded."}
        </p>
      </div>

      <hr className="border-white/10" />

      {/* What's needed */}
      <div className="text-xs text-muted space-y-1">
        <p className="font-semibold text-ink text-sm">What you can provide to resume:</p>
        {needsReviews && (
          <p>• <span className="text-rose-300">Reviews</span> — paste 10+ real customer reviews below (Google, Facebook, texts, emails)</p>
        )}
        {needsPhotos && (
          <p>• <span className="text-rose-300">Photos</span> — after resuming, manually copy project photos into <span className="font-mono">clients/{run.slug}/assets/raw/</span> on your Mac before the worker picks up</p>
        )}
        <p>• <span className="text-muted">Notes</span> — any other context for the orchestrator</p>
      </div>

      {/* Reviews textarea */}
      {needsReviews && (
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted">
            Customer reviews <span className="text-rose-400">*</span>
          </label>
          <textarea
            value={reviewsText}
            onChange={(e) => setReviewsText(e.target.value)}
            placeholder={`Paste reviews here — one per paragraph is fine.\n\nExample:\n"Great work on our boiler install, very professional." — John S., Google\n"Fixed our radiant heat system quickly and for a fair price." — Mary T., Facebook`}
            rows={10}
            className="w-full rounded-md border border-white/15 bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted/50 focus:border-accent/60 focus:outline-none resize-y font-mono"
          />
          <p className="text-[11px] text-muted">
            These will be written to <span className="font-mono">clients/{run.slug}/evidence/reviews-raw.txt</span> and the pipeline will resume from phase {haltPhase}.
          </p>
        </div>
      )}

      {/* Notes textarea */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted">
          Operator notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any extra context for the orchestrator — e.g. 'owner confirmed they have 3 job photos in assets/raw already' or 'skip the review count gate, client approved placeholder mode'"
          rows={3}
          className="w-full rounded-md border border-white/15 bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted/50 focus:border-accent/60 focus:outline-none resize-y"
        />
      </div>

      {/* Error */}
      {state === "error" && (
        <p className="text-sm text-rose-300">{errorMsg}</p>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={state === "submitting" || (needsReviews && !reviewsText.trim())}
        className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {state === "submitting"
          ? "Committing…"
          : `Resume from phase ${haltPhase}`}
      </button>
    </section>
  );
}
