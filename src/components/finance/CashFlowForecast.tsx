"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

interface DailyPoint {
  date:       string;
  cash:       number;
  is_actual:  boolean;
  milestone?: string;
}

interface ForecastResult {
  past:                    DailyPoint[];
  future:                  DailyPoint[];
  daily_burn:              number;
  daily_income:            number;
  daily_net:               number;
  recurring_total_monthly: number;
  baseline_cash:           number;
  horizon_days:            number;
}

function fmtUsdShort(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${n < 0 ? "−" : ""}$${(Math.abs(n)/1_000_000).toFixed(2)}M`;
  if (abs >= 1_000)     return `${n < 0 ? "−" : ""}$${(Math.abs(n)/1_000).toFixed(1)}K`;
  return `${n < 0 ? "−" : ""}$${Math.abs(n).toFixed(0)}`;
}
function fmtUsdFull(n: number): string {
  return `${n < 0 ? "−" : ""}$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}
function fmtDate(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function CashFlowForecast() {
  const [data, setData] = useState<ForecastResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/finance/forecast");
        const json = await res.json();
        if (alive && !json.error) setData(json);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  /* Combine past + future into a single series for drawing */
  const series = useMemo<DailyPoint[]>(() => {
    if (!data) return [];
    return [...data.past, ...data.future];
  }, [data]);

  const splitIdx = data?.past.length ?? 0;

  /* ── empty / loading states ── */
  if (loading) {
    return (
      <div style={shell()}>
        <Header title="CASH FLOW FORECAST" subtitle="loading…" />
        <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--t4)", fontFamily: MONO, fontSize: 11 }}>
          building 90-day projection…
        </div>
      </div>
    );
  }
  if (!data || series.length === 0) {
    return (
      <div style={shell()}>
        <Header title="CASH FLOW FORECAST" subtitle="not enough history" />
        <p style={{ padding: "30px 20px", textAlign: "center", color: "var(--t3)", fontSize: 12, lineHeight: 1.6 }}>
          Need 14+ days of transactions to project forward. Connect a bank or wait for the next sync.
        </p>
      </div>
    );
  }

  /* ── geometry ── */
  const W = 1000;
  const H = 280;
  const PAD = { top: 16, right: 14, bottom: 30, left: 56 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const cashVals = series.map(p => p.cash);
  const min = Math.min(0, ...cashVals);
  const max = Math.max(1, ...cashVals);
  const range = max - min || 1;

  const x = (i: number) => PAD.left + (i / (series.length - 1)) * innerW;
  const y = (v: number) => PAD.top + innerH - ((v - min) / range) * innerH;

  const splitX = x(Math.max(0, splitIdx - 1));

  /* tick set */
  const ticks = [0, 1, 2, 3, 4].map(i => min + (range / 4) * i);

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const idx = Math.round(((px - PAD.left) / innerW) * (series.length - 1));
    if (idx >= 0 && idx < series.length) setHoverIdx(idx);
  }

  /* path strings */
  const pastPoints = series
    .slice(0, splitIdx)
    .map((p, i) => `${x(i)},${y(p.cash)}`).join(" ");
  const futurePoints = series
    .slice(splitIdx === 0 ? 0 : splitIdx - 1)
    .map((p, i) => {
      const realIdx = (splitIdx === 0 ? 0 : splitIdx - 1) + i;
      return `${x(realIdx)},${y(p.cash)}`;
    }).join(" ");

  const areaPath =
    series.length > 1
      ? `M${x(0)},${y(min)} ` +
        series.map((p, i) => `L${x(i)},${y(p.cash)}`).join(" ") +
        ` L${x(series.length - 1)},${y(min)} Z`
      : "";

  const milestones = series
    .map((p, i) => p.milestone ? { i, label: p.milestone, point: p } : null)
    .filter((m): m is { i: number; label: string; point: DailyPoint } => !!m);

  const hover = hoverIdx !== null ? series[hoverIdx] : null;

  const todayPoint = series[splitIdx - 1] ?? series[series.length - 1];
  const endPoint   = series[series.length - 1];
  const projDelta  = endPoint && todayPoint ? endPoint.cash - todayPoint.cash : 0;

  return (
    <div style={shell()}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, padding: "16px 20px 0" }}>
        <div>
          <span style={label()}>CASH FLOW FORECAST</span>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginTop: 6 }}>
            <p style={{ fontSize: 26, fontWeight: 600, color: "var(--t1)", fontFamily: MONO, letterSpacing: "-0.02em", lineHeight: 1 }}>
              {fmtUsdFull(todayPoint?.cash ?? 0)}
            </p>
            <span style={{ fontSize: 11, fontFamily: MONO, color: projDelta >= 0 ? "var(--green)" : "var(--red)", letterSpacing: "0.06em" }}>
              {projDelta >= 0 ? "▲" : "▼"} {fmtUsdShort(Math.abs(projDelta))} <span style={{ color: "var(--t4)" }}>· proj {data.horizon_days}d</span>
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 18, fontFamily: MONO, fontSize: 10, color: "var(--t3)", letterSpacing: "0.14em" }}>
          <Stat label="DAILY BURN"   value={fmtUsdShort(data.daily_burn)}    color="var(--red)" />
          <Stat label="DAILY INCOME" value={fmtUsdShort(data.daily_income)}  color="var(--green)" />
          <Stat label="NET / DAY"    value={fmtUsdShort(data.daily_net)}     color={data.daily_net >= 0 ? "var(--green)" : "var(--red)"} />
          <Stat label="SUBS / MO"    value={fmtUsdShort(data.recurring_total_monthly)} color="var(--blue)" />
        </div>
      </div>

      {/* Chart */}
      <div style={{ position: "relative", width: "100%" }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          style={{ width: "100%", height: 280, display: "block" }}
          onMouseMove={onMove}
          onMouseLeave={() => setHoverIdx(null)}
        >
          <defs>
            <linearGradient id="forecast-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#7DB8E8" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#7DB8E8" stopOpacity="0"   />
            </linearGradient>
            <pattern id="forecast-future-pattern" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" stroke="#7DB8E8" strokeWidth="0.5" strokeOpacity="0.25" />
            </pattern>
          </defs>

          {/* y-axis grid */}
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={PAD.left} y1={y(t)} x2={W - PAD.right} y2={y(t)}
                stroke="var(--border)" strokeWidth="0.5" strokeDasharray="2 4" />
              <text x={PAD.left - 8} y={y(t) + 3} fill="var(--t4)" fontSize="9" fontFamily={MONO}
                textAnchor="end" letterSpacing="0.1em">
                {fmtUsdShort(t)}
              </text>
            </g>
          ))}

          {/* x-axis labels */}
          {[0, 0.33, 0.67, 1].map((t, i) => {
            const idx = Math.round(t * (series.length - 1));
            return (
              <text key={i} x={x(idx)} y={H - PAD.bottom + 18}
                fill="var(--t4)" fontSize="9" fontFamily={MONO}
                textAnchor="middle" letterSpacing="0.1em">
                {fmtDate(series[idx].date)}
              </text>
            );
          })}

          {/* shaded area */}
          {areaPath && <path d={areaPath} fill="url(#forecast-grad)" />}

          {/* future shaded zone overlay */}
          <rect x={splitX} y={PAD.top} width={W - PAD.right - splitX} height={innerH}
            fill="url(#forecast-future-pattern)" pointerEvents="none" />

          {/* zero line if visible */}
          {min < 0 && max > 0 && (
            <line x1={PAD.left} y1={y(0)} x2={W - PAD.right} y2={y(0)}
              stroke="var(--red)" strokeOpacity="0.4" strokeWidth="0.6" strokeDasharray="3 3" />
          )}

          {/* TODAY line */}
          <line x1={splitX} y1={PAD.top} x2={splitX} y2={H - PAD.bottom}
            stroke="var(--blue)" strokeWidth="1" strokeOpacity="0.55" strokeDasharray="2 4" />
          <text x={splitX + 4} y={PAD.top + 10} fill="var(--blue)" fontSize="9" fontFamily={MONO} letterSpacing="0.16em">
            TODAY
          </text>

          {/* past line */}
          <polyline points={pastPoints} fill="none" stroke="#7DB8E8" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" />

          {/* future line — same color, dashed */}
          <polyline points={futurePoints} fill="none" stroke="#7DB8E8" strokeWidth="1.6"
            strokeOpacity="0.85" strokeDasharray="4 4"
            strokeLinecap="round" strokeLinejoin="round" />

          {/* milestones */}
          {milestones.map((m, k) => (
            <g key={k}>
              <line x1={x(m.i)} y1={PAD.top} x2={x(m.i)} y2={H - PAD.bottom}
                stroke="var(--green)" strokeOpacity="0.5" strokeWidth="0.7" strokeDasharray="3 3" />
              <circle cx={x(m.i)} cy={y(m.point.cash)} r="4"
                fill="var(--green)" stroke="#06080f" strokeWidth="1" />
              <text x={x(m.i)} y={PAD.top - 4} fill="var(--green)" fontSize="9" fontFamily={MONO}
                textAnchor="middle" letterSpacing="0.12em">
                ★ {m.label.toUpperCase()}
              </text>
            </g>
          ))}

          {/* hover indicator */}
          {hover && hoverIdx !== null && (
            <>
              <line x1={x(hoverIdx)} y1={PAD.top} x2={x(hoverIdx)} y2={H - PAD.bottom}
                stroke="var(--blue)" strokeWidth="0.8" strokeOpacity="0.4" />
              <circle cx={x(hoverIdx)} cy={y(hover.cash)} r="3.5" fill="#7DB8E8"
                style={{ filter: "drop-shadow(0 0 4px #7DB8E8)" }} />
            </>
          )}
        </svg>

        {hover && (
          <div style={{
            position: "absolute", top: 8, right: 8, pointerEvents: "none",
            background: "rgba(6,8,15,0.92)", border: "1px solid var(--blue-border)",
            borderRadius: 3, padding: "8px 12px", minWidth: 170, backdropFilter: "blur(6px)",
          }}>
            <p style={{ fontSize: 9, color: "var(--t3)", fontFamily: MONO, letterSpacing: "0.16em", marginBottom: 6 }}>
              {new Date(hover.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }).toUpperCase()}
            </p>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
              <span style={{ color: "var(--t3)", fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em" }}>
                {hover.is_actual ? "ACTUAL" : "PROJECTED"}
              </span>
              <span style={{ color: "var(--t1)", fontFamily: MONO, fontSize: 12 }}>{fmtUsdFull(hover.cash)}</span>
            </div>
            {hover.milestone && (
              <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid var(--border)", color: "var(--green)", fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em" }}>
                ★ {hover.milestone.toUpperCase()}
              </div>
            )}
          </div>
        )}
      </div>

      {/* footer legend */}
      <div style={{ display: "flex", gap: 16, padding: "8px 20px 14px", borderTop: "1px solid var(--border)", fontFamily: MONO, fontSize: 9, letterSpacing: "0.16em", color: "var(--t4)" }}>
        <Legend swatch={<span style={{ display: "inline-block", width: 14, height: 2, background: "#7DB8E8" }} />} label="ACTUAL" />
        <Legend swatch={<span style={{ display: "inline-block", width: 14, height: 2, background: "#7DB8E8", borderTop: "1px dashed #7DB8E8" }} />} label="PROJECTED" />
        <Legend swatch={<span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "var(--green)" }} />} label="GOAL HIT" />
      </div>
    </div>
  );
}

/* ─── shared mini components ─── */
function shell(): React.CSSProperties {
  return {
    background: "linear-gradient(160deg, #0f141d 0%, #080b11 100%)",
    border: "1px solid rgba(125,184,232,0.10)",
    borderRadius: 3,
    display: "flex", flexDirection: "column", gap: 8,
  };
}
function label(): React.CSSProperties {
  return { fontSize: 9, fontWeight: 700, letterSpacing: "0.32em", color: "var(--blue)", fontFamily: MONO };
}
function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ padding: "16px 20px 0" }}>
      <span style={label()}>{title}</span>
      {subtitle && <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 4 }}>{subtitle}</p>}
    </div>
  );
}
function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <p style={{ fontSize: 9, color: "var(--t4)", letterSpacing: "0.16em" }}>{label}</p>
      <p style={{ fontSize: 14, color, marginTop: 2 }}>{value}</p>
    </div>
  );
}
function Legend({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {swatch} {label}
    </span>
  );
}
