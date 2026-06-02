// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import EditorForm from "../app/edit/EditorForm";
import type { PageGroup } from "../src/view";

const groups: PageGroup[] = [{
  page: "index.html",
  sections: [{ section: "Hero", fields: [
    { id: "index__h1__1", page: "index.html", section: "Hero", label: "Headline", type: "text", value: "Old", clientEditable: true },
  ] }],
}];

describe("EditorForm", () => {
  beforeEach(() => { vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, url: "https://p.vercel.app" }) }))); });
  afterEach(() => vi.unstubAllGlobals());

  it("renders a field and PUTs the edit on blur", async () => {
    render(<EditorForm slug="acme" groups={groups} initialOverrides={{}} />);
    const input = screen.getByTestId("text-index__h1__1") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "New Headline" } });
    fireEvent.blur(input);
    await waitFor(() => {
      const call = (globalThis.fetch as any).mock.calls.find((c: any[]) => c[0] === "/api/overrides");
      expect(call).toBeTruthy();
      expect(JSON.parse(call[1].body)).toEqual({ slug: "acme", fieldId: "index__h1__1", value: "New Headline" });
    });
  });

  it("Publish button calls /api/publish", async () => {
    render(<EditorForm slug="acme" groups={groups} initialOverrides={{}} />);
    fireEvent.click(screen.getAllByText("Publish")[0]);
    await waitFor(() => {
      expect((globalThis.fetch as any).mock.calls.some((c: any[]) => c[0] === "/api/publish")).toBe(true);
    });
  });
});
