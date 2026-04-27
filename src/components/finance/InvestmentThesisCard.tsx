"use client";

import { useEffect, useState } from "react";

const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

interface Thesis {
  id:                 string;
  holding_id:         string;
  holding_type:       string;
  thesis:             string;
  conviction:         number | null;
  written_at:         string;
  last_referenced_at: string | null;
  active:             boolean;
}

interface Props {
  holding_id:    string;
  holding_type:  "crypto" | "fund" | "stock" | "etf" | "other";
  display_name:  string;
  /** Optional context strip rendered above the thesis (price/perf). */
  context?:      React.ReactNode;
}

export function InvestmentThesisCard({ holding_id, holding_type, display_name, context }: Props) {
  const [thesis, setThesis] = useState<Thesis | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [conviction, setConviction] = useState(7);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const res = await fetch(`/api/finance/thesis?holding_id=${encodeURIComponent(holding_id)}`);
      const json = await res.json();
      const t = (json.theses ?? [])[0] as Thesis | undefined;
      setThesis(t ?? null);
      if (t) {
        setDraft(t.thesis);
        setConviction(t.conviction ?? 7);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [holding_id]);

  async function save() {
    if (!draft.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/finance/thesis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ holding_id, holding_type, thesis: draft.trim(), conviction }),
      });
      const json = await res.json();
      if (json.thesis) {
        setThesis(json.thesis);
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      background: "linear-gradient(160deg, #0f141d 0%, #080b11 100%)",
      border: "1px solid rgba(125,184,232,0.10)", borderRadius: 3,
      padding: "14px 16px",
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.32em", color: "var(--blue)", fontFamily: MONO }}>
            THESIS · {display_name.toUpperCase()}
          </span>
          {thesis && !editing && (
            <p style={{ fontSize: 10, color: "var(--t4)", marginTop: 4, fontFamily: MONO, letterSpacing: "0.06em" }}>
              WRITTEN {new Date(thesis.written_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toUpperCase()}
              {thesis.conviction != null && ` · CONVICTION ${thesis.conviction}/10`}
            </p>
          )}
        </div>
        {!loading && !editing && (
          <button onClick={() => { setEditing(true); if (!thesis) { setDraft(""); setConviction(7); } }}
            style={{
              background: "transparent", border: "1px solid var(--border)",
              color: "var(--t2)", padding: "5px 10px", borderRadius: 2,
              fontFamily: MONO, fontSize: 9, letterSpacing: "0.18em", fontWeight: 700, cursor: "pointer",
            }}>
            {thesis ? "EDIT" : "+ WRITE"}
          </button>
        )}
      </div>

      {context}

      {/* Body */}
      {loading && (
        <p style={{ fontSize: 11, color: "var(--t4)", fontFamily: MONO }}>loading…</p>
      )}

      {!loading && !editing && !thesis && (
        <p style={{ fontSize: 12, color: "var(--t3)", lineHeight: 1.5, fontStyle: "italic" }}>
          No thesis yet. Write why you hold this — M.A.X. will surface it back to you when the price moves.
        </p>
      )}

      {!loading && !editing && thesis && (
        <p style={{ fontSize: 13, color: "var(--t1)", lineHeight: 1.55 }}>
          {thesis.thesis}
        </p>
      )}

      {editing && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder={`Why are you holding ${display_name}? What would change your mind?`}
            rows={4}
            style={{
              width: "100%", resize: "vertical",
              background: "var(--surface2)", border: "1px solid var(--border2)",
              borderRadius: 2, padding: "10px 12px",
              color: "var(--t1)", fontFamily: "inherit", fontSize: 13,
              outline: "none", lineHeight: 1.5,
            }}
            onFocus={e => e.target.style.borderColor = "var(--blue)"}
            onBlur={e => e.target.style.borderColor = "var(--border2)"}
          />
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
              <span style={{ fontSize: 9, color: "var(--t3)", letterSpacing: "0.16em", fontFamily: MONO }}>CONVICTION</span>
              <span style={{ fontSize: 13, color: "var(--blue)", fontFamily: MONO, fontWeight: 600 }}>
                {conviction}/10
              </span>
            </div>
            <input type="range" min={1} max={10} step={1} value={conviction}
              onChange={e => setConviction(parseInt(e.target.value))}
              style={{ width: "100%", accentColor: "#7DB8E8" }} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { setEditing(false); setDraft(thesis?.thesis ?? ""); }}
              style={{
                flex: 1, background: "transparent", border: "1px solid var(--border2)",
                color: "var(--t3)", padding: "8px 14px", borderRadius: 2,
                fontFamily: MONO, fontSize: 10, letterSpacing: "0.18em", fontWeight: 700, cursor: "pointer",
              }}>CANCEL</button>
            <button onClick={save} disabled={saving || !draft.trim()}
              style={{
                flex: 2, background: "var(--blue-dim)", border: "1px solid var(--blue-border)",
                color: "var(--blue)", padding: "8px 14px", borderRadius: 2,
                fontFamily: MONO, fontSize: 10, letterSpacing: "0.18em", fontWeight: 700,
                cursor: saving || !draft.trim() ? "default" : "pointer",
                opacity: saving || !draft.trim() ? 0.5 : 1,
              }}>{saving ? "SAVING…" : "✓ SAVE THESIS"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
