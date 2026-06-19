import type { Manifest } from "@action-studio/editor-engine";
import { visibleFields } from "../view";

export interface EditHandlers {
  onText(fieldId: string, value: string): void;
  onImagePick(fieldId: string, el: HTMLImageElement): void;
}

export function wireEditable(
  doc: Document, manifest: Manifest, role: "operator" | "client", handlers: EditHandlers
): number {
  let wired = 0;
  for (const f of visibleFields(manifest, role)) {
    const el = doc.querySelector(`[data-edit="${f.id}"]`);
    if (!el) continue;
    if (f.type === "text" || f.type === "richtext") {
      const node = el as HTMLElement;
      node.setAttribute("contenteditable", "true");
      node.style.outline = "1px dashed rgba(59,130,246,.6)";
      node.addEventListener("blur", () => handlers.onText(f.id, node.textContent ?? ""));
      wired++;
    } else if (f.type === "image") {
      const img = el as HTMLImageElement;
      img.style.cursor = "pointer";
      img.style.outline = "1px dashed rgba(59,130,246,.6)";
      img.addEventListener("click", () => handlers.onImagePick(f.id, img));
      wired++;
    }
  }
  return wired;
}
