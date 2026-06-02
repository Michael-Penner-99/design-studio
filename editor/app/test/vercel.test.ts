import { describe, it, expect, vi, afterEach } from "vitest";
import { deployFiles } from "../src/vercel";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("deployFiles", () => {
  it("posts base64 files to v13/deployments and returns id+url", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true, status: 200, json: async () => ({ id: "dpl_1", url: "editor-spike-abc.vercel.app" }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("VERCEL_TOKEN", "tok"); vi.stubEnv("VERCEL_TEAM_ID", "team_1");

    const r = await deployFiles({
      projectId: "prj_1", projectName: "acme-site", target: "production",
      files: [{ path: "index.html", content: "<h1>hi</h1>" }],
    });
    expect(r).toEqual({ id: "dpl_1", url: "https://editor-spike-abc.vercel.app" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/v13/deployments");
    expect(url).toContain("teamId=team_1");
    const body = JSON.parse((init as any).body);
    expect(body.project).toBe("prj_1");
    expect(body.target).toBe("production");
    expect(body.files[0]).toEqual({ file: "index.html", data: Buffer.from("<h1>hi</h1>").toString("base64"), encoding: "base64" });
    expect((init as any).headers.authorization).toBe("Bearer tok");
  });

  it("throws on non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 403, text: async () => "nope" })));
    vi.stubEnv("VERCEL_TOKEN", "tok");
    await expect(deployFiles({ projectId: "p", projectName: "n", files: [] })).rejects.toThrow(/403/);
  });
});
