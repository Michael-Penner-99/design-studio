// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderLogin, renderActionBar, renderColorControls } from "../src/embed/ui";

describe("embed ui", () => {
  it("renderLogin submits username + password", () => {
    const root = document.createElement("div"); document.body.appendChild(root);
    const onSubmit = vi.fn();
    renderLogin(root, onSubmit);
    (root.querySelector('[data-embed="username"]') as HTMLInputElement).value = "acme";
    (root.querySelector('[data-embed="password"]') as HTMLInputElement).value = "pw";
    (root.querySelector('[data-embed="signin"]') as HTMLButtonElement).click();
    expect(onSubmit).toHaveBeenCalledWith("acme", "pw");
  });

  it("renderActionBar wires buttons and setStatus", () => {
    const root = document.createElement("div"); document.body.appendChild(root);
    const onPublish = vi.fn();
    const bar = renderActionBar(root, { onPreview: vi.fn(), onPublish, onExit: vi.fn() });
    (root.querySelector('[data-embed="publish"]') as HTMLButtonElement).click();
    expect(onPublish).toHaveBeenCalled();
    bar.setStatus("Saved");
    expect(root.querySelector('[data-embed="status"]')!.textContent).toBe("Saved");
  });

  it("renderColorControls renders inputs seeded with values and fires onColor", () => {
    const root = document.createElement("div"); document.body.appendChild(root);
    const onColor = vi.fn();
    const fields = [
      { id: "c1", label: "Primary", value: "#112233" },
      { id: "c2", label: "Accent", value: "#445566" },
    ];
    renderColorControls(root, fields, onColor);
    const container = root.querySelector('[data-embed="colors"]');
    expect(container).not.toBeNull();
    const input1 = root.querySelector('[data-embed="color-c1"]') as HTMLInputElement;
    const input2 = root.querySelector('[data-embed="color-c2"]') as HTMLInputElement;
    expect(input1).not.toBeNull();
    expect(input2).not.toBeNull();
    expect(input1.value).toBe("#112233");
    expect(input2.value).toBe("#445566");
    input1.value = "#aabbcc";
    input1.dispatchEvent(new Event("change"));
    expect(onColor).toHaveBeenCalledWith("c1", "#aabbcc");
  });

  it("renderColorControls early-exits on empty fields array", () => {
    const root = document.createElement("div"); document.body.appendChild(root);
    const onColor = vi.fn();
    renderColorControls(root, [], onColor);
    expect(root.querySelector('[data-embed="colors"]')).toBeNull();
  });
});
