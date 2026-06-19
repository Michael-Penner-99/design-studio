import { createApi } from "./api";
import { wireEditable } from "./editable";
import { renderLogin, renderActionBar, renderColorControls } from "./ui";

export async function boot(doc: Document = document): Promise<void> {
  const script = doc.querySelector("script[data-editor-embed], script[data-editor]") as HTMLScriptElement | null;
  const base = script?.getAttribute("data-editor") ?? "";
  const slug = script?.getAttribute("data-slug") ?? "";
  if (!base || !slug) return;

  const TOKEN_KEY = `editor_token_${slug}`;
  const ROLE_KEY = `editor_role_${slug}`;
  const getToken = () => sessionStorage.getItem(TOKEN_KEY);
  const api = createApi(base, getToken);

  const root = doc.createElement("div");
  root.id = "__editor_root";
  doc.body.appendChild(root);

  async function startEditing(role: "operator" | "client") {
    const manifest = await api.getManifest(slug);
    if (!manifest) return;
    const overrides = await api.getOverrides(slug);

    const bar = renderActionBar(root, {
      onPreview: async () => { bar.setStatus("Building preview…"); const u = await api.preview(slug); bar.setStatus(u ? `Preview: ${u}` : "Preview failed"); if (u) window.open(u, "_blank"); },
      onPublish: async () => { bar.setStatus("Publishing…"); const u = await api.publish(slug); bar.setStatus(u ? "Published — your site is updating." : "Publish failed"); },
      onExit: () => { sessionStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(ROLE_KEY); const url = new URL(location.href); url.searchParams.delete("edit"); location.href = url.toString().replace(/#edit$/, ""); },
    });

    wireEditable(doc, manifest, role, {
      onText: async (id, value) => { bar.setStatus("Saving…"); const ok = await api.putOverride(slug, id, value); bar.setStatus(ok ? "Saved" : "You don't have permission to edit this"); },
      onImagePick: (id, el) => {
        const input = doc.createElement("input"); input.type = "file"; input.accept = "image/*";
        input.addEventListener("change", async () => {
          const file = input.files?.[0]; if (!file) return;
          bar.setStatus("Uploading…");
          const url = await api.upload(slug, id, file);
          if (url) { el.src = url; bar.setStatus("Saved"); } else { bar.setStatus("Upload failed"); }
        });
        input.click();
      },
    });

    const colorFields = (manifest.fields as any[])
      .filter((f) => f.type === "color" && (role === "operator" || f.clientEditable))
      .map((f) => ({ id: f.id, label: f.label, value: String(overrides[f.id] ?? f.value) }));
    renderColorControls(root, colorFields, async (id, value) => { bar.setStatus("Saving…"); const ok = await api.putOverride(slug, id, value); bar.setStatus(ok ? "Saved" : "Permission denied"); });
  }

  // Resume an existing session without re-login.
  const existing = getToken();
  if (existing) {
    const role = (sessionStorage.getItem(ROLE_KEY) === "operator" ? "operator" : "client");
    await startEditing(role);
  } else {
    const login = renderLogin(root, async (u, p) => {
      const r = await api.login(u, p);
      if (!r) { login.showError("Invalid credentials"); return; }
      sessionStorage.setItem(TOKEN_KEY, r.token);
      const role = r.role === "operator" ? "operator" : "client";
      sessionStorage.setItem(ROLE_KEY, role);
      login.remove();
      await startEditing(role);
    });
  }
}

if (typeof window !== "undefined" && !(window as any).__EDITOR_NO_BOOT__) {
  boot();
}
