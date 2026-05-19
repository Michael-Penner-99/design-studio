import { Octokit } from "@octokit/rest";
import {
  jobSpecSchema,
  runStatusSchema,
  type JobSpec,
  type RunStatus,
} from "./schemas";
import type { RunSummary } from "./types";

interface GithubConfig {
  owner: string;
  repo: string;
  branch: string;
  token: string;
}

function getConfig(): GithubConfig {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_REPO_OWNER || "Michael-Penner-99";
  const repo = process.env.GITHUB_REPO_NAME || "design-studio";
  const branch = process.env.GITHUB_DEFAULT_BRANCH || "main";
  if (!token) {
    throw new Error("GITHUB_TOKEN is not set");
  }
  return { token, owner, repo, branch };
}

// Never cache the Octokit client — always fresh so Vercel doesn't serve stale data.
function client(): Octokit {
  const { token } = getConfig();
  return new Octokit({
    auth: token,
    request: {
      // Bypass any CDN/edge caching for GitHub API responses
      headers: {
        "Cache-Control": "no-cache, no-store",
      },
    },
  });
}

/**
 * Write a job spec to queue/{run_id}.json. Creates the file via a single commit
 * on the default branch.
 */
export async function writeQueueSpec(spec: JobSpec): Promise<{ commitSha: string }> {
  const { owner, repo, branch } = getConfig();
  const path = `queue/${spec.run_id}.json`;
  const content = Buffer.from(JSON.stringify(spec, null, 2) + "\n").toString("base64");

  const res = await client().repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    branch,
    message: `chore(queue): submit ${spec.run_id}`,
    content,
    committer: {
      name: "Action Studio Factory",
      email: "factory@actiondesignstudio.com",
    },
    author: {
      name: spec.submitted_by ?? "Action Studio Factory",
      email: spec.submitted_by?.includes("@")
        ? spec.submitted_by
        : "factory@actiondesignstudio.com",
    },
  });

  return { commitSha: res.data.commit.sha ?? "" };
}

/**
 * List all run status files (runs/*.json). Returns a summary array sorted by
 * started_at descending. If the runs/ directory does not exist yet, returns [].
 */
export async function listRuns(limit?: number): Promise<RunSummary[]> {
  const { owner, repo, branch } = getConfig();
  const octokit = client();
  let entries: Array<{ name: string; path: string; type: string }> = [];
  try {
    const res = await octokit.repos.getContent({
      owner,
      repo,
      // Append a cache-buster to force GitHub to return fresh data
      ref: branch,
      path: "runs",
      headers: {
        "If-None-Match": "",
        "Cache-Control": "no-cache",
      },
    } as Parameters<typeof octokit.repos.getContent>[0]);
    if (Array.isArray(res.data)) {
      entries = res.data
        .filter((e) => e.type === "file" && e.name.endsWith(".json"))
        .map((e) => ({ name: e.name, path: e.path, type: e.type }));
    }
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 404) return [];
    throw err;
  }

  // Sort lexicographically descending — run IDs embed UTC timestamps so this is
  // the same as sorting by submitted time.
  entries.sort((a, b) => (a.name < b.name ? 1 : a.name > b.name ? -1 : 0));

  const take = typeof limit === "number" ? entries.slice(0, limit) : entries;

  const summaries = await Promise.all(
    take.map(async (entry) => {
      const status = await getRun(entry.name.replace(/\.json$/, ""));
      if (!status) return null;
      const s: RunSummary = {
        run_id: status.run_id,
        slug: status.slug ?? null,
        mode: status.mode,
        status: status.status,
        current_phase: status.current_phase ?? null,
        started_at: status.started_at,
        updated_at: status.updated_at ?? null,
        url: status.url ?? null,
        business_name: status.business_name ?? null,
      };
      return s;
    }),
  );

  return summaries.filter((x): x is RunSummary => x !== null);
}

/**
 * Fetch a single runs/{run_id}.json. Returns null if not found.
 */
export async function getRun(runId: string): Promise<RunStatus | null> {
  const { owner, repo, branch } = getConfig();
  const octokit = client();
  try {
    const res = await octokit.repos.getContent({
      owner,
      repo,
      ref: branch,
      path: `runs/${runId}.json`,
      mediaType: { format: "raw" },
      headers: {
        "If-None-Match": "",
        "Cache-Control": "no-cache",
      },
    } as Parameters<typeof octokit.repos.getContent>[0]);
    const raw = typeof res.data === "string" ? res.data : null;
    if (!raw) {
      const obj = res.data as { content?: string; encoding?: string };
      if (obj && obj.content && obj.encoding === "base64") {
        const decoded = Buffer.from(obj.content, "base64").toString("utf8");
        return parseStatus(decoded);
      }
      return null;
    }
    return parseStatus(raw);
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 404) return null;
    throw err;
  }
}

function parseStatus(raw: string): RunStatus | null {
  try {
    const json = JSON.parse(raw);
    const parsed = runStatusSchema.safeParse(json);
    if (parsed.success) return parsed.data;
    return json as RunStatus;
  } catch {
    return null;
  }
}

/**
 * Read a queue spec — useful for the run-detail page when no status exists yet
 * (still queued, worker hasn't picked it up).
 */
export async function getQueueSpec(runId: string): Promise<JobSpec | null> {
  const { owner, repo, branch } = getConfig();
  const octokit = client();
  try {
    const res = await octokit.repos.getContent({
      owner,
      repo,
      ref: branch,
      path: `queue/${runId}.json`,
      mediaType: { format: "raw" },
      headers: {
        "If-None-Match": "",
        "Cache-Control": "no-cache",
      },
    } as Parameters<typeof octokit.repos.getContent>[0]);
    const raw = typeof res.data === "string" ? res.data : null;
    if (!raw) return null;
    const json = JSON.parse(raw);
    const parsed = jobSpecSchema.safeParse(json);
    return parsed.success ? parsed.data : (json as JobSpec);
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 404) return null;
    throw err;
  }
}
// ─── ADD THESE TWO FUNCTIONS TO THE BOTTOM OF web/lib/github.ts ───────────────

/**
 * Write operator-supplied resume inputs into the client folder on GitHub.
 * Creates:
 *   clients/{slug}/evidence/reviews-raw.txt  (the pasted reviews)
 *   clients/{slug}/resume-input.md            (operator notes + context)
 */
export async function writeResumeInput({
  slug,
  runId,
  resumePhase,
  reviewsText,
  notes,
}: {
  slug: string;
  runId: string;
  resumePhase: number;
  reviewsText: string;
  notes: string;
}): Promise<void> {
  const { owner, repo, branch } = getConfig();
  const octokit = client();
  const now = new Date().toISOString();

  const files: Array<{ path: string; content: string; message: string }> = [];

  if (reviewsText.trim()) {
    files.push({
      path: `clients/${slug}/evidence/reviews-raw.txt`,
      content: reviewsText,
      message: `resume(${runId}): operator-supplied reviews for phase ${resumePhase}`,
    });
  }

  const resumeMd = [
    `# Resume Input — ${runId}`,
    ``,
    `**Submitted at:** ${now}`,
    `**Resume from phase:** ${resumePhase}`,
    ``,
    notes ? `## Operator notes\n\n${notes}` : "",
    reviewsText
      ? `## Reviews supplied\n\nSee \`evidence/reviews-raw.txt\``
      : "## Reviews supplied\n\nNone — operator did not supply reviews.",
  ]
    .filter((l) => l !== "")
    .join("\n");

  files.push({
    path: `clients/${slug}/resume-input.md`,
    content: resumeMd,
    message: `resume(${runId}): operator resume input`,
  });

  // Write each file — get current SHA if it exists so we can update it
  for (const file of files) {
    const contentB64 = Buffer.from(file.content + "\n").toString("base64");
    let sha: string | undefined;
    try {
      const existing = await octokit.repos.getContent({
        owner,
        repo,
        ref: branch,
        path: file.path,
      });
      const data = existing.data as { sha?: string };
      sha = data.sha;
    } catch {
      // File doesn't exist yet — that's fine
    }
    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: file.path,
      branch,
      message: file.message,
      content: contentB64,
      sha,
      committer: {
        name: "Action Studio Factory",
        email: "factory@actiondesignstudio.com",
      },
    });
  }
}

/**
 * Reset a halted run's status to "queued" and write a new queue spec
 * with resume_from_phase so the worker knows to pick it up mid-pipeline.
 */
export async function requeueRun(
  run: RunStatus,
  resumeFromPhase: number,
): Promise<void> {
  const { owner, repo, branch } = getConfig();
  const octokit = client();
  const now = new Date().toISOString();

  // 1. Reset runs/{run_id}.json status to queued
  const updatedStatus = {
    ...run,
    status: "queued" as const,
    updated_at: now,
    halt_reason: null,
    halt_phase: null,
    // Reset the halted phase back to running so it retries
    phases: Object.fromEntries(
      Object.entries(run.phases ?? {}).map(([k, v]) => [
        k,
        Number(k) >= resumeFromPhase && v.status !== "completed"
          ? { ...v, status: "pending", started_at: null, completed_at: null }
          : v,
      ]),
    ),
  };

  const statusContent = Buffer.from(
    JSON.stringify(updatedStatus, null, 2) + "\n",
  ).toString("base64");

  // Get current SHA of runs file
  let runsSha: string | undefined;
  try {
    const existing = await octokit.repos.getContent({
      owner,
      repo,
      ref: branch,
      path: `runs/${run.run_id}.json`,
    });
    runsSha = (existing.data as { sha?: string }).sha;
  } catch {
    // won't happen since run exists
  }

  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: `runs/${run.run_id}.json`,
    branch,
    message: `resume(${run.run_id}): operator re-queued from phase ${resumeFromPhase}`,
    content: statusContent,
    sha: runsSha,
    committer: {
      name: "Action Studio Factory",
      email: "factory@actiondesignstudio.com",
    },
  });

  // 2. Write a new queue spec with resume_from_phase field
  // Re-use the same run_id so history stays intact
  const resumeSpec = {
    run_id: run.run_id,
    submitted_at: now,
    submitted_by: "operator-resume",
    mode: run.mode,
    url: run.url ?? undefined,
    business_name: run.business_name ?? undefined,
    resume_from_phase: resumeFromPhase,
    options: {
      skip_deploy: false,
      force_archetype: null,
      ai_image_provider: "openai",
    },
  };

  const specContent = Buffer.from(
    JSON.stringify(resumeSpec, null, 2) + "\n",
  ).toString("base64");

  // Get SHA of existing queue spec (always exists for a run that ran)
  let queueSha: string | undefined;
  try {
    const existing = await octokit.repos.getContent({
      owner,
      repo,
      ref: branch,
      path: `queue/${run.run_id}.json`,
    });
    queueSha = (existing.data as { sha?: string }).sha;
  } catch {
    // fine if missing
  }

  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: `queue/${run.run_id}.json`,
    branch,
    message: `resume(${run.run_id}): re-queue from phase ${resumeFromPhase}`,
    content: specContent,
    sha: queueSha,
    committer: {
      name: "Action Studio Factory",
      email: "factory@actiondesignstudio.com",
    },
  });
}
// ─── APPEND TO BOTTOM OF web/lib/github.ts ────────────────────────────────────

export interface ActivityEntry {
  sha: string;
  message: string;
  timestamp: string;
  author: string;
}

/**
 * Fetch the 30 most recent commits that touch files related to a run.
 * Looks at: runs/{run_id}.json, queue/{run_id}.json, and clients/{slug}/
 * Returns them newest-first.
 */
export async function getRecentActivity(runId: string): Promise<ActivityEntry[]> {
  const { owner, repo, branch } = getConfig();
  const octokit = client();

  // Get the run to find the slug
  const run = await getRun(runId);
  const slug = run?.slug ?? null;

  // Fetch commits touching runs/{run_id}.json (phase updates)
  const paths = [
    `runs/${runId}.json`,
    `queue/${runId}.json`,
    ...(slug ? [`clients/${slug}`] : []),
  ];

  const allCommits: ActivityEntry[] = [];
  const seen = new Set<string>();

  await Promise.all(
    paths.map(async (path) => {
      try {
        const res = await octokit.repos.listCommits({
          owner,
          repo,
          sha: branch,
          path,
          per_page: 20,
          headers: {
            "If-None-Match": "",
            "Cache-Control": "no-cache",
          },
        } as Parameters<typeof octokit.repos.listCommits>[0]);

        for (const c of res.data) {
          if (seen.has(c.sha)) continue;
          seen.add(c.sha);
          allCommits.push({
            sha: c.sha.slice(0, 7),
            message: c.commit.message.split("\n")[0], // first line only
            timestamp: c.commit.author?.date ?? c.commit.committer?.date ?? "",
            author: c.commit.author?.name ?? "worker",
          });
        }
      } catch {
        // ignore per-path failures
      }
    }),
  );

  // Sort newest first
  allCommits.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
  return allCommits.slice(0, 30);
}
