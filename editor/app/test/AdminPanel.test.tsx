// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import AdminPanel from "../app/admin/[slug]/AdminPanel";

afterEach(cleanup);

describe("AdminPanel", () => {
  beforeEach(() => { vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, tier: "Text + Pictures" }) }))); });
  afterEach(() => vi.unstubAllGlobals());

  it("saving permissions posts the selected tier + per-field map", async () => {
    render(<AdminPanel slug="acme" tier="Text only" siteUrl="https://acme.actiondesignstudio.com" fields={[{ id: "c", label: "primary", type: "color", clientEditable: false }]} />);
    fireEvent.change(screen.getByTestId("tier-select"), { target: { value: "Text + Pictures" } });
    fireEvent.click(screen.getByTestId("pf-c"));
    fireEvent.click(screen.getByText("Save permissions"));
    await waitFor(() => {
      const call = (globalThis.fetch as any).mock.calls.find((c: any[]) => c[0] === "/api/admin/permissions");
      expect(JSON.parse(call[1].body)).toEqual({ slug: "acme", tier: "Text + Pictures", perField: { c: true } });
    });
  });

  it("setting a client password reveals an invite with the link, username and password", async () => {
    render(<AdminPanel slug="acme" tier="Text only" siteUrl="https://acme.actiondesignstudio.com" fields={[]} />);
    fireEvent.change(screen.getByTestId("client-pw"), { target: { value: "s3cret88" } });
    fireEvent.click(screen.getByText("Set password"));
    await waitFor(() => {
      const invite = screen.getByTestId("invite-text").textContent ?? "";
      expect(invite).toContain("https://acme.actiondesignstudio.com/?edit");
      expect(invite).toContain("acme");
      expect(invite).toContain("s3cret88");
    });
    expect((screen.getByTestId("invite-mailto") as HTMLAnchorElement).getAttribute("href")!.startsWith("mailto:")).toBe(true);
  });

  it("change-my-password posts current + new to /api/account/password", async () => {
    render(<AdminPanel slug="acme" tier="Text only" siteUrl="https://acme.actiondesignstudio.com" fields={[]} />);
    fireEvent.change(screen.getByTestId("cur-pw"), { target: { value: "old" } });
    fireEvent.change(screen.getByTestId("new-pw"), { target: { value: "newpass8" } });
    fireEvent.click(screen.getByText("Change my password"));
    await waitFor(() => {
      const call = (globalThis.fetch as any).mock.calls.find((c: any[]) => c[0] === "/api/account/password");
      expect(call[1].method).toBe("PUT");
      expect(JSON.parse(call[1].body)).toEqual({ currentPassword: "old", newPassword: "newpass8" });
    });
  });
});
