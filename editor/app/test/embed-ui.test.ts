// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderLogin, renderActionBar } from "../src/embed/ui";

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
});
