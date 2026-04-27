"use client";

import { useEffect, useState } from "react";
import { FeedbackControl } from "@/components/ui/FeedbackControl";

const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

interface RecurringSub {
  id:               string;
  display_name:     string;
  monthly_amount:   number;
  suggestion:       string | null;
}

interface WhatIfResult {
  label:           string | null;
  monthly_delta:   number;
  annual_delta:    number;
  horizon_delta:   number;
  goal_shifts:     { label: string; baseline_date: string|null; scenario_date: string|null; days_earlier: number|null }[];
  narrative:       string;
}

type Knobs = {
  monthly_savings_delta?: number;
  cancel_subscriptions?:  string[];
  salary_change?:         { effective_date: string; new_monthly: number };
};

interface PrebuiltScenario {
  id:    string;
  label: string;
  build: (subs: RecurringSub[]) => Knobs | null;
  hint:  string;
}

const PREBUILT: PrebuiltScenario[] = [
  {
    id:    "cancel_top3",
    label: "CANCEL TOP 3 SUBS",
    hint:  "Drop your three priciest recurring charges.",
    build: (subs) => {
      const top3 = [...subs].sort((a, b) => b.monthly_amount - a.monthly_amount).slice(0, 3);
      if (top3.length === 0) return null;
      return { cancel_subscriptions: top3.map(s => s.display_name) };
    },
  },
  {
    id:    "save_200_more",
    label: "SAVE $200 MORE / MO",
    hint:  "Tighten discretionary by $200 monthly.",
    build: () => ({ monthly_savings_delta: 200 }),
  },
  {
    id:    "save_500_more",
    label: "SAVE $500 MORE / MO",
    hint:  "Aggressive — needs real lifestyle compression.",
    build: () => ({ monthly_savings_delta: 500 }),
  },
  {
    id:    "am_job_july",
    label: "AM JOB STARTS JULY 2026",
    hint:  "Account-Manager role, modeled at $4,500/mo net.",
    build: () => ({ salary_change: { effective_date: "2026-07-01", new_monthly: 4500 } }),
  },
];

function fmtUsdShort(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000) return `${n < 0 ? "−" : ""}$${(Math.abs(n)/1_000).toFixed(1)}K`;
  return `${n < 0 ? "−" : ""}$${Math.abs(n).toFixed(0)}`;
}

export function WhatIfEngine() {
  const [subs, setSubs] = useState<RecurringSub[]>([]);
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [result, setResult] = useState<WhatIfResult | null>(null);
  const [running, setRunning] = useState(false);
  const [customSavings, setCustomSavings] = useState(0);
  const [customCancel, setCustomCancel]   = useState<Set<string>>(new Set());
  const [customSalary, setCustomSalary]   = useState({ amount: 0, date: "2026-07-01" });
  const [showCustom, setShowCustom]       = useState(false);

  useEffect(() => {
    fetch("/api/finance/recurring").then(r => r.json()).then(j => {
      if (Array.isArray(j.subs)) setSubs(j.subs);
    }).catch(() => {});
  }, []);

  async function runScenario(label: string, knobs: Knobs) {
    setRunning(true);
    setActiveScenario(label);
    try {
      const res = await fetch("/api/finance/whatif", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label, knobs, horizon_days: 365 }),
      });
      const json = await res.json();
      if (!json.error) setResult(json);
    } finally {
      setRunning(false);
    }
  }

  function runPrebuilt(s: PrebuiltScenario) {
    const knobs = s.build(subs);
    if (!knobs) return;
    void runScenario(s.label, knobs);
  }

  function runCustom() {
    const knobs: Knobs = {};
    if (customSavings !== 0) knobs.monthly_savings_delta = customSavings;
    if (customCancel.size > 0) knobs.cancel_subscriptions = Array.from(customCancel);
    if (customSalary.amount > 0) knobs.salary_change = { effective_date: customSalary.date, new_monthly: customSalary.amount };
    if (Object.keys(knobs).length === 0) return;
    void runScenario("CUSTOM SCENARIO", knobs);
  }

  return (
    <div style={{
      background: "linear-gradient(160deg, #0f141d 0%, #080b11 100%)",
      border: "1px solid rgba(125,184,232,0.10)", borderRadius: 3,
    }}>
      {/* Header */}
      <div style={{ padding: "16px 20px 10px", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.32em", color: "var(--blue)", fontFamily: MONO }}>
            WHAT-IF ENGINE
          </span>
          <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 4, fontFamily: MONO, letterSpacing: "0.06em" }}>
            CHOOSE A SCENARIO — M.A.X. PROJECTS THE OUTCOME
          </p>
        </div>
        <button onClick={() => setShowCustom(v => !v)} style={{
          background: "transparent", border: "1px solid var(--border)",
          color: "var(--t2)", padding: "6px 12px", borderRadius: 2,
          fontFamily: MONO, fontSize: 10, letterSpacing: "0.18em", fontWeight: 700, cursor: "pointer",
        }}>
          {showCustom ? "× CLOSE" : "+ CUSTOM"}
        </button>
      </div>

      {/* Prebuilt grid */}
      <div style={{ padding: "0 20px 14px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
        {PREBUILT.map(s => {
          const buildable = s.build(subs) !== null;
          const active = activeScenario === s.label;
          return (
            <button key={s.id} onClick={() => runPrebuilt(s)} disabled={!buildable}
              style={{
                textAlign: "left",
                background: active ? "var(--blue-dim)" : "rgba(255,255,255,0.015)",
                border: `1px solid ${active ? "var(--blue-border)" : "var(--border)"}`,
                borderRadius: 3, padding: "12px 14px",
                cursor: buildable ? "pointer" : "default",
                opacity: buildable ? 1 : 0.4,
                transition: "all .15s",
              }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", color: active ? "var(--blue)" : "var(--t1)", fontFamily: MONO }}>
                {s.label}
              </p>
              <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 4, lineHeight: 1.4 }}>
                {s.hint}
              </p>
            </button>
          );
        })}
      </div>

      {/* Custom builder */}
      {showCustom && (
        <div style={{ padding: "12px 20px 18px", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
            <div>
              <p style={{ fontSize: 9, color: "var(--t3)", letterSpacing: "0.16em", fontFamily: MONO, marginBottom: 6 }}>
                MONTHLY SAVINGS Δ
              </p>
              <input type="range" min={-500} max={1500} step={25} value={customSavings}
                onChange={e => setCustomSavings(parseFloat(e.target.value))}
                style={{ width: "100%", accentColor: "#7DB8E8" }} />
              <p style={{ fontSize: 12, color: customSavings === 0 ? "var(--t3)" : "var(--blue)", fontFamily: MONO, marginTop: 4 }}>
                {customSavings >= 0 ? "+" : ""}${customSavings}/mo
              </p>
            </div>
            <div>
              <p style={{ fontSize: 9, color: "var(--t3)", letterSpacing: "0.16em", fontFamily: MONO, marginBottom: 6 }}>
                SALARY CHANGE
              </p>
              <div style={{ display: "flex", gap: 6 }}>
                <input type="number" placeholder="$/mo" value={customSalary.amount || ""}
                  onChange={e => setCustomSalary(s => ({ ...s, amount: parseFloat(e.target.value) || 0 }))}
                  style={inputStyle()} />
                <input type="date" value={customSalary.date}
                  onChange={e => setCustomSalary(s => ({ ...s, date: e.target.value }))}
                  style={inputStyle()} />
              </div>
            </div>
          </div>

          {subs.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <p style={{ fontSize: 9, color: "var(--t3)", letterSpacing: "0.16em", fontFamily: MONO, marginBottom: 6 }}>
                CANCEL SUBSCRIPTIONS
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {subs.map(s => {
                  const on = customCancel.has(s.display_name);
                  return (
                    <button key={s.id} onClick={() => {
                      setCustomCancel(prev => {
                        const next = new Set(prev);
                        if (next.has(s.display_name)) next.delete(s.display_name);
                        else next.add(s.display_name);
                        return next;
                      });
                    }} style={{
                      background: on ? "rgba(200,90,90,0.12)" : "transparent",
                      border: `1px solid ${on ? "rgba(200,90,90,0.4)" : "var(--border)"}`,
                      color: on ? "var(--red)" : "var(--t3)",
                      padding: "5px 10px", borderRadius: 2,
                      fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", cursor: "pointer",
                    }}>
                      {on ? "× " : ""}{s.display_name} <span style={{ opacity: 0.6 }}>${s.monthly_amount.toFixed(0)}/mo</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <button onClick={runCustom} disabled={running}
            style={{
              marginTop: 14,
              background: "var(--blue-dim)", border: "1px solid var(--blue-border)",
              color: "var(--blue)", padding: "8px 16px", borderRadius: 2,
              fontFamily: MONO, fontSize: 10, letterSpacing: "0.18em", fontWeight: 700,
              cursor: running ? "default" : "pointer", opacity: running ? 0.5 : 1,
            }}>
            {running ? "RUNNING…" : "▶ RUN CUSTOM SCENARIO"}
          </button>
        </div>
      )}

      {/* Result */}
      {result && (
        <div style={{ padding: "16px 20px", borderTop: "1px solid var(--border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
            <span style={{ fontSize: 10, color: "var(--blue)", letterSpacing: "0.18em", fontFamily: MONO, fontWeight: 700 }}>
              ↳ {result.label?.toUpperCase() ?? "SCENARIO"}
            </span>
            {running && <span style={{ fontSize: 10, color: "var(--t4)", fontFamily: MONO, letterSpacing: "0.14em" }}>RECOMPUTING…</span>}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 14, marginBottom: 14 }}>
            <Tile label="MONTHLY IMPACT"
              value={`${result.monthly_delta >= 0 ? "+" : ""}${fmtUsdShort(result.monthly_delta)}`}
              color={result.monthly_delta >= 0 ? "var(--green)" : "var(--red)"} />
            <Tile label="ANNUAL"
              value={`${result.annual_delta >= 0 ? "+" : ""}${fmtUsdShort(result.annual_delta)}`}
              color={result.annual_delta >= 0 ? "var(--green)" : "var(--red)"} />
            <Tile label="EOY 365D DELTA"
              value={`${result.horizon_delta >= 0 ? "+" : ""}${fmtUsdShort(result.horizon_delta)}`}
              color={result.horizon_delta >= 0 ? "var(--green)" : "var(--red)"} />
          </div>

          {result.goal_shifts.filter(g => g.days_earlier !== null).length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 9, color: "var(--t3)", letterSpacing: "0.18em", fontFamily: MONO, marginBottom: 6 }}>GOAL SHIFTS</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {result.goal_shifts.filter(g => g.days_earlier !== null).map((g, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 11 }}>
                    <span style={{ color: "var(--t2)" }}>{g.label}</span>
                    <span style={{ color: (g.days_earlier ?? 0) > 0 ? "var(--green)" : "var(--red)" }}>
                      {(g.days_earlier ?? 0) > 0 ? `${g.days_earlier} days sooner` : `${Math.abs(g.days_earlier ?? 0)} days later`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.narrative && (
            <div style={{
              padding: "12px 14px", background: "rgba(125,184,232,0.04)",
              border: "1px solid var(--blue-border)", borderRadius: 3,
              fontSize: 13, color: "var(--t1)", lineHeight: 1.55, fontStyle: "italic",
            }}>
              {result.narrative}
              <div style={{ marginTop: 10 }}>
                <FeedbackControl
                  artifactType="whatif_narrative"
                  artifactId={`whatif:${result.label}`}
                  metadata={{ knobs_label: result.label, monthly_delta: result.monthly_delta }}
                  variant="inline"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Tile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.015)", border: "1px solid var(--border)", borderRadius: 3, padding: "10px 12px" }}>
      <p style={{ fontSize: 9, color: "var(--t4)", letterSpacing: "0.16em", fontFamily: MONO }}>{label}</p>
      <p style={{ fontSize: 18, color, marginTop: 4, fontFamily: MONO, fontWeight: 600 }}>{value}</p>
    </div>
  );
}

function inputStyle(): React.CSSProperties {
  return {
    flex: 1,
    background: "var(--surface2)", border: "1px solid var(--border2)",
    borderRadius: 2, padding: "6px 10px", color: "var(--t1)",
    fontFamily: MONO, fontSize: 12, outline: "none",
  };
}
