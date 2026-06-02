"use client";
import { useState } from "react";

export default function ClientsPage() {
  const [slug, setSlug] = useState("");
  const [status, setStatus] = useState<string>("");

  async function push() {
    setStatus("Pushing…");
    const res = await fetch(`/api/push/${slug}`, { method: "POST" });
    const json = await res.json();
    setStatus(res.ok ? `✓ ${json.output ?? "Pushed"}` : `✗ ${json.error}: ${json.detail ?? ""}`);
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Push a client to the editor</h1>
      <p>Run this app locally. Enter a client slug (a folder under <code>clients/</code>) and push its built site to the hosted editor.</p>
      <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="windrosemechanical"
        style={{ padding: 8, width: 320 }} />
      <button onClick={push} disabled={!slug} style={{ marginLeft: 8, padding: "8px 16px" }}>
        Push to editor
      </button>
      <pre style={{ marginTop: 16 }}>{status}</pre>
    </main>
  );
}
