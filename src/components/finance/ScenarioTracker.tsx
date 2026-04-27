"use client";

import { useEffect, useState } from "react";

const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

interface Scenario {
  id:            string;
  label:         string;
  description:   string | null;
  knobs:         Record<string, unknown>;
  baseline_data: Record<string, unknown> | null;
  status:        "draft" | "active" | "tracking" | "retired";
  trigger_event: string | null;
  trigger_date:  string | null;
  created_at:    string;
  retired_at:    string | null;
}

const STATUS_COLORS: Record<string, string> = {
  draft:    "var(--t3)",
  active:   "var(--blue)",
  tracking: "var(--green)",
  retired:  "var(--t4)",
};

function fmtUsd(n: number): string {
  return `${n < 0 ? "−" : ""}$${Math.abs(Math.round(n)).toLocaleString()}`;
}

function summarizeKnobs(knobs: Record<string, unknown>): string {
  const parts: string[] = [];
  if (typeof knobs.monthly_savings_delta === "number" && knobs.monthly_savings_delta !== 0) {
    const v = knobs.monthly_savings_delta as number;
    parts.push(`${v >= 0 ? "+" : ""}$${v}/mo savings`);
  }
  if (Array.isArray(knobs.cancel_subscriptions) && (knobs.cancel_subscriptions as unknown[]).length) {
    parts.push(`cancel ${(knobs.cancel_subscriptions as unknown[]).length} subs`);
  }
  const sc = knobs.salary_change as { effective_date?: string; new_monthly?: number } | undefined;
  if (sc?.new_monthly) {
    parts.push(`salary $${sc.new_monthly}/mo from ${sc.effective_date ?? "?"}`);
  }
  if (typeof knobs.btc_price_target === "number") {
    parts.push(`BTC → $${(knobs.btc_price_target as number).toLocaleString()}`);
  }
  return parts.length ? parts.join(" · ") : "no knobs set";
}

export function ScenarioTracker() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const res = await fetch("/api/finance/scenarios");
      const json = await res.json();
      if (Array.isArray(json.scenarios)) setScenarios(json.scenarios);
    } finally {
      setLoading(false);
    }
  }

  async function setStatus(id: string, status: Scenario["status"]) {
    setScenarios(prev => prev.map(s => s.id === id ? { ...s, status } : s));
    await fetch("/api/finance/scenarios", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, status, ...(status === "retired" ? { retired_at: new Date().toISOString() } : {}) }),
    });
  }

  async function remove(id: string) {
    setScenarios(prev => prev.filter(s => s.id !== id));
    await fetch(`/api/finance/scenarios?id=${id}`, { method: "DELETE" });
  }

  async function setTracking(s: Scenario) {
    /* Promote to tracking — the cron / surface code can compare actual vs sim later */
    await setStatus(s.id, "tracking");
  }

  useEffect(() => { void load(); }, []);

  const active   = scenarios.filter(s => s.status === "active"   || s.status === "draft");
  const tracking = scenarios.filter(s => s.status === "tracking");
  const retired  = scenarios.filter(s => s.status === "retired");

  return (
    <div style={{
      background: "linear-gradient(160deg, #0f141d 0%, #080b11 100%)",
      border: "1px solid rgba(125,184,232,0.10)", borderRadius: 3,
    }}>
      {/* Header */}
      <div style={{ padding: "16px 20px 10px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.32em", color: "var(--blue)", fontFamily: MONO }}>
            SAVED SCENARIOS
          </span>
          <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 4, fontFamily: MONO, letterSpacing: "0.06em" }}>
            {scenarios.length === 0 ? "NO SCENARIOS YET — SAVE ONE FROM THE TIME-TRAVEL SIMULATOR" : `${scenarios.length} TOTAL · ${tracking.length} TRACKING`}
          </p>
        </div>
      </div>

      {loading && (
        <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--t4)", fontFamily: MONO, fontSize: 11 }}>
          loading…
        </div>
      )}

      {!loading && scenarios.length === 0 && (
        <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--t3)", fontSize: 12, lineHeight: 1.6 }}>
          Use the Time-Travel Simulator above and hit SAVE SCENARIO to start tracking what-ifs over time.
        </div>
      )}

      {!loading && scenarios.length > 0 && (
        <div style={{ borderTop: "1px solid var(--border)" }}>
          {[...active, ...tracking, ...retired].map(s => (
            <ScenarioRow
              key={s.id}
              s={s}
              onPromoteTracking={() => setTracking(s)}
              onRetire={() => setStatus(s.id, "retired")}
              onActivate={() => setStatus(s.id, "active")}
              onDelete={() => remove(s.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ScenarioRow({ s, onPromoteTracking, onRetire, onActivate, onDelete }: {
  s: Scenario;
  onPromoteTracking: () => void;
  onRetire:          () => void;
  onActivate:        () => void;
  onDelete:          () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [drift, setDrift] = useState<{ delta: number; loading: boolean } | null>(null);

  /* For tracking scenarios, compute actual-vs-simulated drift since trigger_date (or created_at) */
  useEffect(() => {
    if (s.status !== "tracking") return;
    let alive = true;
    setDrift({ delta: 0, loading: true });
    (async () => {
      try {
        /* Fetch the current forecast under this scenario's knobs and compare end-of-90d vs the baseline forecast */
        const [scenRes, baseRes] = await Promise.all([
          fetch("/api/finance/forecast", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ horizon_days: 90, knobs: s.knobs }),
          }),
          fetch("/api/finance/forecast", { method: "GET" }),
        ]);
        const scen = await scenRes.json();
        const base = await baseRes.json();
        const scenEnd = scen.future?.[scen.future.length - 1]?.cash ?? 0;
        const baseEnd = base.future?.[base.future.length - 1]?.cash ?? 0;
        if (alive) setDrift({ delta: scenEnd - baseEnd, loading: false });
      } catch {
        if (alive) setDrift({ delta: 0, loading: false });
      }
    })();
    return () => { alive = false; };
  }, [s.id, s.status, s.knobs]);

  const status = s.status;
  const color = STATUS_COLORS[status] ?? "var(--t3)";

  return (
    <div style={{
      padding: "12px 20px", borderBottom: "1px solid var(--border)",
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <p style={{ fontSize: 13, color: "var(--t1)", fontWeight: 600 }}>{s.label}</p>
            <span style={{
              fontSize: 8, fontWeight: 700, letterSpacing: "0.18em", color,
              background: `${color}1A`, border: `1px solid ${color}55`,
              padding: "2px 7px", borderRadius: 2, fontFamily: MONO,
            }}>{status.toUpperCase()}</span>
          </div>
          <p style={{ fontSize: 11, color: "var(--t3)", fontFamily: MONO, letterSpacing: "0.04em", marginTop: 3 }}>
            {summarizeKnobs(s.knobs)}
          </p>
          {s.trigger_event && (
            <p style={{ fontSize: 10, color: "var(--t4)", marginTop: 3 }}>
              ↳ trigger: {s.trigger_event}{s.trigger_date ? ` · ${s.trigger_date}` : ""}
            </p>
          )}
          {status === "tracking" && drift && !drift.loading && (
            <p style={{ fontSize: 11, color: drift.delta >= 0 ? "var(--green)" : "var(--red)", fontFamily: MONO, marginTop: 4 }}>
              90D DRIFT vs BASELINE: {drift.delta >= 0 ? "+" : ""}{fmtUsd(drift.delta)}
            </p>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 4 }}>
          {status !== "tracking" && status !== "retired" && (
            <button onClick={onPromoteTracking} title="Track this scenario over time" style={pillBtn("var(--green)")}>TRACK</button>
          )}
          {status === "tracking" && (
            <button onClick={onActivate} title="Stop tracking, keep as draft" style={pillBtn("var(--blue)")}>UNTRACK</button>
          )}
          {status !== "retired" && (
            <button onClick={onRetire} title="Retire this scenario" style={pillBtn("var(--t4)")}>RETIRE</button>
          )}
          {!confirming ? (
            <button onClick={() => setConfirming(true)} title="Delete" style={pillBtn("var(--red)")}>×</button>
          ) : (
            <>
              <button onClick={onDelete} style={pillBtn("var(--red)", true)}>DELETE</button>
              <button onClick={() => setConfirming(false)} style={pillBtn("var(--t3)")}>CANCEL</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function pillBtn(color: string, filled = false): React.CSSProperties {
  return {
    background: filled ? `${color}26` : "transparent",
    border: `1px solid ${color}55`,
    color, padding: "4px 9px", borderRadius: 2,
    fontFamily: MONO, fontSize: 9, letterSpacing: "0.16em", fontWeight: 700, cursor: "pointer",
  };
}
