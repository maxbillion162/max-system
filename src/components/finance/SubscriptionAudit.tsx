"use client";

import { useEffect, useState } from "react";
import { FeedbackControl } from "@/components/ui/FeedbackControl";

const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

interface Sub {
  id:                   string;
  merchant_pattern:     string;
  display_name:         string;
  monthly_amount:       number;
  annual_amount:        number;
  cadence:              string;
  occurrences:          number;
  last_seen:            string;
  first_seen:           string | null;
  suggestion:           string | null;
  suggestion_reasoning: string | null;
  user_decision:        string | null;
}

const SUGGESTION_COLORS: Record<string, string> = {
  cancel:    "var(--red)",
  keep:      "var(--green)",
  negotiate: "#B89A6E",
  review:    "var(--blue)",
};

function fmtUsd(n: number): string {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}
function fmtUsd2(n: number): string {
  return `$${n.toFixed(2)}`;
}
function fmtDate(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function SubscriptionAudit() {
  const [subs, setSubs] = useState<Sub[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalMonthly, setTotalMonthly] = useState(0);
  const [totalAnnual, setTotalAnnual] = useState(0);

  async function load() {
    try {
      const res = await fetch("/api/finance/recurring");
      const json = await res.json();
      if (Array.isArray(json.subs)) {
        setSubs(json.subs);
        setTotalMonthly(json.total_monthly ?? 0);
        setTotalAnnual(json.total_annual ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/finance/recurring", { method: "POST" });
      const json = await res.json();
      if (Array.isArray(json.subs)) {
        setSubs(json.subs);
        setTotalMonthly(json.total_monthly ?? 0);
        setTotalAnnual(json.total_annual ?? 0);
      }
    } finally {
      setRefreshing(false);
    }
  }

  async function decide(id: string, decision: string) {
    // Optimistic
    setSubs(prev => prev.map(s => s.id === id ? { ...s, user_decision: decision } : s));
    await fetch("/api/finance/recurring", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "decide", id, decision }),
    });
  }

  useEffect(() => { void load(); }, []);

  const pendingSavings = subs
    .filter(s => s.suggestion === "cancel" && s.user_decision !== "rejected")
    .reduce((sum, s) => sum + s.annual_amount, 0);

  return (
    <div style={{
      background: "linear-gradient(160deg, #0f141d 0%, #080b11 100%)",
      border: "1px solid rgba(125,184,232,0.10)", borderRadius: 3,
    }}>
      {/* Header */}
      <div style={{ padding: "16px 20px 10px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.32em", color: "var(--blue)", fontFamily: MONO }}>
            SUBSCRIPTION AUDIT
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: 18, marginTop: 6 }}>
            <p style={{ fontSize: 22, fontWeight: 600, color: "var(--t1)", fontFamily: MONO, letterSpacing: "-0.02em", lineHeight: 1 }}>
              {fmtUsd(totalMonthly)}<span style={{ fontSize: 11, color: "var(--t3)", marginLeft: 6 }}>/MO</span>
            </p>
            <span style={{ fontSize: 11, color: "var(--t3)", fontFamily: MONO, letterSpacing: "0.06em" }}>
              · {fmtUsd(totalAnnual)}/YR · {subs.length} ACTIVE
            </span>
            {pendingSavings > 0 && (
              <span style={{ fontSize: 11, color: "var(--green)", fontFamily: MONO, letterSpacing: "0.06em" }}>
                ▲ {fmtUsd(pendingSavings)}/yr if you accept M.A.X.&apos;s suggestions
              </span>
            )}
          </div>
        </div>
        <button onClick={refresh} disabled={refreshing}
          style={{
            background: "transparent", border: "1px solid var(--border)",
            color: refreshing ? "var(--t4)" : "var(--t2)",
            padding: "6px 12px", borderRadius: 2,
            fontFamily: MONO, fontSize: 10, letterSpacing: "0.18em", fontWeight: 700,
            cursor: refreshing ? "default" : "pointer",
          }}>
          {refreshing ? "SCANNING…" : "↻ RE-SCAN"}
        </button>
      </div>

      {/* Empty / loading */}
      {loading && (
        <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--t4)", fontFamily: MONO, fontSize: 11 }}>
          loading subscriptions…
        </div>
      )}
      {!loading && subs.length === 0 && (
        <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--t3)", fontSize: 12, lineHeight: 1.6 }}>
          <p style={{ marginBottom: 6, color: "var(--t1)", fontWeight: 600 }}>No recurring charges detected yet</p>
          Hit RE-SCAN to scan the last 90 days, or wait for the weekly cron to run.
        </div>
      )}

      {/* Table */}
      {subs.length > 0 && (
        <div style={{ borderTop: "1px solid var(--border)" }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 0.6fr 0.4fr 0.6fr 1.2fr 0.8fr",
            gap: 12, padding: "10px 20px",
            borderBottom: "1px solid var(--border)",
            fontSize: 9, color: "var(--t4)", letterSpacing: "0.2em", fontFamily: MONO,
          }}>
            <span>MERCHANT</span>
            <span style={{ textAlign: "right" }}>$ / MO</span>
            <span style={{ textAlign: "center" }}>×</span>
            <span style={{ textAlign: "center" }}>SUGGEST</span>
            <span>WHY</span>
            <span style={{ textAlign: "right" }}>ACTION</span>
          </div>

          {subs.map(sub => {
            const sugColor = SUGGESTION_COLORS[sub.suggestion ?? "review"] ?? "var(--t3)";
            const decisionTone = sub.user_decision === "accepted" ? "var(--green)"
              : sub.user_decision === "rejected" ? "var(--t4)"
              : sub.user_decision === "snoozed"  ? "var(--t3)"
              : null;
            return (
              <div key={sub.id} style={{
                display: "grid",
                gridTemplateColumns: "1.4fr 0.6fr 0.4fr 0.6fr 1.2fr 0.8fr",
                gap: 12, padding: "12px 20px",
                borderBottom: "1px solid var(--border)",
                alignItems: "center",
                opacity: sub.user_decision === "rejected" ? 0.5 : 1,
              }}>
                <div>
                  <p style={{ fontSize: 13, color: "var(--t1)", fontWeight: 500 }}>{sub.display_name}</p>
                  <p style={{ fontSize: 10, color: "var(--t4)", fontFamily: MONO, letterSpacing: "0.12em", marginTop: 2 }}>
                    {sub.cadence.toUpperCase()} · LAST {fmtDate(sub.last_seen)}
                  </p>
                </div>
                <span style={{ textAlign: "right", fontFamily: MONO, fontSize: 13, color: "var(--t1)" }}>
                  {fmtUsd2(sub.monthly_amount)}
                </span>
                <span style={{ textAlign: "center", fontFamily: MONO, fontSize: 11, color: "var(--t3)" }}>
                  {sub.occurrences}
                </span>
                <span style={{ textAlign: "center" }}>
                  <span style={{
                    background: `${sugColor}1A`, border: `1px solid ${sugColor}55`,
                    color: sugColor, padding: "3px 8px", borderRadius: 2,
                    fontFamily: MONO, fontSize: 9, letterSpacing: "0.18em", fontWeight: 700,
                  }}>
                    {(sub.suggestion ?? "review").toUpperCase()}
                  </span>
                </span>
                <span style={{ fontSize: 11, color: "var(--t3)", lineHeight: 1.4 }}>
                  {sub.suggestion_reasoning ?? "—"}
                </span>
                <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                  {decisionTone ? (
                    <span style={{ fontFamily: MONO, fontSize: 10, color: decisionTone, letterSpacing: "0.16em" }}>
                      {(sub.user_decision ?? "").toUpperCase()}
                    </span>
                  ) : (
                    <>
                      <button onClick={() => decide(sub.id, "accepted")}
                        title={`Accept: ${sub.suggestion}`}
                        style={pillBtn("var(--green)")}>
                        ✓
                      </button>
                      <button onClick={() => decide(sub.id, "snoozed")}
                        title="Snooze for now"
                        style={pillBtn("var(--t3)")}>
                        ⏸
                      </button>
                      <button onClick={() => decide(sub.id, "rejected")}
                        title="Ignore — keep it"
                        style={pillBtn("var(--red)")}>
                        ✕
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {/* Footer feedback on the AI suggestions as a whole */}
          <div style={{ padding: "10px 20px" }}>
            <FeedbackControl
              artifactType="subscription_audit"
              artifactId="subscription_audit_latest"
              metadata={{ subs_count: subs.length, total_monthly: totalMonthly }}
              label="ARE M.A.X.'S SUGGESTIONS RIGHT?"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function pillBtn(color: string): React.CSSProperties {
  return {
    background: `${color}10`, border: `1px solid ${color}40`,
    color, width: 26, height: 26, borderRadius: 2,
    cursor: "pointer", fontSize: 12,
    display: "inline-flex", alignItems: "center", justifyContent: "center",
  };
}
