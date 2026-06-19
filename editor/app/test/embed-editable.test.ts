// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { wireEditable } from "../src/embed/editable";

const manifest: any = {
  slug: "acme", tier: "Text only",
  fields: [
    { id: "h1", page: "index.html", section: "hero", label: "Headline", type: "text", value: "Old", clientEditable: true },
    { id: "logo", page: "index.html", section: "hero", label: "Logo", type: "image", value: "/a.png", clientEditable: false },
  ],
};

function buildDoc() {
  document.body.innerHTML = `<h1 data-edit="h1">Old</h1><img data-edit="logo" src="/a.png">`;
  return document;
}

describe("wireEditable", () => {
  it("makes a client-editable text field contenteditable and saves on blur", () => {
    const doc = buildDoc();
    const onText = vi.fn();
    const n = wireEditable(doc, manifest, "client", { onText, onImagePick: vi.fn() });
    expect(n).toBe(1); // only h1 (logo not clientEditable for a client)
    const h1 = doc.querySelector('[data-edit="h1"]') as HTMLElement;
    expect(h1.getAttribute("contenteditable")).toBe("true");
    h1.textContent = "New";
    h1.dispatchEvent(new Event("blur"));
    expect(onText).toHaveBeenCalledWith("h1", "New");
  });

  it("an operator can edit all fields including the image", () => {
    const doc = buildDoc();
    const onImagePick = vi.fn();
    const n = wireEditable(doc, manifest, "operator", { onText: vi.fn(), onImagePick });
    expect(n).toBe(2);
    (doc.querySelector('[data-edit="logo"]') as HTMLElement).click();
    expect(onImagePick).toHaveBeenCalledWith("logo", expect.anything());
  });
});
