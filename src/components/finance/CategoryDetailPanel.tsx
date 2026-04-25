"use client";

import { useEffect, useMemo, useState } from "react";
import { Sparkline } from "@/components/ui/Sparkline";

const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

type Classification = "need" | "want" | "savings" | "investment";

interface Transaction {
  id:           string | number;
  date:         string;
  amount:       number;
  merchant:     string;
  category:     string;
  budget_category?: string | null;
  pending?:     boolean;
}

interface Allocation {
  id:        string;
  category:  string;
  budgeted:  number;
  rollover?: boolean;
}

interface Props {
  open:                    boolean;
  category:                string | null;
  alloc:                   Allocation | null;
  spent:                   number;
  monthlyHistory:          number[];
  classification:          Classification;
  color:                   string;
  transactions:            Transaction[];
  onClose:                 () => void;
  onUpdateBudgeted:        (budgeted: number) => Promise<void>;
  onUpdateRollover:        (next: boolean) => Promise<void>;
  onClassify:              (type: Classification) => Promise<void>;
  onDelete:                () => Promise<void>;
}

const CLASS_THEME: Record<Classification, { color: string; label: string }> = {
  need:       { color: "#5FB07D", label: "NEED" },
  want:       { color: "#B89A6E", label: "WANT" },
  savings:    { color: "#7DB8E8", label: "SAVINGS" },
  investment: { color: "#9B7BC2", label: "INVESTMENT" },
};

function fmtInt(n: number): string { return Math.round(n).toLocaleString("en-US"); }
function fmt(n: number): string { return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

const CLASS_KEYS: Classification[] = ["need", "want", "savings", "investment"];

export function CategoryDetailPanel(p: Props) {
  const [budgetDraft, setBudgetDraft] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    setBudgetDraft(p.alloc ? String(p.alloc.budgeted) : "");
    setConfirmingDelete(false);
  }, [p.alloc?.id, p.alloc?.budgeted]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape" && p.open) p.onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [p.open, p.onClose]);

  const remaining = (p.alloc?.budgeted ?? 0) - p.spent;
  const pct = p.alloc && p.alloc.budgeted > 0 ? (p.spent / p.alloc.budgeted) * 100 : 0;

  const matchingTxns = useMemo(() => {
    if (!p.category) return [];
    return p.transactions
      .filter(t => !t.pending && t.amount > 0
        && (t.budget_category === p.category || t.category === p.category))
      .slice(0, 30);
  }, [p.transactions, p.category]);

  const stats = useMemo(() => {
    const valid = p.monthlyHistory.filter(v => v > 0);
    if (valid.length === 0) return null;
    const avg = valid.reduce((s, v) => s + v, 0) / valid.length;
    const max = Math.max(...valid);
    const min = Math.min(...valid);
    return { avg, max, min };
  }, [p.monthlyHistory]);

  async function commitBudget() {
    if (!p.alloc) return;
    const next = Math.max(0, parseFloat(budgetDraft) || 0);
    if (next === p.alloc.budgeted) return;
    setSaving(true);
    try { await p.onUpdateBudgeted(next); }
    finally { setSaving(false); }
  }

  if (!p.open || !p.alloc || !p.category) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={p.onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 90,
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
        }}
      />
      {/* Panel */}
      <aside style={{
        position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 91,
        width: "100%", maxWidth: 460,
        background: "linear-gradient(160deg, #0f141d 0%, #06080f 100%)",
        borderLeft: "1px solid var(--blue-border)",
        boxShadow: "-12px 0 40px rgba(0,0,0,0.5)",
        display: "flex", flexDirection: "column",
        animation: "slideInRight 0.18s ease-out",
      }}>
        <style>{`@keyframes slideInRight { from { transform: translateX(40px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }`}</style>

        {/* Header */}
        <div style={{
          padding: "18px 22px",
          borderBottom: "1px solid var(--border)",
          display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 1, background: p.color }} />
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.32em", color: CLASS_THEME[p.classification].color, fontFamily: MONO }}>
                {CLASS_THEME[p.classification].label}
              </span>
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--t1)", letterSpacing: "-0.01em" }}>{p.category}</h2>
          </div>
          <button onClick={p.onClose} style={{
            background: "transparent", border: "1px solid var(--border)",
            color: "var(--t3)", padding: "5px 9px", borderRadius: 2, cursor: "pointer",
            fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em",
          }}>✕ ESC</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Status: progress bar + headline numbers */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <span style={{ fontSize: 22, fontWeight: 600, fontFamily: MONO, color: "var(--t1)", letterSpacing: "-0.01em" }}>
                ${fmtInt(p.spent)}<span style={{ fontSize: 11, color: "var(--t4)", marginLeft: 5 }}>of ${fmtInt(p.alloc.budgeted)}</span>
              </span>
              <span style={{
                fontSize: 11, fontFamily: MONO, fontWeight: 700,
                color: pct >= 100 ? "var(--red)" : pct >= 80 ? "#B89A6E" : "var(--green)",
                letterSpacing: "0.1em",
              }}>
                {Math.round(pct)}%
              </span>
            </div>
            <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 1, overflow: "hidden" }}>
              <div style={{
                width: `${Math.min(100, pct)}%`,
                height: "100%", transition: "width 0.4s",
                background: pct >= 100 ? "var(--red)" : pct >= 80 ? "#B89A6E" : "var(--green)",
              }} />
            </div>
            <p style={{
              marginTop: 6, fontSize: 11, fontFamily: MONO, letterSpacing: "0.06em",
              color: remaining >= 0 ? "var(--t3)" : "var(--red)",
            }}>
              {remaining >= 0 ? `$${fmtInt(remaining)} remaining` : `−$${fmtInt(Math.abs(remaining))} over budget`}
            </p>
          </div>

          {/* 6-month sparkline */}
          {p.monthlyHistory.length >= 2 && (
            <div>
              <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.32em", color: "var(--t3)", fontFamily: MONO, marginBottom: 6 }}>
                6-MONTH SPEND
              </p>
              <Sparkline data={p.monthlyHistory} color={p.color} height={56} id={`detail-${p.alloc.id}`} />
              {stats && (
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 10, fontFamily: MONO, letterSpacing: "0.1em", color: "var(--t3)" }}>
                  <span>AVG ${fmtInt(stats.avg)}</span>
                  <span>MAX ${fmtInt(stats.max)}</span>
                  <span>MIN ${fmtInt(stats.min)}</span>
                </div>
              )}
            </div>
          )}

          {/* Edit form */}
          <div style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: 3, padding: "14px 16px",
            display: "flex", flexDirection: "column", gap: 12,
          }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.32em", color: "var(--blue)", fontFamily: MONO }}>
              SETTINGS
            </p>

            {/* Budget */}
            <div>
              <p style={{ fontSize: 10, color: "var(--t3)", fontFamily: MONO, letterSpacing: "0.18em", marginBottom: 6 }}>
                MONTHLY BUDGET
              </p>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 14, color: "var(--t3)", fontFamily: MONO }}>$</span>
                <input
                  type="number"
                  value={budgetDraft}
                  onChange={e => setBudgetDraft(e.target.value)}
                  onBlur={commitBudget}
                  onKeyDown={e => { if (e.key === "Enter") commitBudget(); }}
                  style={{
                    flex: 1, background: "var(--surface2)",
                    border: "1px solid var(--border2)", borderRadius: 2,
                    padding: "7px 10px", fontSize: 14,
                    color: "var(--t1)", fontFamily: MONO, outline: "none",
                  }}
                />
                {saving && <span style={{ fontSize: 10, color: "var(--t4)", fontFamily: MONO, letterSpacing: "0.14em" }}>SAVING…</span>}
              </div>
            </div>

            {/* Classification */}
            <div>
              <p style={{ fontSize: 10, color: "var(--t3)", fontFamily: MONO, letterSpacing: "0.18em", marginBottom: 6 }}>
                CLASSIFICATION
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4 }}>
                {CLASS_KEYS.map(k => {
                  const theme = CLASS_THEME[k];
                  const active = p.classification === k;
                  return (
                    <button
                      key={k}
                      onClick={() => p.onClassify(k)}
                      style={{
                        padding: "7px 4px", borderRadius: 2,
                        background: active ? `${theme.color}18` : "transparent",
                        border: `1px solid ${active ? `${theme.color}55` : "var(--border)"}`,
                        color: active ? theme.color : "var(--t3)",
                        cursor: "pointer", fontFamily: MONO,
                        fontSize: 9, letterSpacing: "0.18em", fontWeight: 700,
                      }}
                    >
                      {theme.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Rollover toggle */}
            <div
              onClick={() => p.onUpdateRollover(!p.alloc!.rollover)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                cursor: "pointer", padding: "4px 0",
              }}
            >
              <div>
                <p style={{ fontSize: 10, color: "var(--t3)", fontFamily: MONO, letterSpacing: "0.18em", marginBottom: 2 }}>
                  ROLLOVER
                </p>
                <p style={{ fontSize: 11, color: "var(--t4)" }}>
                  Carry unspent amount to next month
                </p>
              </div>
              <span style={{
                width: 28, height: 14, borderRadius: 8,
                background: p.alloc.rollover ? "var(--blue-dim)" : "var(--surface2)",
                border: `1px solid ${p.alloc.rollover ? "var(--blue-border)" : "var(--border2)"}`,
                position: "relative", flexShrink: 0,
              }}>
                <span style={{
                  position: "absolute", top: 1, left: p.alloc.rollover ? 14 : 1,
                  width: 10, height: 10, borderRadius: "50%",
                  background: p.alloc.rollover ? "var(--blue)" : "var(--t3)",
                  transition: "left .15s",
                }} />
              </span>
            </div>
          </div>

          {/* Transactions */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.32em", color: "var(--t3)", fontFamily: MONO }}>
                THIS MONTH · {matchingTxns.length} TRANSACTIONS
              </span>
            </div>
            {matchingTxns.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--t4)", padding: "10px 0", fontFamily: MONO, letterSpacing: "0.1em" }}>
                NONE YET
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {matchingTxns.map((t, i) => (
                  <div key={t.id} style={{
                    display: "flex", justifyContent: "space-between", padding: "8px 0",
                    borderBottom: i < matchingTxns.length - 1 ? "1px solid var(--border)" : "none",
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 12, color: "var(--t1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {t.merchant}
                      </p>
                      <p style={{ fontSize: 9, color: "var(--t4)", fontFamily: MONO, letterSpacing: "0.1em", marginTop: 1 }}>
                        {new Date(t.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    </div>
                    <span style={{ fontSize: 12, fontFamily: MONO, color: "var(--red)" }}>
                      −${fmt(t.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Delete */}
          <div style={{ marginTop: "auto", paddingTop: 16, borderTop: "1px solid var(--border)" }}>
            {confirmingDelete ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "var(--red)", fontFamily: MONO, letterSpacing: "0.14em", flex: 1 }}>
                  CONFIRM DELETE?
                </span>
                <button onClick={() => setConfirmingDelete(false)} style={btn("var(--t3)")}>CANCEL</button>
                <button onClick={async () => { await p.onDelete(); }} style={btn("var(--red)")}>DELETE</button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmingDelete(true)}
                style={{
                  background: "transparent", border: "1px solid rgba(200,90,90,0.3)",
                  color: "var(--red)", padding: "7px 12px", borderRadius: 2, cursor: "pointer",
                  fontFamily: MONO, fontSize: 10, letterSpacing: "0.18em", fontWeight: 700,
                }}
              >
                DELETE CATEGORY
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

function btn(color: string): React.CSSProperties {
  return {
    background: "transparent", border: "1px solid var(--border)",
    color, padding: "5px 10px", borderRadius: 2, cursor: "pointer",
    fontFamily: MONO, fontSize: 10, letterSpacing: "0.18em", fontWeight: 700,
  };
}
