"use client";
import { useState } from "react";
import type { PageGroup } from "../../src/view";
import type { Overrides } from "@action-studio/editor-engine";

export default function EditorForm({ slug, groups, initialOverrides }: { slug: string; groups: PageGroup[]; initialOverrides: Overrides; }) {
  const [overrides, setOverrides] = useState<Overrides>(initialOverrides);
  const [msg, setMsg] = useState("");

  async function saveField(fieldId: string, value: string) {
    setOverrides((o) => ({ ...o, [fieldId]: value }));
    await fetch("/api/overrides", {
      method: "PUT", headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug, fieldId, value }),
    });
  }
  async function act(kind: "preview" | "publish") {
    setMsg(kind === "preview" ? "Building preview…" : "Publishing…");
    const res = await fetch(`/api/${kind}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug }),
    });
    const j = await res.json();
    setMsg(res.ok ? (kind === "preview" ? `Preview: ${j.url}` : "Published — your site is updating.") : `Error: ${j.error}`);
  }

  return (
    <main style={{ maxWidth: 760, margin: "24px auto", fontFamily: "system-ui" }}>
      <h1>Edit your site</h1>
      <div style={{ position: "sticky", top: 0, background: "#fff", padding: "8px 0" }}>
        <button onClick={() => act("preview")} style={{ marginRight: 8 }}>Preview</button>
        <button onClick={() => act("publish")}>Publish</button>
        <span style={{ marginLeft: 12 }}>{msg}</span>
      </div>
      {groups.map((page) => (
        <section key={page.page}>
          <h2>{page.page}</h2>
          {page.sections.map((sec) => (
            <fieldset key={sec.section} style={{ margin: "12px 0" }}>
              <legend>{sec.section}</legend>
              {sec.fields.map((f) => (
                <label key={f.id} style={{ display: "block", margin: "8px 0" }}>
                  <span style={{ display: "block", fontSize: 12, color: "#555" }}>{f.label}</span>
                  {f.type === "color" ? (
                    <input type="color" defaultValue={typeof overrides[f.id] === "string" ? (overrides[f.id] as string) : (f.value as string)}
                      onChange={(e) => saveField(f.id, e.target.value)} />
                  ) : f.type === "image" ? (
                    <input type="file" accept="image/*" data-testid={`img-${f.id}`}
                      onChange={async (e) => {
                        const file = e.target.files?.[0]; if (!file) return;
                        const fd = new FormData(); fd.set("slug", slug); fd.set("fieldId", f.id); fd.set("file", file);
                        const res = await fetch("/api/upload", { method: "POST", body: fd });
                        const j = await res.json(); if (res.ok) saveField(f.id, j.url);
                      }} />
                  ) : (
                    <input type="text" defaultValue={typeof overrides[f.id] === "string" ? (overrides[f.id] as string) : (f.value as string)}
                      data-testid={`text-${f.id}`} onBlur={(e) => saveField(f.id, e.target.value)}
                      style={{ width: "100%", padding: 6 }} />
                  )}
                </label>
              ))}
            </fieldset>
          ))}
        </section>
      ))}
    </main>
  );
}
