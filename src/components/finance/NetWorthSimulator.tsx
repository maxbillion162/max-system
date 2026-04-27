"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

interface ForecastPoint {
  date:      string;
  cash:      number;
  is_actual: boolean;
  milestone?: string;
}

interface ForecastResult {
  past:                    ForecastPoint[];
  future:                  ForecastPoint[];
  daily_burn:              number;
  daily_income:            number;
  daily_net:               number;
  recurring_total_monthly: number;
  baseline_cash:           number;
  horizon_days:            number;
}

const HORIZONS = [
  { label: "3M",  days: 90 },
  { label: "6M",  days: 180 },
  { label: "1Y",  days: 365 },
  { label: "2Y",  days: 730 },
];

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
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

export function NetWorthSimulator() {
  const [horizon, setHorizon]                = useState(180);
  const [savingsDelta, setSavingsDelta]      = useState(0);          // $/mo
  const [salaryChange, setSalaryChange]      = useState<number>(0);  // monthly
  const [salaryDate, setSalaryDate]          = useState("2026-07-01");
  const [baseline, setBaseline]              = useState<ForecastResult | null>(null);
  const [scenario, setScenario]              = useState<ForecastResult | null>(null);
  const [loadingScen, setLoadingScen]        = useState(false);
  const [saved, setSaved]                    = useState(false);
  const [saving, setSaving]                  = useState(false);
  const [scenarioLabel, setScenarioLabel]    = useState("");
  const [hoverIdx, setHoverIdx]              = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  /* Load baseline once per horizon */
  useEffect(() => {
    let alive = true;
    setBaseline(null);
    (async () => {
      try {
        const res = await fetch("/api/finance/forecast", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ horizon_days: horizon }),
        });
        const json = await res.json();
        if (alive && !json.error) setBaseline(json);
      } catch { /* ignore */ }
    })();
    return () => { alive = false; };
  }, [horizon]);

  /* Refresh scenario whenever knobs change (debounced) */
  useEffect(() => {
    const knobs: Record<string, unknown> = {};
    if (savingsDelta !== 0) knobs.monthly_savings_delta = savingsDelta;
    if (salaryChange > 0)   knobs.salary_change = { effective_date: salaryDate, new_monthly: salaryChange };

    if (Object.keys(knobs).length === 0) {
      setScenario(null);
      return;
    }

    const handle = setTimeout(async () => {
      setLoadingScen(true);
      try {
        const res = await fetch("/api/finance/forecast", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ horizon_days: horizon, knobs }),
        });
        const json = await res.json();
        if (!json.error) setScenario(json);
      } finally {
        setLoadingScen(false);
      }
    }, 220);

    return () => clearTimeout(handle);
  }, [horizon, savingsDelta, salaryChange, salaryDate]);

  async function saveScenario() {
    if (!scenarioLabel.trim()) return;
    setSaving(true);
    try {
      const knobs: Record<string, unknown> = {};
      if (savingsDelta !== 0) knobs.monthly_savings_delta = savingsDelta;
      if (salaryChange > 0)   knobs.salary_change = { effective_date: salaryDate, new_monthly: salaryChange };
      const res = await fetch("/api/finance/scenarios", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          label: scenarioLabel.trim(),
          knobs,
          baseline_data: { horizon_days: horizon, baseline_cash: baseline?.baseline_cash },
        }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  }

  /* Combined series for drawing */
  const baseSeries  = useMemo(() => baseline ? [...baseline.past, ...baseline.future] : [], [baseline]);
  const scenSeries  = useMemo(() => scenario ? [...scenario.past, ...scenario.future] : [], [scenario]);
  const splitIdx    = baseline?.past.length ?? 0;

  /* Stats */
  const baseEnd = baseline?.future[baseline.future.length - 1]?.cash ?? 0;
  const scenEnd = scenario?.future[scenario.future.length - 1]?.cash ?? baseEnd;
  const delta   = scenEnd - baseEnd;

  /* Geometry */
  const W = 1000;
  const H = 280;
  const PAD = { top: 16, right: 14, bottom: 30, left: 56 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const allVals = [...baseSeries.map(p => p.cash), ...scenSeries.map(p => p.cash)];
  const min = Math.min(0, ...(allVals.length ? allVals : [0]));
  const max = Math.max(1, ...(allVals.length ? allVals : [1]));
  const range = max - min || 1;

  const x = (i: number, len: number) => PAD.left + (i / Math.max(1, len - 1)) * innerW;
  const y = (v: number) => PAD.top + innerH - ((v - min) / range) * innerH;

  function buildPoints(s: ForecastPoint[]): string {
    return s.map((p, i) => `${x(i, s.length)},${y(p.cash)}`).join(" ");
  }

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current || baseSeries.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const idx = Math.round(((px - PAD.left) / innerW) * (baseSeries.length - 1));
    if (idx >= 0 && idx < baseSeries.length) setHoverIdx(idx);
  }

  const ticks = [0, 1, 2, 3, 4].map(i => min + (range / 4) * i);
  const splitX = baseSeries.length > 1 ? x(Math.max(0, splitIdx - 1), baseSeries.length) : PAD.left;

  const hoverBase = hoverIdx !== null ? baseSeries[hoverIdx] : null;
  const hoverScen = hoverIdx !== null ? scenSeries[hoverIdx] : null;

  return (
    <div style={{
      background: "linear-gradient(160deg, #0f141d 0%, #080b11 100%)",
      border: "1px solid rgba(125,184,232,0.10)", borderRadius: 3,
      display: "flex", flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, padding: "16px 20px 12px" }}>
        <div>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.32em", color: "var(--blue)", fontFamily: MONO }}>
            TIME-TRAVEL SIMULATOR
          </span>
          <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 4, fontFamily: MONO, letterSpacing: "0.06em" }}>
            DRAG KNOBS · CHART RE-PROJECTS LIVE
          </p>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {HORIZONS.map(h => (
            <button key={h.days} onClick={() => setHorizon(h.days)} style={{
              background: horizon === h.days ? "var(--blue-dim)" : "transparent",
              border: `1px solid ${horizon === h.days ? "var(--blue-border)" : "var(--border)"}`,
              color: horizon === h.days ? "var(--blue)" : "var(--t3)",
              padding: "5px 12px", borderRadius: 2, cursor: "pointer",
              fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em",
            }}>{h.label}</button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div style={{ position: "relative", width: "100%" }}>
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
          style={{ width: "100%", height: 280, display: "block" }}
          onMouseMove={onMove} onMouseLeave={() => setHoverIdx(null)}>

          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={PAD.left} y1={y(t)} x2={W - PAD.right} y2={y(t)}
                stroke="var(--border)" strokeWidth="0.5" strokeDasharray="2 4" />
              <text x={PAD.left - 8} y={y(t) + 3} fill="var(--t4)" fontSize="9" fontFamily={MONO}
                textAnchor="end" letterSpacing="0.1em">{fmtUsdShort(t)}</text>
            </g>
          ))}

          {baseSeries.length > 0 && [0, 0.33, 0.67, 1].map((t, i) => {
            const idx = Math.round(t * (baseSeries.length - 1));
            return (
              <text key={i} x={x(idx, baseSeries.length)} y={H - PAD.bottom + 18}
                fill="var(--t4)" fontSize="9" fontFamily={MONO}
                textAnchor="middle" letterSpacing="0.1em">
                {fmtDate(baseSeries[idx].date)}
              </text>
            );
          })}

          {/* TODAY divider */}
          {baseSeries.length > 0 && (
            <>
              <line x1={splitX} y1={PAD.top} x2={splitX} y2={H - PAD.bottom}
                stroke="var(--blue)" strokeWidth="1" strokeOpacity="0.55" strokeDasharray="2 4" />
              <text x={splitX + 4} y={PAD.top + 10} fill="var(--blue)" fontSize="9" fontFamily={MONO} letterSpacing="0.16em">TODAY</text>
            </>
          )}

          {/* Salary-change marker */}
          {salaryChange > 0 && baseSeries.length > 0 && (() => {
            const idx = baseSeries.findIndex(p => p.date >= salaryDate);
            if (idx < 0) return null;
            const sx = x(idx, baseSeries.length);
            return (
              <g>
                <line x1={sx} y1={PAD.top} x2={sx} y2={H - PAD.bottom}
                  stroke="#9B7BC2" strokeWidth="0.8" strokeOpacity="0.6" strokeDasharray="3 3" />
                <text x={sx + 4} y={H - PAD.bottom - 6} fill="#9B7BC2" fontSize="9" fontFamily={MONO} letterSpacing="0.14em">SALARY</text>
              </g>
            );
          })()}

          {/* Baseline line */}
          {baseSeries.length > 1 && (
            <polyline points={buildPoints(baseSeries)} fill="none"
              stroke="#7DB8E8" strokeWidth="1.6" strokeOpacity="0.55"
              strokeLinecap="round" strokeLinejoin="round" />
          )}

          {/* Scenario line (overlay) */}
          {scenSeries.length > 1 && (
            <polyline points={buildPoints(scenSeries)} fill="none"
              stroke="#5FB07D" strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round" />
          )}

          {/* hover */}
          {hoverIdx !== null && hoverBase && (
            <>
              <line x1={x(hoverIdx, baseSeries.length)} y1={PAD.top} x2={x(hoverIdx, baseSeries.length)} y2={H - PAD.bottom}
                stroke="var(--blue)" strokeWidth="0.8" strokeOpacity="0.4" />
              <circle cx={x(hoverIdx, baseSeries.length)} cy={y(hoverBase.cash)} r="3.5" fill="#7DB8E8" />
              {hoverScen && <circle cx={x(hoverIdx, scenSeries.length)} cy={y(hoverScen.cash)} r="3.5" fill="#5FB07D" />}
            </>
          )}
        </svg>

        {hoverBase && (
          <div style={{
            position: "absolute", top: 8, right: 8, pointerEvents: "none",
            background: "rgba(6,8,15,0.92)", border: "1px solid var(--blue-border)",
            borderRadius: 3, padding: "8px 12px", minWidth: 180, backdropFilter: "blur(6px)",
          }}>
            <p style={{ fontSize: 9, color: "var(--t3)", fontFamily: MONO, letterSpacing: "0.16em", marginBottom: 6 }}>
              {new Date(hoverBase.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toUpperCase()}
            </p>
            <Row k="BASELINE" v={fmtUsdFull(hoverBase.cash)} color="#7DB8E8" />
            {hoverScen && <Row k="SCENARIO" v={fmtUsdFull(hoverScen.cash)} color="#5FB07D" />}
            {hoverScen && (
              <Row k="DELTA" v={`${hoverScen.cash - hoverBase.cash >= 0 ? "+" : ""}${fmtUsdShort(hoverScen.cash - hoverBase.cash)}`}
                color={hoverScen.cash - hoverBase.cash >= 0 ? "var(--green)" : "var(--red)"} />
            )}
          </div>
        )}
      </div>

      {/* Knobs */}
      <div style={{ padding: "14px 20px", borderTop: "1px solid var(--border)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <Knob
          label="MONTHLY SAVINGS Δ"
          value={savingsDelta}
          format={v => `${v >= 0 ? "+" : ""}$${v}/mo`}
          min={-500} max={1500} step={25}
          onChange={setSavingsDelta}
        />
        <div>
          <p style={{ fontSize: 9, color: "var(--t3)", letterSpacing: "0.16em", fontFamily: MONO, marginBottom: 6 }}>
            SALARY CHANGE
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <input type="number" placeholder="$/mo (e.g. 4500)" value={salaryChange || ""}
              onChange={e => setSalaryChange(parseFloat(e.target.value) || 0)}
              style={inputStyle()} />
            <input type="date" value={salaryDate} onChange={e => setSalaryDate(e.target.value)}
              style={inputStyle()} />
          </div>
        </div>
      </div>

      {/* Footer: deltas + save */}
      <div style={{ padding: "14px 20px", borderTop: "1px solid var(--border)",
        display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", gap: 24 }}>
          <Stat label={`END-OF-${horizon}D BASELINE`} value={fmtUsdShort(baseEnd)} color="#7DB8E8" />
          <Stat label={`END-OF-${horizon}D SCENARIO`} value={scenario ? fmtUsdShort(scenEnd) : "—"} color="#5FB07D" />
          <Stat label="DELTA"
            value={scenario ? `${delta >= 0 ? "+" : ""}${fmtUsdShort(delta)}` : "—"}
            color={delta >= 0 ? "var(--green)" : "var(--red)"} />
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input placeholder="Name this scenario…" value={scenarioLabel}
            onChange={e => setScenarioLabel(e.target.value)}
            style={{ ...inputStyle(), width: 220 }} />
          <button onClick={saveScenario} disabled={!scenarioLabel.trim() || !scenario || saving}
            style={{
              padding: "8px 14px", borderRadius: 2,
              background: saved ? "rgba(95,176,125,0.15)" : "var(--blue-dim)",
              border: `1px solid ${saved ? "rgba(95,176,125,0.4)" : "var(--blue-border)"}`,
              color: saved ? "var(--green)" : "var(--blue)",
              fontFamily: MONO, fontSize: 10, letterSpacing: "0.18em", fontWeight: 700,
              cursor: !scenarioLabel.trim() || !scenario || saving ? "default" : "pointer",
              opacity: !scenarioLabel.trim() || !scenario || saving ? 0.5 : 1,
            }}>
            {saved ? "✓ SAVED" : saving ? "SAVING…" : loadingScen ? "PROJECTING…" : "SAVE SCENARIO"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Knob({ label, value, format, min, max, step, onChange }: {
  label: string; value: number; format: (v: number) => string;
  min: number; max: number; step: number; onChange: (n: number) => void;
}) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <span style={{ fontSize: 9, color: "var(--t3)", letterSpacing: "0.16em", fontFamily: MONO }}>{label}</span>
        <span style={{ fontSize: 13, color: value === 0 ? "var(--t3)" : "var(--blue)", fontFamily: MONO, fontWeight: 600 }}>
          {format(value)}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: "100%", accentColor: "#7DB8E8" }} />
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <p style={{ fontSize: 9, color: "var(--t4)", letterSpacing: "0.16em", fontFamily: MONO }}>{label}</p>
      <p style={{ fontSize: 14, color, marginTop: 2, fontFamily: MONO }}>{value}</p>
    </div>
  );
}

function Row({ k, v, color }: { k: string; v: string; color: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 14, fontSize: 11, marginTop: 2 }}>
      <span style={{ color, fontFamily: MONO, letterSpacing: "0.1em" }}>{k}</span>
      <span style={{ color: "var(--t1)", fontFamily: MONO }}>{v}</span>
    </div>
  );
}

function inputStyle(): React.CSSProperties {
  return {
    background: "var(--surface2)", border: "1px solid var(--border2)",
    borderRadius: 2, padding: "6px 10px", color: "var(--t1)",
    fontFamily: MONO, fontSize: 12, outline: "none",
  };
}
