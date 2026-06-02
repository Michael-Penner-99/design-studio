const API = "https://api.vercel.com";

export interface DeployFile { path: string; content: string; }
export interface DeployFileB64 { path: string; base64: string; }

export interface DeployInput {
  projectId: string;
  projectName: string;
  target?: "production";
  files: DeployFile[];
  assets?: DeployFileB64[];
}

export interface DeployResult { id: string; url: string; }

export async function deployFiles(input: DeployInput): Promise<DeployResult> {
  const token = process.env.VERCEL_TOKEN;
  if (!token) throw new Error("VERCEL_TOKEN not set");
  const team = process.env.VERCEL_TEAM_ID;

  const files = [
    ...input.files.map((f) => ({ file: f.path, data: Buffer.from(f.content, "utf8").toString("base64"), encoding: "base64" as const })),
    ...(input.assets ?? []).map((a) => ({ file: a.path, data: a.base64, encoding: "base64" as const })),
  ];

  const body = {
    name: input.projectName,
    project: input.projectId,
    target: input.target,
    files,
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
