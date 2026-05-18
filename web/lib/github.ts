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

let octokitClient: Octokit | null = null;
function client(): Octokit {
  if (octokitClient) return octokitClient;
  const { token } = getConfig();
  octokitClient = new Octokit({ auth: token });
  return octokitClient;
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
  let entries: Array<{ name: string; path: string; type: string }> = [];
  try {
    const res = await client().repos.getContent({
      owner,
      repo,
      ref: branch,
      path: "runs",
    });
    if (Array.isArray(res.data)) {
      entries = res.data
        .filter((e) => e.type === "file" && e.name.endsWith(".json"))
        .map((e) => ({ name: e.name, path: e.path, type: e.type }));
    }
  } catch (err) {
    // 404 means the runs/ directory doesn't exist yet — that's fine.
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
  try {
    const res = await client().repos.getContent({
      owner,
      repo,
      ref: branch,
      path: `runs/${runId}.json`,
      mediaType: { format: "raw" },
    });
    // When mediaType.format = raw, res.data is a string.
    const raw = typeof res.data === "string" ? res.data : null;
    if (!raw) {
      // Fallback: data is an object with `content` base64-encoded.
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
    // Be lenient: return the raw object cast — the worker may write extra fields
    // we haven't modeled, and pages should still render.
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
  try {
    const res = await client().repos.getContent({
      owner,
      repo,
      ref: branch,
      path: `queue/${runId}.json`,
      mediaType: { format: "raw" },
    });
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
