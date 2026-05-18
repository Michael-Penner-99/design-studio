import Link from "next/link";
import { listRuns } from "../../lib/github";
import { PHASE_NAMES } from "../../lib/schemas";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RunsPage() {
  let runs: Awaited<ReturnType<typeof listRuns>> = [];
  let error: string | null = null;
  try {
    runs = await listRuns();
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Run history</h1>
        <p className="mt-1 text-sm text-muted">
          All runs that have been queued, in progress, or finished. Latest first.
        </p>
      </div>

      {error ? (
        <div className="card text-sm text-rose-200">{error}</div>
      ) : runs.length === 0 ? (
        <div className="card text-sm text-muted">No runs yet.</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-surface text-[11px] uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Run</th>
                <th className="px-4 py-3 text-left font-semibold">Slug</th>
                <th className="px-4 py-3 text-left font-semibold">Mode</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Phase</th>
                <th className="px-4 py-3 text-left font-semibold">Started</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 bg-bg">
              {runs.map((r) => {
                const phaseLabel =
                  r.current_phase && PHASE_NAMES[String(r.current_phase)]
                    ? `${r.current_phase} · ${PHASE_NAMES[String(r.current_phase)]}`
                    : "—";
                return (
                  <tr key={r.run_id} className="hover:bg-white/5">
                    <td className="px-4 py-3">
                      <Link
                        href={`/runs/${r.run_id}`}
                        className="font-mono text-xs text-accent hover:text-accent-light"
                      >
                        {r.run_id}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{r.slug ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">{r.mode}</td>
                    <td className="px-4 py-3">
                      <StatusPill status={r.status} />
                    </td>
                    <td className="px-4 py-3 text-muted">{phaseLabel}</td>
                    <td className="px-4 py-3 text-muted">
                      {formatDate(r.started_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    queued: "bg-white/10 text-muted",
    running: "bg-accent/20 text-accent-light",
    completed: "bg-emerald-500/15 text-emerald-300",
    halted: "bg-rose-500/15 text-rose-300",
  };
  return (
    <span className={`tag ${styles[status] ?? "bg-white/10 text-muted"}`}>
      {status}
    </span>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
