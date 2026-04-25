"use client";

import { useEffect, useState } from "react";

const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

interface Allocation {
  id:       string;
  category: string;
  budgeted: number;
}

interface Props {
  open:        boolean;
  allocations: Allocation[];
  spendByCategory: Record<string, number>;
  onClose:     () => void;
  onApply:     (fromId: string, toId: string, amount: number) => Promise<void>;
}

function fmtInt(n: number): string { return Math.round(n).toLocaleString("en-US"); }

export function BudgetReallocateModal(p: Props) {
  const [from, setFrom] = useState<string>("");
  const [to,   setTo]   = useState<string>("");
  const [amt,  setAmt]  = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!p.open) { setFrom(""); setTo(""); setAmt(""); }
  }, [p.open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape" && p.open) p.onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [p.open, p.onClose]);

  if (!p.open) return null;

  const fromAlloc = p.allocations.find(a => a.id === from);
  const toAlloc   = p.allocations.find(a => a.id === to);
  const amount    = Math.max(0, parseFloat(amt) || 0);
  const valid     = fromAlloc && toAlloc && fromAlloc.id !== toAlloc.id && amount > 0 && amount <= fromAlloc.budgeted;

  async function handleApply() {
    if (!valid) return;
    setBusy(true);
    try { await p.onApply(fromAlloc!.id, toAlloc!.id, amount); p.onClose(); }
    finally { setBusy(false); }
  }

  return (
    <div onClick={p.onClose} style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(0,0,0,0.78)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 28,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "linear-gradient(160deg, #0f141d 0%, #080b11 100%)",
        border: "1px solid var(--blue-border)", borderRadius: 3,
        width: "100%", maxWidth: 540, padding: 0,
        display: "flex", flexDirection: "column",
      }}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--border)" }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.32em", color: "var(--blue)", fontFamily: MONO, marginBottom: 6 }}>
            ⚡ REALLOCATE
          </p>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--t1)" }}>
            Move money between categories
          </h2>
        </div>

        <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* FROM */}
          <Picker
            label="MOVE FROM"
            value={from}
            allocations={p.allocations}
            spendByCategory={p.spendByCategory}
            onChange={setFrom}
          />

          {/* Amount */}
          <div>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.32em", color: "var(--t3)", fontFamily: MONO, marginBottom: 6 }}>
              AMOUNT
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 2, padding: "8px 12px" }}>
              <span style={{ fontSize: 14, color: "var(--t3)", fontFamily: MONO }}>$</span>
              <input
                type="number"
                value={amt}
                autoFocus
                onChange={e => setAmt(e.target.value)}
                placeholder="0.00"
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--t1)", fontFamily: MONO, fontSize: 16 }}
              />
            </div>
            {fromAlloc && amount > fromAlloc.budgeted && (
              <p style={{ fontSize: 11, color: "var(--red)", fontFamily: MONO, letterSpacing: "0.1em", marginTop: 4 }}>
                ⚠ EXCEEDS {fromAlloc.category} BUDGET (${fmtInt(fromAlloc.budgeted)})
              </p>
            )}
          </div>

          {/* TO */}
          <Picker
            label="MOVE TO"
            value={to}
            allocations={p.allocations.filter(a => a.id !== from)}
            spendByCategory={p.spendByCategory}
            onChange={setTo}
          />

          {/* Preview */}
          {valid && (
            <div style={{
              background: "var(--blue-dim)", border: "1px solid var(--blue-border)",
              borderRadius: 2, padding: "10px 14px",
              fontSize: 12, color: "var(--t1)", lineHeight: 1.6,
            }}>
              <span style={{ fontFamily: MONO, color: "var(--blue)" }}>→ </span>
              {fromAlloc!.category}: ${fmtInt(fromAlloc!.budgeted)} → ${fmtInt(fromAlloc!.budgeted - amount)}
              <br />
              <span style={{ fontFamily: MONO, color: "var(--blue)" }}>→ </span>
              {toAlloc!.category}: ${fmtInt(toAlloc!.budgeted)} → ${fmtInt(toAlloc!.budgeted + amount)}
            </div>
          )}
        </div>

        <div style={{ padding: "14px 22px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={p.onClose} style={{
            background: "transparent", border: "1px solid var(--border)",
            color: "var(--t3)", padding: "7px 14px", borderRadius: 2, cursor: "pointer",
            fontFamily: MONO, fontSize: 10, letterSpacing: "0.18em", fontWeight: 700,
          }}>CANCEL</button>
          <button onClick={handleApply} disabled={!valid || busy} style={{
            background: valid ? "var(--blue-dim)" : "var(--surface2)",
            border: "1px solid var(--blue-border)",
            color: valid ? "var(--blue)" : "var(--t4)",
            padding: "7px 16px", borderRadius: 2,
            cursor: valid && !busy ? "pointer" : "default",
            fontFamily: MONO, fontSize: 10, letterSpacing: "0.18em", fontWeight: 700,
            opacity: valid ? 1 : 0.5,
          }}>
            {busy ? "MOVING…" : "MOVE"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface PickerProps {
  label:           string;
  value:           string;
  allocations:     Allocation[];
  spendByCategory: Record<string, number>;
  onChange:        (id: string) => void;
}

function Picker({ label, value, allocations, spendByCategory, onChange }: PickerProps) {
  return (
    <div>
      <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.32em", color: "var(--t3)", fontFamily: MONO, marginBottom: 6 }}>
        {label}
      </p>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: "100%",
          background: "var(--surface2)", border: "1px solid var(--border2)",
          borderRadius: 2, padding: "8px 12px",
          color: "var(--t1)", fontSize: 13, outline: "none", cursor: "pointer",
        }}
      >
        <option value="">— pick a category —</option>
        {allocations.map(a => {
          const spent = spendByCategory[a.category] ?? 0;
          const remaining = a.budgeted - spent;
          return (
            <option key={a.id} value={a.id}>
              {a.category} — ${fmtInt(a.budgeted)} budgeted, ${fmtInt(remaining)} left
            </option>
          );
        })}
      </select>
    </div>
  );
}
