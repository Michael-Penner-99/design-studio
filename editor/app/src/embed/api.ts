export interface LoginResult { role: string; slug: string | null; token: string; }
export interface EditorApi {
  login(username: string, password: string): Promise<LoginResult | null>;
  getManifest(slug: string): Promise<any | null>;
  getOverrides(slug: string): Promise<Record<string, any>>;
  putOverride(slug: string, fieldId: string, value: any): Promise<boolean>;
  upload(slug: string, fieldId: string, file: File): Promise<string | null>;
  preview(slug: string): Promise<string | null>;
  publish(slug: string): Promise<string | null>;
}

export function createApi(base: string, getToken: () => string | null): EditorApi {
  const url = (p: string) => `${base.replace(/\/$/, "")}${p}`;
  function headers(json = true): Record<string, string> {
    const h: Record<string, string> = {};
    if (json) h["content-type"] = "application/json";
    const t = getToken();
    if (t) h["Authorization"] = `Bearer ${t}`;
    return h;
  }
  return {
    async login(username, password) {
      const res = await fetch(url("/api/auth/login"), { method: "POST", headers: headers(), body: JSON.stringify({ username, password }) });
      if (!res.ok) return null;
      const j = await res.json();
      return { role: j.role, slug: j.slug, token: j.token };
    },
    async getManifest(slug) {
      const res = await fetch(url(`/api/manifest?slug=${encodeURIComponent(slug)}`), { headers: headers(false) });
      if (!res.ok) return null;
      return (await res.json()).manifest;
    },
    async getOverrides(slug) {
      const res = await fetch(url(`/api/overrides?slug=${encodeURIComponent(slug)}`), { headers: headers(false) });
      if (!res.ok) return {};
      return (await res.json()).overrides ?? {};
    },
    async putOverride(slug, fieldId, value) {
      const res = await fetch(url("/api/overrides"), { method: "PUT", headers: headers(), body: JSON.stringify({ slug, fieldId, value }) });
      return res.ok;
    },
    async upload(slug, fieldId, file) {
      const fd = new FormData(); fd.set("slug", slug); fd.set("fieldId", fieldId); fd.set("file", file);
      const res = await fetch(url("/api/upload"), { method: "POST", headers: headers(false), body: fd });
      if (!res.ok) return null;
      return (await res.json()).url ?? null;
    },
    async preview(slug) {
      const res = await fetch(url("/api/preview"), { method: "POST", headers: headers(), body: JSON.stringify({ slug }) });
      if (!res.ok) return null;
      return (await res.json()).url ?? null;
    },
    async publish(slug) {
      const res = await fetch(url("/api/publish"), { method: "POST", headers: headers(), body: JSON.stringify({ slug }) });
      if (!res.ok) return null;
      return (await res.json()).url ?? null;
    },
  };
}
