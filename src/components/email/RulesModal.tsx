"use client";

import { useEffect, useState } from "react";
import type { EmailRule, EmailClassification } from "./types";
import { CLASSIFICATION_META, MONO } from "./types";

interface Props { open: boolean; onClose: () => void; }

const COND_LABELS: Record<EmailRule["condition_type"], string> = {
  sender_email:     "Sender email is",
  sender_domain:    "Sender domain is",
  subject_contains: "Subject contains",
  body_contains:    "Body contains",
  has_label:        "Has Gmail label",
};

export function RulesModal({ open, onClose }: Props) {
  const [rules, setRules]     = useState<EmailRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  /* New rule form state */
  const [newName, setNewName]           = useState("");
  const [newCondType, setNewCondType]   = useState<EmailRule["condition_type"]>("sender_email");
  const [newCondValue, setNewCondValue] = useState("");
  const [newAction, setNewAction]       = useState<EmailClassification>("noise");
  const [newPriority, setNewPriority]   = useState(50);

  async function load() {
    try {
      const res = await fetch("/api/email/rules");
      const json = await res.json();
      if (Array.isArray(json.rules)) setRules(json.rules);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    void load();
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape" && open) onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function toggle(r: EmailRule) {
    setRules(prev => prev.map(x => x.id === r.id ? { ...x, active: !x.active } : x));
    await fetch("/api/email/rules", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: r.id, active: !r.active }),
    });
  }

  async function remove(r: EmailRule) {
    setRules(prev => prev.filter(x => x.id !== r.id));
    await fetch(`/api/email/rules?id=${r.id}`, { method: "DELETE" });
  }

  async function create() {
    if (!newName.trim() || !newCondValue.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/email/rules", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name:                  newName.trim(),
          condition_type:        newCondType,
          condition_value:       newCondValue.trim(),
          action_classification: newAction,
          priority:              newPriority,
        }),
      });
      const json = await res.json();
      if (json.rule) {
        setRules(prev => [...prev, json.rule].sort((a, b) => a.priority - b.priority));
        setNewName(""); setNewCondValue("");
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 250,
      background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "linear-gradient(160deg, #0f141d 0%, #080b11 100%)",
        border: "1px solid var(--blue-border)",
        borderRadius: 3, width: "min(720px, 94vw)", maxHeight: "84vh",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.32em", color: "var(--blue)", fontFamily: MONO }}>
              EMAIL RULES
            </span>
            <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 4, lineHeight: 1.5 }}>
              Rules run before Claude. Lower priority runs first. Trained from 👎-feedback when you reclassify a thread.
            </p>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "1px solid var(--border)", borderRadius: 2,
            padding: "5px 10px", color: "var(--t3)", cursor: "pointer",
            fontFamily: MONO, fontSize: 11, letterSpacing: "0.16em",
          }}>× CLOSE</button>
        </div>

        {/* New-rule row */}
        <div style={{ padding: "12px 22px", borderBottom: "1px solid var(--border)", background: "rgba(125,184,232,0.03)" }}>
          <p style={{ fontSize: 9, color: "var(--blue)", letterSpacing: "0.18em", fontFamily: MONO, fontWeight: 700, marginBottom: 8 }}>
            + NEW RULE
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 0.7fr 1fr 0.7fr 0.6fr 80px", gap: 6 }}>
            <input placeholder="Rule name" value={newName} onChange={e => setNewName(e.target.value)} style={inputStyle()} />
            <select value={newCondType} onChange={e => setNewCondType(e.target.value as EmailRule["condition_type"])} style={inputStyle()}>
              {(Object.keys(COND_LABELS) as EmailRule["condition_type"][]).map(k => <option key={k} value={k}>{COND_LABELS[k]}</option>)}
            </select>
            <input placeholder="value" value={newCondValue} onChange={e => setNewCondValue(e.target.value)} style={inputStyle()} />
            <select value={newAction} onChange={e => setNewAction(e.target.value as EmailClassification)} style={inputStyle()}>
              {(Object.keys(CLASSIFICATION_META) as EmailClassification[]).map(c => <option key={c} value={c}>→ {CLASSIFICATION_META[c].label}</option>)}
            </select>
            <input type="number" placeholder="prio" value={newPriority} onChange={e => setNewPriority(parseInt(e.target.value) || 50)} style={inputStyle()} />
            <button onClick={create} disabled={creating || !newName.trim() || !newCondValue.trim()}
              style={{
                background: "var(--blue-dim)", border: "1px solid var(--blue-border)",
                color: "var(--blue)", borderRadius: 2,
                fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", fontWeight: 700,
                cursor: creating || !newName.trim() || !newCondValue.trim() ? "default" : "pointer",
                opacity: creating || !newName.trim() || !newCondValue.trim() ? 0.5 : 1,
              }}>{creating ? "…" : "+ ADD"}</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading && <p style={{ padding: "20px", color: "var(--t4)", fontFamily: MONO, fontSize: 11 }}>loading…</p>}

          {!loading && rules.length === 0 && (
            <p style={{ padding: "30px 20px", textAlign: "center", color: "var(--t3)", fontSize: 12 }}>
              No rules yet. Click 👎 on a misclassified thread to start training, or add one above.
            </p>
          )}

          {!loading && rules.length > 0 && (
            <>
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1.4fr 0.7fr 60px 0.5fr 0.6fr",
                padding: "8px 22px", borderBottom: "1px solid var(--border)",
                fontSize: 9, color: "var(--t4)", letterSpacing: "0.18em", fontFamily: MONO,
              }}>
                <span>NAME</span>
                <span>CONDITION</span>
                <span>→ CLASSIFY</span>
                <span style={{ textAlign: "center" }}>HITS</span>
                <span style={{ textAlign: "center" }}>PRIO</span>
                <span style={{ textAlign: "right" }}>ACTIONS</span>
              </div>

              {rules.map(r => {
                const meta = CLASSIFICATION_META[r.action_classification];
                return (
                  <div key={r.id} style={{
                    display: "grid", gridTemplateColumns: "1fr 1.4fr 0.7fr 60px 0.5fr 0.6fr",
                    padding: "10px 22px", borderBottom: "1px solid var(--border)",
                    alignItems: "center", opacity: r.active ? 1 : 0.45,
                  }}>
                    <div>
                      <p style={{ fontSize: 12, color: "var(--t1)", fontWeight: 500 }}>{r.name}</p>
                      {r.source === "feedback" && (
                        <p style={{ fontSize: 9, color: "var(--blue)", fontFamily: MONO, letterSpacing: "0.14em", marginTop: 2 }}>
                          ↳ TRAINED FROM 👎
                        </p>
                      )}
                    </div>
                    <p style={{ fontSize: 11, color: "var(--t3)", fontFamily: MONO }}>
                      {COND_LABELS[r.condition_type]}: <span style={{ color: "var(--t1)" }}>{r.condition_value}</span>
                    </p>
                    <span style={{
                      fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", color: meta.color,
                      background: meta.bg, border: `1px solid ${meta.color}33`,
                      padding: "2px 7px", borderRadius: 2, fontFamily: MONO, justifySelf: "start",
                    }}>{meta.label}</span>
                    <span style={{ textAlign: "center", fontSize: 11, color: "var(--t3)", fontFamily: MONO }}>{r.hit_count}</span>
                    <span style={{ textAlign: "center", fontSize: 11, color: "var(--t3)", fontFamily: MONO }}>{r.priority}</span>
                    <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                      <button onClick={() => toggle(r)} title={r.active ? "Disable" : "Enable"} style={pillBtn(r.active ? "var(--green)" : "var(--t4)")}>
                        {r.active ? "ON" : "OFF"}
                      </button>
                      <button onClick={() => remove(r)} title="Delete" style={pillBtn("var(--red)")}>×</button>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function inputStyle(): React.CSSProperties {
  return {
    background: "var(--surface2)", border: "1px solid var(--border2)",
    borderRadius: 2, padding: "6px 8px",
    color: "var(--t1)", fontFamily: MONO, fontSize: 11, outline: "none",
  };
}

function pillBtn(color: string): React.CSSProperties {
  return {
    background: `${color}10`, border: `1px solid ${color}55`,
    color, padding: "4px 8px", borderRadius: 2,
    fontFamily: MONO, fontSize: 9, letterSpacing: "0.16em", fontWeight: 700, cursor: "pointer",
  };
}
