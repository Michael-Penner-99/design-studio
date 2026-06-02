"use client";
import { useState } from "react";

const TIERS = ["Text only", "Text + Pictures", "Text + Pictures + Colours", "Everything"] as const;
type FieldLite = { id: string; label: string; type: string; clientEditable: boolean };

export default function AdminPanel({ slug, tier, fields }: { slug: string; tier: string; fields: FieldLite[] }) {
  const [sel, setSel] = useState<string>((TIERS as readonly string[]).includes(tier) ? tier : TIERS[0]);
  const [perField, setPerField] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState("");
  const [pw, setPw] = useState(""); const [pwMsg, setPwMsg] = useState("");

  async function savePerms() {
    setMsg("Saving…");
    const res = await fetch("/api/admin/permissions", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug, tier: sel, perField }),
    });
    const j = await res.json();
    setMsg(res.ok ? `Saved (tier: ${j.tier})` : `Error: ${j.error}`);
  }
  async function setPassword() {
    const res = await fetch("/api/admin/credentials", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: slug, slug, password: pw }),
    });
    const j = await res.json().catch(() => ({}));
    setPwMsg(res.ok ? "Password set. Send the client the /login link, username, and this password." : `Failed: ${j.error ?? res.status}`);
  }

  return (
    <main style={{ maxWidth: 760, margin: "24px auto", fontFamily: "system-ui" }}>
      <h1>Admin — {slug}</h1>
      <section>
        <h2>Permission tier</h2>
        <select value={sel} onChange={(e) => setSel(e.target.value)} data-testid="tier-select">
          {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button onClick={savePerms} style={{ marginLeft: 8 }}>Save permissions</button>
        <span style={{ marginLeft: 12 }}>{msg}</span>
        <h3>Per-field overrides</h3>
        {fields.map((f) => (
          <label key={f.id} style={{ display: "block" }}>
            <input type="checkbox" data-testid={`pf-${f.id}`}
              onChange={(e) => setPerField((p) => ({ ...p, [f.id]: e.target.checked }))} /> {f.label} <em>({f.type})</em>
          </label>
        ))}
      </section>
      <section>
        <h2>Client password</h2>
        <input type="text" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="new password (min 8)" />
        <button onClick={setPassword} disabled={pw.length < 8} style={{ marginLeft: 8 }}>Set password</button>
        <span style={{ marginLeft: 12 }}>{pwMsg}</span>
        <p>Editor link to send: <code>/login</code> (username: <code>{slug}</code>)</p>
      </section>
    </main>
  );
}
