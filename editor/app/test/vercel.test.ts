import { describe, it, expect, vi, afterEach } from "vitest";
import { sha1, deployFiles } from "../src/vercel";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("sha1", () => {
  it("matches known vectors", () => {
    expect(sha1(Buffer.from(""))).toBe("da39a3ee5e6b4b0d3255bfef95601890afd80709");
    expect(sha1(Buffer.from("abc"))).toBe("a9993e364706816aba3e25717850c26c9cd0d89d");
  });
});

describe("deployFiles (SHA upload)", () => {
  it("uploads each file to /v2/files then creates a deployment referencing shas", async () => {
    vi.stubEnv("VERCEL_TOKEN", "tok");
    vi.stubEnv("VERCEL_TEAM_ID", "team_1");
    const calls: any[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: any) => {
      calls.push({ url, init });
      if (url.includes("/v2/files")) return { ok: true, status: 200, json: async () => ({}) } as any;
      return { ok: true, status: 200, json: async () => ({ id: "dpl_1", url: "x.vercel.app" }) } as any;
    }));

    const r = await deployFiles({
      projectId: "prj_1", projectName: "acme-site", target: "production",
      files: [
        { path: "index.html", bytes: Buffer.from("abc") },
        { path: "assets/logo.webp", bytes: Buffer.from("logo-bytes") },
      ],
    });
    expect(r).toEqual({ id: "dpl_1", url: "https://x.vercel.app" });

    const uploads = calls.filter((c) => c.url.includes("/v2/files"));
    expect(uploads).toHaveLength(2);
    expect(uploads[0].url).toContain("teamId=team_1");
    expect(uploads[0].init.headers["x-vercel-digest"]).toBe("a9993e364706816aba3e25717850c26c9cd0d89d");
    expect(uploads[0].init.method).toBe("POST");

    const toBytes = (b: any) => new Uint8Array(b instanceof Uint8Array ? b : Buffer.from(b));
    expect(toBytes(uploads[0].init.body)).toEqual(new Uint8Array(Buffer.from("abc")));
    expect(toBytes(uploads[1].init.body)).toEqual(new Uint8Array(Buffer.from("logo-bytes")));

    const deploy = calls.find((c) => c.url.includes("/v13/deployments"));
    const body = JSON.parse(deploy.init.body);
    expect(body.project).toBe("prj_1");
    expect(body.target).toBe("production");
    expect(body.files).toEqual([
      { file: "index.html", sha: "a9993e364706816aba3e25717850c26c9cd0d89d", size: 3 },
      { file: "assets/logo.webp", sha: sha1(Buffer.from("logo-bytes")), size: Buffer.from("logo-bytes").length },
    ]);
  });

  it("retries a file upload once on 5xx then fails", async () => {
    vi.stubEnv("VERCEL_TOKEN", "tok");
    let n = 0;
    vi.stubGlobal("fetch", vi.fn(async () => { n++; return { ok: false, status: 500, text: async () => "boom" } as any; }));
    await expect(deployFiles({ projectId: "p", projectName: "s", files: [{ path: "a", bytes: Buffer.from("x") }] }))
      .rejects.toThrow(/file upload failed/i);
    expect(n).toBe(2); // initial + one retry
  });
});
