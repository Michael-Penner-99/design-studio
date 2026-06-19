const BAR_STYLE = "position:fixed;bottom:16px;right:16px;z-index:2147483647;display:flex;gap:8px;align-items:center;background:#111;color:#fff;padding:10px 14px;border-radius:8px;font:600 13px system-ui";
const OVERLAY_STYLE = "position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.5)";
const CARD_STYLE = "background:#fff;color:#111;padding:24px;border-radius:10px;font:14px system-ui;display:flex;flex-direction:column;gap:10px;min-width:280px";

export function renderLogin(root: HTMLElement, onSubmit: (u: string, p: string) => void, onError?: () => void): { showError(msg: string): void; remove(): void } {
  const overlay = document.createElement("div"); overlay.setAttribute("style", OVERLAY_STYLE); overlay.setAttribute("data-embed", "login");
  overlay.innerHTML =
    `<div style="${CARD_STYLE}"><strong>Sign in to edit</strong>` +
    `<input data-embed="username" placeholder="Username" style="padding:8px;border:1px solid #ccc;border-radius:6px">` +
    `<input data-embed="password" type="password" placeholder="Password" style="padding:8px;border:1px solid #ccc;border-radius:6px">` +
    `<button data-embed="signin" style="padding:8px;background:#111;color:#fff;border:0;border-radius:6px;cursor:pointer">Sign in</button>` +
    `<span data-embed="error" style="color:#b00;font-size:12px"></span></div>`;
  root.appendChild(overlay);
  overlay.querySelector('[data-embed="signin"]')!.addEventListener("click", () => {
    const u = (overlay.querySelector('[data-embed="username"]') as HTMLInputElement).value;
    const p = (overlay.querySelector('[data-embed="password"]') as HTMLInputElement).value;
    onSubmit(u, p);
  });
  return {
    showError(msg) { (overlay.querySelector('[data-embed="error"]') as HTMLElement).textContent = msg; onError?.(); },
    remove() { overlay.remove(); },
  };
}

export function renderActionBar(root: HTMLElement, opts: { onPreview(): void; onPublish(): void; onExit(): void }): { setStatus(s: string): void } {
  const bar = document.createElement("div"); bar.setAttribute("style", BAR_STYLE); bar.setAttribute("data-embed", "bar");
  bar.innerHTML =
    `<span data-embed="status" style="opacity:.8">Ready</span>` +
    `<button data-embed="preview" style="cursor:pointer">Preview</button>` +
    `<button data-embed="publish" style="cursor:pointer">Publish</button>` +
    `<button data-embed="exit" style="cursor:pointer">Exit</button>`;
  root.appendChild(bar);
  bar.querySelector('[data-embed="preview"]')!.addEventListener("click", opts.onPreview);
  bar.querySelector('[data-embed="publish"]')!.addEventListener("click", opts.onPublish);
  bar.querySelector('[data-embed="exit"]')!.addEventListener("click", opts.onExit);
  return { setStatus(s) { (bar.querySelector('[data-embed="status"]') as HTMLElement).textContent = s; } };
}

export function renderColorControls(root: HTMLElement, fields: { id: string; label: string; value: string }[], onColor: (id: string, value: string) => void): void {
  if (!fields.length) return;
  const box = document.createElement("div");
  box.setAttribute("style", "position:fixed;bottom:64px;right:16px;z-index:2147483647;background:#fff;color:#111;padding:10px;border-radius:8px;font:12px system-ui;display:flex;flex-direction:column;gap:6px");
  box.setAttribute("data-embed", "colors");
  for (const f of fields) {
    const row = document.createElement("label"); row.style.display = "flex"; row.style.gap = "6px"; row.style.alignItems = "center";
    const input = document.createElement("input"); input.type = "color"; input.value = f.value; input.setAttribute("data-embed", `color-${f.id}`);
    input.addEventListener("change", () => onColor(f.id, input.value));
    row.append(input, document.createTextNode(f.label));
    box.appendChild(row);
  }
  root.appendChild(box);
}
