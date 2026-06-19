"use client";
import { useState } from "react";

export default function LoginPage() {
  const [u, setU] = useState(""); const [p, setP] = useState(""); const [err, setErr] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/auth/login", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: u, password: p }),
    });
    if (res.ok) { const j = await res.json(); window.location.href = j.role === "operator" ? "/admin" : "/edit"; }
    else setErr("Invalid credentials");
  }
  return (
    <main style={{ maxWidth: 360, margin: "80px auto", fontFamily: "system-ui" }}>
      <h1>Sign in</h1>
      <form onSubmit={submit}>
        <input placeholder="Username" value={u} onChange={(e) => setU(e.target.value)} style={{ display: "block", width: "100%", padding: 8, margin: "8px 0" }} />
        <input placeholder="Password" type="password" value={p} onChange={(e) => setP(e.target.value)} style={{ display: "block", width: "100%", padding: 8, margin: "8px 0" }} />
        <button type="submit" style={{ padding: "8px 16px" }}>Sign in</button>
        {err && <p style={{ color: "crimson" }}>{err}</p>}
      </form>
    </main>
  );
}
