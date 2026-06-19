import { describe, it, expect, vi, afterEach } from "vitest";
import { createApi } from "../src/embed/api";

afterEach(() => vi.unstubAllGlobals());

describe("embed api", () => {
  it("login posts credentials and returns role/slug/token", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, role: "client", slug: "acme", token: "tok" }) }));
    vi.stubGlobal("fetch", fetchMock);
    const api = createApi("https://editor.example.com", () => null);
    const r = await api.login("acme", "pw");
    expect(r).toEqual({ role: "client", slug: "acme", token: "tok" });
    expect((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[0]).toBe("https://editor.example.com/api/auth/login");
  });

  it("login returns null on 401", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => ({ error: "Invalid credentials" }) })));
    const api = createApi("https://e.com", () => null);
    expect(await api.login("x", "y")).toBeNull();
  });

  it("putOverride sends the bearer token", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) }));
    vi.stubGlobal("fetch", fetchMock);
    const api = createApi("https://e.com", () => "tok123");
    await api.putOverride("acme", "f1", "hello");
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init as any).method).toBe("PUT");
    expect((init as any).headers.Authorization).toBe("Bearer tok123");
    expect(JSON.parse((init as any).body)).toEqual({ slug: "acme", fieldId: "f1", value: "hello" });
  });
});
