// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

beforeEach(() => { (globalThis as any).window.__EDITOR_NO_BOOT__ = true; });
afterEach(() => { vi.unstubAllGlobals(); document.body.innerHTML = ""; });

describe("embed boot", () => {
  it("shows login, then wires editing after a successful login", async () => {
    document.body.innerHTML =
      `<h1 data-edit="h1">Old</h1>` +
      `<script data-editor-embed data-editor="https://editor.example.com" data-slug="acme"></script>`;
    const fetchMock = vi.fn(async (u: string) => {
      if (u.endsWith("/api/auth/login")) return { ok: true, json: async () => ({ ok: true, role: "operator", slug: null, token: "tok" }) } as any;
      if (u.includes("/api/manifest")) return { ok: true, json: async () => ({ manifest: { slug: "acme", tier: "Everything", fields: [{ id: "h1", page: "index.html", section: "hero", label: "H", type: "text", value: "Old", clientEditable: true }] } }) } as any;
      if (u.includes("/api/overrides")) return { ok: true, json: async () => ({ overrides: {} }) } as any;
      return { ok: true, json: async () => ({ ok: true }) } as any;
    });
    vi.stubGlobal("fetch", fetchMock);

    const { boot } = await import("../src/embed/index");
    await boot(document);

    expect(document.querySelector('[data-embed="login"]')).toBeTruthy();
    (document.querySelector('[data-embed="username"]') as HTMLInputElement).value = "michael";
    (document.querySelector('[data-embed="password"]') as HTMLInputElement).value = "pw";
    (document.querySelector('[data-embed="signin"]') as HTMLButtonElement).click();

    await vi.waitFor(() => {
      expect(document.querySelector('[data-embed="bar"]')).toBeTruthy();
      expect((document.querySelector('[data-edit="h1"]') as HTMLElement).getAttribute("contenteditable")).toBe("true");
    });
  });
});
