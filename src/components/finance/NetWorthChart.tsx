"use client";

import { useState, useMemo, useRef } from "react";
import type { WealthSnapshot, ChartPeriod } from "@/types/finance";

const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

const PERIODS: { key: ChartPeriod; label: string; days: number | null }[] = [
  { key: "1M",  label: "1M",  days: 30 },
  { key: "3M",  label: "3M",  days: 90 },
  { key: "YTD", label: "YTD", days: null },     // year-to-date
  { key: "1Y",  label: "1Y",  days: 365 },
  { key: "ALL", label: "ALL", days: null },     // all available
];

const SERIES = [
  { key: "net_worth",    label: "NET WORTH",  color: "#7DB8E8" },
  { key: "savings",      label: "SAVINGS",    color: "#5FB07D" },
  { key: "crypto_total", label: "CRYPTO",     color: "#B89A6E" },
  { key: "ira_total",    label: "IRA",        color: "#9B7BC2" },
] as const;

type SeriesKey = (typeof SERIES)[number]["key"];

function formatUsdShort(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}
function formatUsdFull(n: number): string {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}
function formatDate(iso: string, period: ChartPeriod): string {
  const d = new Date(iso);
  if (period === "1M" || period === "3M") {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

interface NetWorthChartProps {
  history: WealthSnapshot[];
  loading?: boolean;
}

export function NetWorthChart({ history, loading }: NetWorthChartProps) {
  const [period, setPeriod] = useState<ChartPeriod>("3M");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [activeSeries, setActiveSeries] = useState<Set<SeriesKey>>(new Set(["net_worth"]));
  const svgRef = useRef<SVGSVGElement>(null);

  const filtered = useMemo(() => {
    if (history.length === 0) return [];
    const cfg = PERIODS.find(p => p.key === period);
    if (!cfg) return history;

    let cutoff: Date;
    if (cfg.key === "YTD") {
      cutoff = new Date(new Date().getFullYear(), 0, 1);
    } else if (cfg.days) {
      cutoff = new Date(Date.now() - cfg.days * 24 * 60 * 60 * 1000);
    } else {
      return history; // ALL
    }
    return history.filter(h => new Date(h.recorded_at) >= cutoff);
  }, [history, period]);

  const sorted = useMemo(() =>
    [...filtered].sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()),
    [filtered]
  );

  /* Geometry */
  const W = 1000;
  const H = 320;
  const PAD = { top: 18, right: 14, bottom: 32, left: 56 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const allValues = sorted.flatMap(s => Array.from(activeSeries).map(k => s[k as keyof WealthSnapshot] as number));
  const min = Math.min(0, ...allValues);
  const max = Math.max(1, ...allValues);
  const range = max - min || 1;

  function x(i: number): number {
    if (sorted.length <= 1) return PAD.left + innerW / 2;
    return PAD.left + (i / (sorted.length - 1)) * innerW;
  }
  function y(v: number): number {
    return PAD.top + innerH - ((v - min) / range) * innerH;
  }

  /* Mouse handler */
  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current || sorted.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const idx = Math.round(((px - PAD.left) / innerW) * (sorted.length - 1));
    if (idx >= 0 && idx < sorted.length) setHoverIdx(idx);
  }

  /* Y-axis ticks */
  const ticks = useMemo(() => {
    const step = range / 4;
    return [0, 1, 2, 3, 4].map(i => min + i * step);
  }, [min, range]);

  function toggleSeries(k: SeriesKey) {
    setActiveSeries(prev => {
      const next = new Set(prev);
      if (next.has(k)) {
        if (next.size > 1) next.delete(k); // don't allow zero series
      } else {
        next.add(k);
      }
      return next;
    });
  }

  const latest = sorted[sorted.length - 1];
  const first  = sorted[0];
  const delta  = latest && first ? latest.net_worth - first.net_worth : 0;
  const deltaPct = first && first.net_worth ? (delta / first.net_worth) * 100 : 0;

  /* ── Empty state ── */
  if (!loading && history.length === 0) {
    return (
      <div style={{
        background: "linear-gradient(160deg, #0f141d 0%, #080b11 100%)",
        border: "1px solid rgba(125,184,232,0.10)", borderRadius: 3,
        padding: "40px 24px", textAlign: "center",
        color: "var(--t3)", fontSize: 12, lineHeight: 1.6,
      }}>
        <p style={{ marginBottom: 4, color: "var(--t1)", fontWeight: 600 }}>No history yet</p>
        Net worth tracking starts the first day data is recorded. Snapshots run nightly.
      </div>
    );
  }

  const hover = hoverIdx !== null ? sorted[hoverIdx] : null;

  return (
    <div style={{
      background: "linear-gradient(160deg, #0f141d 0%, #080b11 100%)",
      border: "1px solid rgba(125,184,232,0.10)", borderRadius: 3,
      padding: "16px 18px",
      display: "flex", flexDirection: "column", gap: 12,
    }}>
      {/* Header: title + delta + period buttons */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.32em", color: "var(--blue)", fontFamily: MONO }}>
            NET WORTH
          </span>
          {latest && (
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 4 }}>
              <p style={{
                fontSize: 28, fontWeight: 600, color: "var(--t1)",
                fontFamily: MONO, letterSpacing: "-0.02em", lineHeight: 1,
              }}>
                {formatUsdFull(latest.net_worth)}
              </p>
              {sorted.length > 1 && (
                <span style={{
                  fontSize: 12, fontFamily: MONO,
                  color: delta >= 0 ? "var(--green)" : "var(--red)",
                }}>
                  {delta >= 0 ? "▲" : "▼"} {formatUsdShort(Math.abs(delta))} ({deltaPct >= 0 ? "+" : ""}{deltaPct.toFixed(1)}%)
                  <span style={{ color: "var(--t4)", marginLeft: 6 }}>· {period}</span>
                </span>
              )}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              style={{
                background: period === p.key ? "var(--blue-dim)" : "transparent",
                border: `1px solid ${period === p.key ? "var(--blue-border)" : "var(--border)"}`,
                color: period === p.key ? "var(--blue)" : "var(--t3)",
                padding: "5px 12px", borderRadius: 2, cursor: "pointer",
                fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em",
                transition: "color .15s, border-color .15s, background .15s",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div style={{ position: "relative", width: "100%" }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          style={{ width: "100%", height: 320, display: "block" }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIdx(null)}
        >
          {/* Y-axis grid + labels */}
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={PAD.left} y1={y(t)} x2={W - PAD.right} y2={y(t)}
                stroke="var(--border)" strokeWidth="0.5" strokeDasharray="2 4" />
              <text x={PAD.left - 8} y={y(t) + 3}
                fill="var(--t4)" fontSize="9" fontFamily={MONO}
                textAnchor="end" letterSpacing="0.1em">
                {formatUsdShort(t)}
              </text>
            </g>
          ))}

          {/* X-axis labels (4 evenly spaced) */}
          {sorted.length > 0 && [0, 0.33, 0.67, 1].map((t, i) => {
            const idx = Math.round(t * (sorted.length - 1));
            const s = sorted[idx];
            return (
              <text key={i} x={x(idx)} y={H - PAD.bottom + 18}
                fill="var(--t4)" fontSize="9" fontFamily={MONO}
                textAnchor="middle" letterSpacing="0.1em">
                {formatDate(s.recorded_at, period)}
              </text>
            );
          })}

          {/* Series */}
          {SERIES.filter(s => activeSeries.has(s.key)).map(s => {
            const points = sorted.map((d, i) => `${x(i)},${y(d[s.key as keyof WealthSnapshot] as number)}`).join(" ");
            const areaPath =
              sorted.length > 1
                ? `M${x(0)},${y(min)} ` + sorted.map((d, i) => `L${x(i)},${y(d[s.key as keyof WealthSnapshot] as number)}`).join(" ") + ` L${x(sorted.length - 1)},${y(min)} Z`
                : "";
            const gradId = `chart-grad-${s.key}`;
            const isPrimary = s.key === "net_worth";

            return (
              <g key={s.key}>
                <defs>
                  <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={s.color} stopOpacity={isPrimary ? 0.22 : 0.08} />
                    <stop offset="100%" stopColor={s.color} stopOpacity="0" />
                  </linearGradient>
                </defs>
                {isPrimary && areaPath && <path d={areaPath} fill={`url(#${gradId})`} />}
                <polyline points={points} fill="none" stroke={s.color}
                  strokeWidth={isPrimary ? 2 : 1.4}
                  strokeOpacity={isPrimary ? 1 : 0.7}
                  strokeLinecap="round" strokeLinejoin="round" />
              </g>
            );
          })}

          {/* Hover indicator */}
          {hover && hoverIdx !== null && (
            <>
              <line x1={x(hoverIdx)} y1={PAD.top} x2={x(hoverIdx)} y2={H - PAD.bottom}
                stroke="var(--blue)" strokeWidth="0.7" strokeOpacity="0.4" />
              {SERIES.filter(s => activeSeries.has(s.key)).map(s => (
                <circle key={s.key}
                  cx={x(hoverIdx)} cy={y(hover[s.key as keyof WealthSnapshot] as number)}
                  r="3.5" fill={s.color}
                  style={{ filter: `drop-shadow(0 0 4px ${s.color})` }} />
              ))}
            </>
          )}
        </svg>

        {/* Hover tooltip */}
        {hover && (
          <div style={{
            position: "absolute", top: 8, right: 8, pointerEvents: "none",
            background: "rgba(6,8,15,0.92)",
            border: "1px solid var(--blue-border)", borderRadius: 3,
            padding: "8px 12px", minWidth: 160,
            backdropFilter: "blur(6px)",
          }}>
            <p style={{ fontSize: 9, color: "var(--t3)", fontFamily: MONO, letterSpacing: "0.16em", marginBottom: 6 }}>
              {new Date(hover.recorded_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }).toUpperCase()}
            </p>
            {SERIES.filter(s => activeSeries.has(s.key)).map(s => (
              <div key={s.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, fontSize: 11, marginTop: 2 }}>
                <span style={{ color: s.color, fontFamily: MONO, letterSpacing: "0.1em" }}>{s.label}</span>
                <span style={{ color: "var(--t1)", fontFamily: MONO }}>
                  {formatUsdFull(hover[s.key as keyof WealthSnapshot] as number ?? 0)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Series toggles */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", borderTop: "1px solid var(--border)", paddingTop: 10 }}>
        {SERIES.map(s => {
          const on = activeSeries.has(s.key);
          return (
            <button
              key={s.key}
              onClick={() => toggleSeries(s.key)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: on ? `${s.color}11` : "transparent",
                border: `1px solid ${on ? s.color + "40" : "var(--border)"}`,
                borderRadius: 2, padding: "4px 10px",
                color: on ? s.color : "var(--t4)",
                cursor: "pointer", fontFamily: MONO,
                fontSize: 9, letterSpacing: "0.16em",
                transition: "all .15s",
              }}
            >
              <span style={{
                width: 8, height: 2, background: s.color, opacity: on ? 1 : 0.4,
              }} />
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
