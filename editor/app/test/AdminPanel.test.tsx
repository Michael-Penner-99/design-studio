// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import AdminPanel from "../app/admin/[slug]/AdminPanel";

afterEach(cleanup);

describe("AdminPanel", () => {
  beforeEach(() => { vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, tier: "Text + Pictures" }) }))); });
  afterEach(() => vi.unstubAllGlobals());

  it("saving permissions posts the selected tier + per-field map", async () => {
    render(<AdminPanel slug="acme" tier="Text only" fields={[{ id: "c", label: "primary", type: "color", clientEditable: false }]} />);
    fireEvent.change(screen.getByTestId("tier-select"), { target: { value: "Text + Pictures" } });
    fireEvent.click(screen.getByTestId("pf-c"));
    fireEvent.click(screen.getByText("Save permissions"));
    await waitFor(() => {
      const call = (globalThis.fetch as any).mock.calls.find((c: any[]) => c[0] === "/api/admin/permissions");
      expect(call).toBeTruthy();
      expect(JSON.parse(call[1].body)).toEqual({ slug: "acme", tier: "Text + Pictures", perField: { c: true } });
    });
  });
});
