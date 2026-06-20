import { createHash } from "node:crypto";

const API = "https://api.vercel.com";

export interface DeployFile { path: string; bytes: Buffer; }
export interface DeployInput {
  projectId: string;
  projectName: string;
  target?: "production";
  files: DeployFile[];
}
export interface DeployResult { id: string; url: string; }

export function sha1(bytes: Buffer): string {
  return createHash("sha1").update(bytes).digest("hex");
}

async function uploadFile(bytes: Buffer, sha: string): Promise<void> {
  const token = process.env.VERCEL_TOKEN;
  if (!token) throw new Error("VERCEL_TOKEN not set");
  const team = process.env.VERCEL_TEAM_ID;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`${API}/v2/files${team ? `?teamId=${team}` : ""}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/octet-stream",
        "x-vercel-digest": sha,
      },
      body: new Uint8Array(bytes),
    });
    if (res.ok) return;
    if (res.status >= 500 && attempt === 0) continue;
    throw new Error(`Vercel file upload failed: ${res.status} ${await res.text()}`);
  }
}

export async function deployFiles(input: DeployInput): Promise<DeployResult> {
  const token = process.env.VERCEL_TOKEN;
  if (!token) throw new Error("VERCEL_TOKEN not set");
  const team = process.env.VERCEL_TEAM_ID;

  const fileRefs: { file: string; sha: string; size: number }[] = [];
  for (const f of input.files) {
    const sha = sha1(f.bytes);
    await uploadFile(f.bytes, sha);
    fileRefs.push({ file: f.path, sha, size: f.bytes.length });
  }

  const body = {
    name: input.projectName,
    project: input.projectId,
    target: input.target,
    files: fileRefs,
    projectSettings: { framework: null },
  };
  const res = await fetch(`${API}/v13/deployments${team ? `?teamId=${team}` : ""}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Vercel deploy failed: ${res.status} ${await res.text()}`);
  const j = await res.json();
  return { id: j.id, url: j.url.startsWith("http") ? j.url : `https://${j.url}` };
}

export async function getDeploymentState(id: string): Promise<string> {
  const token = process.env.VERCEL_TOKEN;
  if (!token) throw new Error("VERCEL_TOKEN not set");
  const team = process.env.VERCEL_TEAM_ID;
  const res = await fetch(`${API}/v13/deployments/${id}${team ? `?teamId=${team}` : ""}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Vercel state failed: ${res.status}`);
  const j = await res.json();
  return j.readyState ?? j.status ?? "UNKNOWN";
}
