"use client";

import { Sparkline } from "@/components/ui/Sparkline";
import type { WealthSnapshot } from "@/types/finance";

const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

function formatUsd(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}
function formatUsdShort(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${n < 0 ? "−" : ""}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000)    return `${n < 0 ? "−" : ""}$${(abs / 1_000).toFixed(1)}K`;
  return `${n < 0 ? "−" : ""}$${abs.toFixed(0)}`;
}

interface LiveStatusBarProps {
  netWorth:        number;
  delta24h:        number;
  delta24hPct:     number;
  history30d:      WealthSnapshot[];
  cashFlowRunwayDays: number | null;   // null when not enough data
  readyToAssign:   number | null;      // null when no budget set
}

export function LiveStatusBar(p: LiveStatusBarProps) {
  const sparkData = p.history30d
    .slice()
    .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())
    .map(h => h.net_worth);

  return (
    <div style={{
      background: "linear-gradient(160deg, #0f141d 0%, #080b11 100%)",
      border: "1px solid rgba(125,184,232,0.10)", borderRadius: 3,
      padding: "18px 22px",
      display: "grid",
      gridTemplateColumns: "minmax(220px, 1.4fr) 1fr 1fr 1fr",
      gap: 28, alignItems: "stretch",
    }}>
      {/* Net Worth headline */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, borderRight: "1px solid var(--border)", paddingRight: 24 }}>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.32em", color: "var(--blue)", fontFamily: MONO }}>
          NET WORTH
        </span>
        <p style={{
          fontSize: 32, fontWeight: 600, color: "var(--t1)",
          fontFamily: MONO, letterSpacing: "-0.02em", lineHeight: 1,
        }}>
          {formatUsd(p.netWorth)}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
          <span style={{
            fontSize: 11, fontFamily: MONO,
            color: p.delta24h >= 0 ? "var(--green)" : "var(--red)",
          }}>
            {p.delta24h >= 0 ? "▲" : "▼"} {formatUsdShort(Math.abs(p.delta24h))} ({p.delta24hPct >= 0 ? "+" : ""}{p.delta24hPct.toFixed(2)}%)
          </span>
          <span style={{ fontSize: 9, color: "var(--t4)", fontFamily: MONO, letterSpacing: "0.16em" }}>24H</span>
        </div>
        {sparkData.length >= 2 && (
          <div style={{ marginTop: 6 }}>
            <Sparkline
              data={sparkData}
              color={p.delta24h >= 0 ? "#5FB07D" : "#C85A5A"}
              height={36}
              id="lsb-30d"
            />
          </div>
        )}
      </div>

      {/* Cash Flow Runway */}
      <Stat
        label="CASH FLOW RUNWAY"
        value={p.cashFlowRunwayDays !== null ? `${p.cashFlowRunwayDays}d` : "—"}
        sub={p.cashFlowRunwayDays !== null
          ? "if income stopped today"
          : "needs more transaction history"}
        accent="#7DB8E8"
      />

      {/* Ready to Assign */}
      <Stat
        label="READY TO ASSIGN"
        value={p.readyToAssign !== null ? formatUsd(p.readyToAssign) : "—"}
        sub={p.readyToAssign !== null
          ? p.readyToAssign > 0 ? "needs allocation" : "fully allocated"
          : "no budget set yet"}
        accent={p.readyToAssign !== null && p.readyToAssign > 0 ? "#B89A6E" : "#5FB07D"}
      />

      {/* 30D trend */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.32em", color: "var(--t3)", fontFamily: MONO }}>
          30D TREND
        </span>
        {sparkData.length >= 2 ? (
          <>
            <p style={{
              fontSize: 18, fontWeight: 500, color: "var(--t1)",
              fontFamily: MONO, lineHeight: 1, letterSpacing: "-0.02em",
            }}>
              {(() => {
                const first = sparkData[0];
                const last = sparkData[sparkData.length - 1];
                const pct = first ? ((last - first) / first) * 100 : 0;
                return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
              })()}
            </p>
            <span style={{ fontSize: 10, color: "var(--t4)", fontFamily: MONO }}>
              {sparkData.length} snapshots
            </span>
          </>
        ) : (
          <p style={{ fontSize: 11, color: "var(--t4)" }}>Building history…</p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.32em", color: "var(--t3)", fontFamily: MONO }}>
        {label}
      </span>
      <p style={{
        fontSize: 22, fontWeight: 500, color: accent,
        fontFamily: MONO, letterSpacing: "-0.02em", lineHeight: 1,
      }}>
        {value}
      </p>
      <span style={{ fontSize: 10, color: "var(--t4)", fontFamily: MONO, letterSpacing: "0.05em" }}>
        {sub}
      </span>
    </div>
  );
}
