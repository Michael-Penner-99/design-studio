"use client";
import { useState } from "react";
import { buildInvite } from "../../../src/invite";

const TIERS = ["Text only", "Text + Pictures", "Text + Pictures + Colours", "Everything"] as const;
type FieldLite = { id: string; label: string; type: string; clientEditable: boolean };

export default function AdminPanel({ slug, tier, siteUrl, fields }: { slug: string; tier: string; siteUrl: string; fields: FieldLite[] }) {
  const [sel, setSel] = useState<string>((TIERS as readonly string[]).includes(tier) ? tier : TIERS[0]);
  const [perField, setPerField] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState("");
  const [pw, setPw] = useState(""); const [pwMsg, setPwMsg] = useState("");
  const [invite, setInvite] = useState<{ text: string; mailto: string } | null>(null);
  const [curPw, setCurPw] = useState(""); const [newPw, setNewPw] = useState(""); const [accountMsg, setAccountMsg] = useState("");

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
    if (res.ok) {
      setPwMsg("Password set.");
      setInvite(buildInvite({ link: `${siteUrl.replace(/\/$/, "")}/?edit`, username: slug, password: pw }));
    } else {
      setPwMsg(`Failed: ${j.error ?? res.status}`); setInvite(null);
    }
  }

  async function changeMyPassword() {
    setAccountMsg("Updating…");
    const res = await fetch("/api/account/password", {
      method: "PUT", headers: { "content-type": "application/json" },
      body: JSON.stringify({ currentPassword: curPw, newPassword: newPw }),
    });
    const j = await res.json().catch(() => ({}));
    setAccountMsg(res.ok ? "Your password was changed." : `Failed: ${j.error ?? res.status}`);
    if (res.ok) { setCurPw(""); setNewPw(""); }
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
        <h2>Client password &amp; invite</h2>
        <input type="text" data-testid="client-pw" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="new password (min 8)" />
        <button onClick={setPassword} disabled={pw.length < 8} style={{ marginLeft: 8 }}>Set password</button>
        <span style={{ marginLeft: 12 }}>{pwMsg}</span>
        {invite && (
          <div style={{ marginTop: 12, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
            <strong>Invite to send</strong>
            <pre data-testid="invite-text" style={{ whiteSpace: "pre-wrap", fontFamily: "system-ui", margin: "8px 0" }}>{invite.text}</pre>
            <button onClick={() => navigator.clipboard?.writeText(invite.text)}>Copy</button>
            <a data-testid="invite-mailto" href={invite.mailto} style={{ marginLeft: 8 }}>Open in email</a>
            <p style={{ fontSize: 12, color: "#777" }}>The password is only shown here, now. To re-send later, set a new password.</p>
          </div>
        )}
      </section>

      <section>
        <h2>My password</h2>
        <input type="password" data-testid="cur-pw" value={curPw} onChange={(e) => setCurPw(e.target.value)} placeholder="current password" />
        <input type="password" data-testid="new-pw" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="new password (min 8)" style={{ marginLeft: 8 }} />
        <button onClick={changeMyPassword} disabled={newPw.length < 8 || curPw.length < 1} style={{ marginLeft: 8 }}>Change my password</button>
        <span style={{ marginLeft: 12 }}>{accountMsg}</span>
      </section>
    </main>
  );
}
