import Link from "next/link";
import { NewRunForm } from "../components/new-run-form";
import { RunCard } from "../components/run-card";
import { listRuns } from "../lib/github";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const submitToken = process.env.FORM_SUBMIT_TOKEN ?? "";
  let recent = [] as Awaited<ReturnType<typeof listRuns>>;
  let listError: string | null = null;
  try {
    recent = await listRuns(5);
  } catch (err) {
    listError = err instanceof Error ? err.message : String(err);
  }

  return (
    <div className="space-y-10">
      <section>
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Start a new run</h1>
          <p className="mt-1 text-sm text-muted">
            Queue a contractor for the 8-phase factory pipeline. Submissions
            commit to the design-studio repo; the local worker picks them up.
          </p>
        </div>
        <NewRunForm submitToken={submitToken} />
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
            Recent runs
          </h2>
          <Link
            href="/runs"
            className="text-xs font-semibold text-accent hover:text-accent-light"
          >
            See all →
          </Link>
        </div>
        {listError ? (
          <div className="card text-sm text-rose-200">
            Could not load runs: {listError}
          </div>
        ) : recent.length === 0 ? (
          <div className="card text-sm text-muted">
            No runs yet. Queue one above to get started.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {recent.map((r) => (
              <RunCard key={r.run_id} run={r} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
