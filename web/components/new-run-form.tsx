"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Tab = "url" | "name";

const TRADE_OPTIONS = [
  { value: "roofing", label: "Roofing" },
  { value: "hvac", label: "HVAC" },
  { value: "plumbing", label: "Plumbing" },
  { value: "electrical", label: "Electrical" },
  { value: "exteriors", label: "Exteriors" },
  { value: "remodel", label: "Remodel" },
] as const;

interface Props {
  submitToken: string;
}

export function NewRunForm({ submitToken }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("url");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // URL tab state
  const [url, setUrl] = useState("");
  const [urlNotes, setUrlNotes] = useState("");

  // Name tab state
  const [businessName, setBusinessName] = useState("");
  const [tradeHint, setTradeHint] = useState<string>("roofing");
  const [primaryCity, setPrimaryCity] = useState("");
  const [reviewsText, setReviewsText] = useState("");
  const [nameNotes, setNameNotes] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    let body: Record<string, unknown>;
    if (tab === "url") {
      body = {
        mode: "url",
        url: url.trim(),
        manual_notes: urlNotes.trim() || undefined,
      };
    } else {
      body = {
        mode: "name-and-reviews",
        business_name: businessName.trim(),
        trade_hint: tradeHint,
        primary_city: primaryCity.trim(),
        reviews_text: reviewsText.trim(),
        manual_notes: nameNotes.trim() || undefined,
      };
    }

    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-form-token": submitToken,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          details?: unknown;
        };
        throw new Error(
          data.error || `Request failed (${res.status})`,
        );
      }
      const data = (await res.json()) as { run_id: string };
      router.push(`/runs/${data.run_id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="card">
      <div className="mb-5 flex gap-1 rounded-md bg-bg p-1">
        <TabButton active={tab === "url"} onClick={() => setTab("url")}>
          From URL
        </TabButton>
        <TabButton active={tab === "name"} onClick={() => setTab("name")}>
          From business name
        </TabButton>
      </div>

      <form onSubmit={submit} className="space-y-4">
        {tab === "url" ? (
          <>
            <div>
              <label className="label" htmlFor="url">
                Contractor URL
              </label>
              <input
                id="url"
                type="url"
                required
                placeholder="https://example-contractor.com"
                className="field"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="url-notes">
                Manual notes (optional)
              </label>
              <textarea
                id="url-notes"
                rows={4}
                placeholder="Anything the discovery agent should know before scraping."
                className="field"
                value={urlNotes}
                onChange={(e) => setUrlNotes(e.target.value)}
              />
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="label" htmlFor="business_name">
                  Business name
                </label>
                <input
                  id="business_name"
                  type="text"
                  required
                  placeholder="Example HVAC"
                  className="field"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="trade_hint">
                  Trade
                </label>
                <select
                  id="trade_hint"
                  className="field"
                  value={tradeHint}
                  onChange={(e) => setTradeHint(e.target.value)}
                >
                  {TRADE_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="label" htmlFor="primary_city">
                Primary city
              </label>
              <input
                id="primary_city"
                type="text"
                required
                placeholder="Kansas City, MO"
                className="field"
                value={primaryCity}
                onChange={(e) => setPrimaryCity(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="reviews_text">
                Reviews
              </label>
              <textarea
                id="reviews_text"
                rows={8}
                required
                placeholder="Paste each review on its own line. Format: 'Customer Name — 5 stars — Review text...'"
                className="field font-mono text-xs"
                value={reviewsText}
                onChange={(e) => setReviewsText(e.target.value)}
              />
              <p className="mt-1 text-[11px] text-muted">
                One review per line. Format: <span className="font-mono">Name — 5 stars — Text</span>
              </p>
            </div>
            <div>
              <label className="label" htmlFor="name-notes">
                Manual notes (optional)
              </label>
              <textarea
                id="name-notes"
                rows={3}
                placeholder="Anything else the strategist should weigh in on."
                className="field"
                value={nameNotes}
                onChange={(e) => setNameNotes(e.target.value)}
              />
            </div>
          </>
        )}

        {error && (
          <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-2">
          <p className="text-xs text-muted">
            Submitting writes <span className="font-mono">queue/&#123;run-id&#125;.json</span> to GitHub. The local worker
            picks it up within 30 seconds.
          </p>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? "Queueing…" : "Start run"}
          </button>
        </div>
      </form>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold transition ${
        active
          ? "bg-surface text-ink shadow"
          : "text-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
