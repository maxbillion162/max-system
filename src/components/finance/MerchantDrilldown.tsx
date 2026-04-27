"use client";

import { useEffect, useState } from "react";

const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

interface TxRow {
  id?:                  string | number;
  plaid_transaction_id: string;
  date:                 string;
  amount:               number;
  merchant:             string;
  category:             string | null;
  budget_category:      string | null;
  source:               string;
}

interface MerchantStats {
  merchant:         string;
  merchant_pattern: string;
  txn_count:        number;
  total_spent:      number;
  avg:              number;
  first:            string;
  last:             string;
  current_category: string;
  history:          TxRow[];
  monthly_totals:   { month: string; total: number }[];
}

const ALL_CATEGORIES = [
  "Housing", "Food", "Transport", "Entertainment", "Subscriptions",
  "Savings", "Health", "Shopping", "Personal", "Investing", "Misc",
];

function fmtUsd(n: number): string {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}
function fmtUsd2(n: number): string {
  return `$${n.toFixed(2)}`;
}
function fmtMonth(ym: string): string {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

interface Props {
  merchant: string;          // lowercased pattern
  onClose:  () => void;
  onCategoryChanged?: () => void;
}

export function MerchantDrilldown({ merchant, onClose, onCategoryChanged }: Props) {
  const [data, setData] = useState<MerchantStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingCat, setSavingCat] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/finance/merchant-stats/${encodeURIComponent(merchant)}`);
        const json = await res.json();
        if (alive && !json.error) setData(json);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [merchant]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function changeCategory(newCat: string) {
    if (!data || newCat === data.current_category) return;
    setSavingCat(true);
    try {
      const res = await fetch(`/api/finance/merchant-stats/${encodeURIComponent(merchant)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ category: newCat, create_rule: true }),
      });
      if (res.ok) {
        setData(d => d ? { ...d, current_category: newCat } : d);
        onCategoryChanged?.();
      }
    } finally {
      setSavingCat(false);
    }
  }

  /* Sparkline of monthly totals */
  const monthlyVals = data?.monthly_totals ?? [];
  const max = Math.max(1, ...monthlyVals.map(m => m.total));
  const sparkW = 280, sparkH = 60;

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "linear-gradient(160deg, #0f141d 0%, #080b11 100%)",
        border: "1px solid var(--blue-border)",
        borderRadius: 3, width: "min(900px, 92vw)", maxHeight: "88vh",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.32em", color: "var(--blue)", fontFamily: MONO }}>
              MERCHANT DRILLDOWN
            </span>
            <p style={{ fontSize: 22, fontWeight: 600, color: "var(--t1)", marginTop: 4, fontFamily: MONO, letterSpacing: "-0.02em" }}>
              {data?.merchant ?? merchant}
            </p>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "1px solid var(--border)", borderRadius: 2,
            padding: "6px 10px", color: "var(--t3)", cursor: "pointer",
            fontFamily: MONO, fontSize: 11, letterSpacing: "0.16em",
          }}>× CLOSE</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 22px" }}>
          {loading && <p style={{ color: "var(--t4)", fontFamily: MONO, fontSize: 11, padding: "20px 0" }}>loading…</p>}

          {!loading && data && data.txn_count === 0 && (
            <p style={{ color: "var(--t3)", padding: "20px 0" }}>No transactions found for this merchant.</p>
          )}

          {!loading && data && data.txn_count > 0 && (
            <>
              {/* Stat strip */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 14, marginBottom: 18 }}>
                <Tile label="TOTAL SPENT" value={fmtUsd(data.total_spent)} color="var(--t1)" />
                <Tile label="VISITS"      value={String(data.txn_count)} color="var(--t1)" />
                <Tile label="AVG / VISIT" value={fmtUsd2(data.avg)}     color="var(--blue)" />
                <Tile label="FIRST SEEN"  value={data.first} color="var(--t3)" mono />
                <Tile label="LAST SEEN"   value={data.last}  color="var(--t3)" mono />
              </div>

              {/* Sparkline */}
              {monthlyVals.length > 1 && (
                <div style={{ marginBottom: 18 }}>
                  <p style={{ fontSize: 9, color: "var(--t3)", letterSpacing: "0.18em", fontFamily: MONO, marginBottom: 8 }}>
                    MONTHLY SPEND — LAST {monthlyVals.length} MONTHS
                  </p>
                  <svg viewBox={`0 0 ${sparkW} ${sparkH}`} preserveAspectRatio="none" style={{ width: "100%", height: sparkH }}>
                    {monthlyVals.map((m, i) => {
                      const w = sparkW / monthlyVals.length;
                      const h = (m.total / max) * (sparkH - 14);
                      const x = i * w + w * 0.15;
                      const barW = w * 0.7;
                      const y = sparkH - h - 8;
                      return (
                        <g key={m.month}>
                          <rect x={x} y={y} width={barW} height={h} fill="#7DB8E8" opacity={0.7} />
                          <text x={x + barW / 2} y={sparkH - 1} fill="var(--t4)" fontSize="8" fontFamily={MONO}
                            textAnchor="middle" letterSpacing="0.06em">
                            {fmtMonth(m.month)}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              )}

              {/* Category control */}
              <div style={{ marginBottom: 18, padding: "12px 14px", background: "rgba(125,184,232,0.04)", border: "1px solid var(--border)", borderRadius: 3 }}>
                <p style={{ fontSize: 9, color: "var(--t3)", letterSpacing: "0.18em", fontFamily: MONO, marginBottom: 8 }}>
                  CATEGORY · APPLIES TO ALL TXNS HERE + CREATES A RULE
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {ALL_CATEGORIES.map(c => {
                    const on = data.current_category === c;
                    return (
                      <button key={c} onClick={() => changeCategory(c)} disabled={savingCat || on}
                        style={{
                          background: on ? "var(--blue-dim)" : "transparent",
                          border: `1px solid ${on ? "var(--blue-border)" : "var(--border)"}`,
                          color: on ? "var(--blue)" : "var(--t2)",
                          padding: "5px 11px", borderRadius: 2,
                          fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em",
                          cursor: savingCat || on ? "default" : "pointer",
                          opacity: savingCat ? 0.6 : 1,
                        }}>{c}</button>
                    );
                  })}
                </div>
              </div>

              {/* History table */}
              <p style={{ fontSize: 9, color: "var(--t3)", letterSpacing: "0.18em", fontFamily: MONO, marginBottom: 8 }}>
                LATEST 50 TRANSACTIONS
              </p>
              <div style={{ border: "1px solid var(--border)", borderRadius: 3 }}>
                <div style={{
                  display: "grid", gridTemplateColumns: "1fr 0.7fr 0.5fr",
                  padding: "8px 14px", borderBottom: "1px solid var(--border)",
                  fontSize: 9, color: "var(--t4)", letterSpacing: "0.18em", fontFamily: MONO,
                }}>
                  <span>DATE</span>
                  <span>SOURCE</span>
                  <span style={{ textAlign: "right" }}>AMOUNT</span>
                </div>
                {data.history.map((t, i) => (
                  <div key={String(t.id ?? t.plaid_transaction_id ?? i)} style={{
                    display: "grid", gridTemplateColumns: "1fr 0.7fr 0.5fr",
                    padding: "8px 14px", borderBottom: "1px solid var(--border)",
                    fontSize: 12, color: "var(--t2)", fontFamily: MONO,
                  }}>
                    <span>{t.date}</span>
                    <span style={{ color: "var(--t4)", fontSize: 11 }}>{t.source}</span>
                    <span style={{ textAlign: "right", color: t.amount > 0 ? "var(--t1)" : "var(--green)" }}>
                      {t.amount < 0 ? "+" : ""}{fmtUsd2(Math.abs(t.amount))}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value, color, mono }: { label: string; value: string; color: string; mono?: boolean }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.015)", border: "1px solid var(--border)", borderRadius: 3, padding: "10px 12px" }}>
      <p style={{ fontSize: 9, color: "var(--t4)", letterSpacing: "0.16em", fontFamily: MONO }}>{label}</p>
      <p style={{ fontSize: mono ? 12 : 18, color, marginTop: 4, fontFamily: MONO, fontWeight: 600 }}>{value}</p>
    </div>
  );
}
