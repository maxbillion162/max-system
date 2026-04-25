"use client";

import { useMemo } from "react";
import { Sparkline } from "@/components/ui/Sparkline";

const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

interface BudgetCategoryCardProps {
  category:        string;
  color:           string;
  budgeted:        number;
  spent:           number;
  rollover:        boolean;
  monthlyHistory?: number[];   // last 6 months of spend in this category
  classification?: "need" | "want" | "savings" | "investment";
  onEdit:          () => void;
  onToggleRollover: (next: boolean) => void;
}

const CLASSIFICATION_THEME: Record<string, { label: string; color: string }> = {
  need:       { label: "NEED",       color: "#5FB07D" },
  want:       { label: "WANT",       color: "#B89A6E" },
  savings:    { label: "SAVINGS",    color: "#7DB8E8" },
  investment: { label: "INVEST",     color: "#9B7BC2" },
};

function fmtInt(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function BudgetCategoryCard(p: BudgetCategoryCardProps) {
  const remaining = p.budgeted - p.spent;
  const pct = p.budgeted > 0 ? (p.spent / p.budgeted) * 100 : 0;
  const status = pct >= 100 ? "var(--red)" : pct >= 80 ? "#B89A6E" : "var(--green)";
  const statusLabel = pct >= 100 ? "OVER" : pct >= 80 ? "TIGHT" : "OK";

  const history = useMemo(() => p.monthlyHistory && p.monthlyHistory.length >= 2 ? p.monthlyHistory : null, [p.monthlyHistory]);

  // Trend computed from last 2 months
  const trend = useMemo(() => {
    if (!history || history.length < 2) return null;
    const last = history[history.length - 1];
    const prev = history[history.length - 2];
    if (prev === 0) return null;
    return ((last - prev) / prev) * 100;
  }, [history]);

  const themeLabel = p.classification ? CLASSIFICATION_THEME[p.classification] : null;

  return (
    <div
      style={{
        background: "linear-gradient(160deg, #0f141d 0%, #080b11 100%)",
        border: `1px solid ${p.color}24`,
        borderRadius: 3,
        padding: "14px 16px",
        display: "flex", flexDirection: "column", gap: 10,
        cursor: "pointer",
        transition: "border-color .15s, background .15s",
        position: "relative",
      }}
      onClick={p.onEdit}
      onMouseEnter={e => { e.currentTarget.style.borderColor = `${p.color}55`; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = `${p.color}24`; }}
    >
      {/* Top: name + classification + status */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
          <span style={{ width: 6, height: 6, background: p.color, borderRadius: 1, flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--t1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {p.category}
          </span>
          {themeLabel && (
            <span style={{
              fontSize: 8, fontFamily: MONO, letterSpacing: "0.18em", fontWeight: 700,
              color: themeLabel.color, marginLeft: 2,
            }}>
              {themeLabel.label}
            </span>
          )}
        </div>
        <span style={{ fontSize: 9, fontFamily: MONO, fontWeight: 700, letterSpacing: "0.2em", color: status }}>
          {statusLabel}
        </span>
      </div>

      {/* Numbers */}
      <div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 18, fontWeight: 600, fontFamily: MONO, color: "var(--t1)", letterSpacing: "-0.01em" }}>
            ${fmtInt(p.spent)}
          </span>
          <span style={{ fontSize: 10, color: "var(--t4)", fontFamily: MONO }}>
            of ${fmtInt(p.budgeted)}
          </span>
        </div>
        <div style={{ height: 2, borderRadius: 1, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
          <div style={{
            height: "100%",
            width: `${Math.min(100, pct)}%`,
            background: status,
            transition: "width 0.6s ease",
          }} />
        </div>
      </div>

      {/* Bottom: remaining + trend + sparkline */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
        <div>
          <p style={{
            fontSize: 12, fontWeight: 600, fontFamily: MONO,
            color: remaining >= 0 ? "var(--t2)" : "var(--red)",
          }}>
            {remaining >= 0 ? `$${fmtInt(remaining)}` : `−$${fmtInt(Math.abs(remaining))}`}
          </p>
          <p style={{ fontSize: 9, color: "var(--t4)", fontFamily: MONO, letterSpacing: "0.14em" }}>
            {remaining >= 0 ? "REMAINING" : "OVER"}
          </p>
        </div>
        {history ? (
          <div style={{ width: 70, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
            <Sparkline data={history} color={p.color} height={24} id={`bcc-${p.category}`} showArea />
            {trend !== null && (
              <span style={{
                fontSize: 9, fontFamily: MONO, letterSpacing: "0.1em",
                color: trend > 0 ? "var(--red)" : trend < 0 ? "var(--green)" : "var(--t4)",
              }}>
                {trend > 0 ? "▲" : trend < 0 ? "▼" : "·"} {Math.abs(trend).toFixed(0)}% MoM
              </span>
            )}
          </div>
        ) : (
          <span style={{ fontSize: 9, color: "var(--t4)", fontFamily: MONO, letterSpacing: "0.12em" }}>
            no history
          </span>
        )}
      </div>

      {/* Rollover toggle (footer) */}
      <div
        onClick={(e) => { e.stopPropagation(); p.onToggleRollover(!p.rollover); }}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          borderTop: "1px solid var(--border)",
          paddingTop: 8,
          fontSize: 9, fontFamily: MONO, letterSpacing: "0.16em",
          color: p.rollover ? "var(--blue)" : "var(--t4)",
          cursor: "pointer",
        }}
      >
        <span style={{
          width: 22, height: 12, borderRadius: 8,
          background: p.rollover ? "var(--blue-dim)" : "var(--surface2)",
          border: `1px solid ${p.rollover ? "var(--blue-border)" : "var(--border2)"}`,
          position: "relative",
          transition: "background .15s",
        }}>
          <span style={{
            position: "absolute", top: 1, left: p.rollover ? 12 : 1,
            width: 8, height: 8, borderRadius: "50%",
            background: p.rollover ? "var(--blue)" : "var(--t3)",
            transition: "left .15s",
          }} />
        </span>
        ROLLOVER
      </div>
    </div>
  );
}
