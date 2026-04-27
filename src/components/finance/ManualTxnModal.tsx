"use client";

import { useEffect, useState } from "react";

const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

const CATEGORIES = [
  "Housing", "Food", "Transport", "Entertainment", "Subscriptions",
  "Savings", "Health", "Shopping", "Personal", "Investing", "Misc",
];

interface Props {
  open:    boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function ManualTxnModal({ open, onClose, onSaved }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate]         = useState(today);
  const [amount, setAmount]     = useState("");
  const [merchant, setMerchant] = useState("");
  const [category, setCategory] = useState("Misc");
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape" && open) onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const amt = parseFloat(amount);
      if (!Number.isFinite(amt) || amt === 0) { setErr("Amount required"); setSaving(false); return; }
      if (!merchant.trim()) { setErr("Merchant required"); setSaving(false); return; }

      const res = await fetch("/api/finance/manual-transaction", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          date, amount: amt, merchant: merchant.trim(), category,
        }),
      });
      const json = await res.json();
      if (json.error) { setErr(json.error); return; }

      /* Reset form */
      setAmount("");
      setMerchant("");
      setCategory("Misc");
      setDate(new Date().toISOString().slice(0, 10));
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "linear-gradient(160deg, #0f141d 0%, #080b11 100%)",
        border: "1px solid var(--blue-border)",
        borderRadius: 3, width: "min(440px, 92vw)",
        padding: "20px 22px",
        display: "flex", flexDirection: "column", gap: 14,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.32em", color: "var(--blue)", fontFamily: MONO }}>
              MANUAL TRANSACTION
            </span>
            <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 4, lineHeight: 1.4 }}>
              For cash spends Plaid can&apos;t see. Positive = outflow.
            </p>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "1px solid var(--border)", borderRadius: 2,
            padding: "4px 9px", color: "var(--t3)", cursor: "pointer",
            fontFamily: MONO, fontSize: 11,
          }}>×</button>
        </div>

        <Field label="DATE">
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle()} />
        </Field>

        <Field label="MERCHANT">
          <input value={merchant} onChange={e => setMerchant(e.target.value)} placeholder="e.g. Cash @ taqueria"
            style={inputStyle()} autoFocus />
        </Field>

        <Field label="AMOUNT">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "var(--t3)", fontFamily: MONO, fontSize: 14 }}>$</span>
            <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="0.00" style={inputStyle()} />
          </div>
        </Field>

        <Field label="CATEGORY">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {CATEGORIES.map(c => {
              const on = category === c;
              return (
                <button key={c} onClick={() => setCategory(c)}
                  style={{
                    background: on ? "var(--blue-dim)" : "transparent",
                    border: `1px solid ${on ? "var(--blue-border)" : "var(--border)"}`,
                    color: on ? "var(--blue)" : "var(--t3)",
                    padding: "4px 10px", borderRadius: 2,
                    fontFamily: MONO, fontSize: 10, letterSpacing: "0.12em", cursor: "pointer",
                  }}>{c}</button>
              );
            })}
          </div>
        </Field>

        {err && (
          <p style={{ fontSize: 11, color: "var(--red)", fontFamily: MONO, letterSpacing: "0.06em" }}>
            ⚠ {err}
          </p>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button onClick={onClose} style={{
            flex: 1, background: "transparent", border: "1px solid var(--border2)",
            color: "var(--t3)", padding: "9px 0", borderRadius: 2,
            fontFamily: MONO, fontSize: 11, letterSpacing: "0.18em", fontWeight: 700, cursor: "pointer",
          }}>CANCEL</button>
          <button onClick={save} disabled={saving} style={{
            flex: 2, background: "var(--blue-dim)", border: "1px solid var(--blue-border)",
            color: "var(--blue)", padding: "9px 0", borderRadius: 2,
            fontFamily: MONO, fontSize: 11, letterSpacing: "0.18em", fontWeight: 700,
            cursor: saving ? "default" : "pointer", opacity: saving ? 0.5 : 1,
          }}>{saving ? "SAVING…" : "✓ ADD TRANSACTION"}</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: 9, color: "var(--t3)", letterSpacing: "0.18em", fontFamily: MONO, marginBottom: 6 }}>{label}</p>
      {children}
    </div>
  );
}

function inputStyle(): React.CSSProperties {
  return {
    flex: 1, width: "100%",
    background: "var(--surface2)", border: "1px solid var(--border2)",
    borderRadius: 2, padding: "8px 10px",
    color: "var(--t1)", fontFamily: MONO, fontSize: 13, outline: "none",
  };
}
