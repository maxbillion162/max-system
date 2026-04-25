"use client";

import { useEffect, useState } from "react";
import { FeedbackControl } from "@/components/ui/FeedbackControl";

const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

interface CategoryRow {
  category:    string;
  this_month:  number;
  last_month:  number;
  delta_pct:   number;
}

interface MerchantRow {
  merchant: string;
  count:    number;
  total:    number;
}

interface DayRow {
  day:   string;
  total: number;
  count: number;
  avg:   number;
}

interface RecurringRow {
  merchant:        string;
  monthly_amount:  number;
  last_seen:       string;
  occurrences:     number;
  annual_estimate: number;
}

interface AnomalyRow {
  merchant: string;
  amount:   number;
  date:     string;
  z_score:  number;
  reason:   string;
}

interface AiInsight {
  severity: "win" | "watch" | "warn" | string;
  title:    string;
  body:     string;
}

interface InsightsData {
  category_breakdown:  CategoryRow[];
  top_merchants:       MerchantRow[];
  day_of_week:         DayRow[];
  recurring:           RecurringRow[];
  anomalies:           AnomalyRow[];
  ai_insights:         AiInsight[];
  total_transactions:  number;
  total_spent:         number;
  total_last_month:    number;
  month_delta_pct:     number;
  empty_reason?:       string;
  generated_at?:       string;
}

function fmtInt(n: number): string { return Math.round(n).toLocaleString("en-US"); }

interface Props {
  categoryColors: Record<string, string>;
  onCategoryClick?: (category: string) => void;
}

export function SpendingIntel({ categoryColors, onCategoryClick }: Props) {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  async function load() {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/finance/insights");
      const json = await res.json();
      if (json.error) setError(json.error);
      else setData(json);
    } catch {
      setError("Couldn't load spending intelligence.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  if (loading && !data) {
    return (
      <div style={shellStyle()}>
        <div style={{ padding: "30px 20px", textAlign: "center" }}>
          <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: 6, height: 6, borderRadius: "50%", background: "var(--blue)", opacity: 0.6,
                animation: `bounce 0.8s ease-in-out ${i * 0.18}s infinite`,
              }} />
            ))}
            <span style={{ fontSize: 11, color: "var(--t3)", fontFamily: MONO, letterSpacing: "0.12em", marginLeft: 8 }}>
              M.A.X. IS ANALYZING YOUR SPENDING…
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={shellStyle()}>
        <p style={{ fontSize: 12, color: "var(--red)", padding: "20px", textAlign: "center" }}>
          {error ?? "Failed to load."}
        </p>
      </div>
    );
  }

  if (data.empty_reason) {
    return (
      <div style={shellStyle()}>
        <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--t3)", fontSize: 12, lineHeight: 1.6 }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.32em", color: "var(--blue)", fontFamily: MONO, marginBottom: 8 }}>
            SPENDING INTELLIGENCE
          </p>
          {data.empty_reason}
        </div>
      </div>
    );
  }

  return (
    <div style={shellStyle()}>
      {/* Header */}
      <div style={{
        padding: "12px 18px",
        borderBottom: "1px solid var(--border)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.32em", color: "var(--blue)", fontFamily: MONO }}>
            ◈ SPENDING INTELLIGENCE
          </span>
          <span style={{ fontSize: 10, color: "var(--t3)", fontFamily: MONO, letterSpacing: "0.14em" }}>
            ${fmtInt(data.total_spent)} THIS MONTH ·{" "}
            <span style={{ color: data.month_delta_pct >= 0 ? "var(--red)" : "var(--green)" }}>
              {data.month_delta_pct >= 0 ? "+" : ""}{data.month_delta_pct.toFixed(0)}% VS LAST
            </span>
          </span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={load} disabled={loading} style={btnStyle()}>
            {loading ? "…" : "↻"}
          </button>
          <button onClick={() => setCollapsed(c => !c)} style={btnStyle()}>
            {collapsed ? "↓ EXPAND" : "↑ COLLAPSE"}
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          {/* AI Insights row — top of the intel surface */}
          {data.ai_insights.length > 0 && (
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
              <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.32em", color: "var(--blue)", fontFamily: MONO, marginBottom: 10 }}>
                M.A.X.&apos;S READ
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {data.ai_insights.map((ins, i) => {
                  const sev = ins.severity?.toLowerCase() ?? "watch";
                  const color = sev === "win" ? "var(--green)" : sev === "warn" ? "var(--red)" : "#7DB8E8";
                  const symbol = sev === "win" ? "↑" : sev === "warn" ? "⚠" : "·";
                  return (
                    <div key={i} style={{
                      display: "flex", gap: 10, padding: "9px 12px",
                      background: "var(--surface)", borderRadius: 2,
                      border: `1px solid ${color}22`,
                    }}>
                      <span style={{ color, fontFamily: MONO, fontSize: 12, fontWeight: 700, flexShrink: 0, width: 14 }}>
                        {symbol}
                      </span>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--t1)", marginBottom: 2 }}>{ins.title}</p>
                        <p style={{ fontSize: 12, color: "var(--t3)", lineHeight: 1.5 }}>{ins.body}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 8 }}>
                <FeedbackControl
                  artifactType="spending_insights"
                  artifactId={data.generated_at ?? `si-${Date.now()}`}
                  metadata={{ total_spent: data.total_spent, month_delta: data.month_delta_pct }}
                  variant="inline"
                />
              </div>
            </div>
          )}

          {/* Grid of panels */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0,
          }}>
            {/* CATEGORY BREAKDOWN */}
            <Panel title="TOP CATEGORIES · MoM" rightLabel="↓ AMOUNT">
              {data.category_breakdown.slice(0, 8).length === 0 ? (
                <Empty />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {data.category_breakdown.slice(0, 8).map(c => {
                    const max = Math.max(...data.category_breakdown.slice(0, 8).map(x => x.this_month));
                    const w = max > 0 ? (c.this_month / max) * 100 : 0;
                    const color = categoryColors[c.category] ?? "#7DB8E8";
                    return (
                      <div
                        key={c.category}
                        onClick={() => onCategoryClick?.(c.category)}
                        style={{ cursor: onCategoryClick ? "pointer" : "default", padding: "5px 0" }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
                          <span style={{ fontSize: 12, color: "var(--t1)", fontWeight: 500 }}>{c.category}</span>
                          <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                            <span style={{
                              fontSize: 10, fontFamily: MONO,
                              color: c.delta_pct > 10 ? "var(--red)" : c.delta_pct < -10 ? "var(--green)" : "var(--t4)",
                            }}>
                              {c.delta_pct >= 0 ? "+" : ""}{c.delta_pct.toFixed(0)}%
                            </span>
                            <span style={{ fontSize: 12, fontFamily: MONO, color: "var(--t1)", minWidth: 48, textAlign: "right" }}>
                              ${fmtInt(c.this_month)}
                            </span>
                          </div>
                        </div>
                        <div style={{ height: 2, background: "rgba(255,255,255,0.05)", borderRadius: 1, overflow: "hidden" }}>
                          <div style={{ width: `${w}%`, height: "100%", background: color, transition: "width 0.4s" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>

            {/* TOP MERCHANTS */}
            <Panel title="TOP MERCHANTS · THIS MONTH" rightLabel="↓ TOTAL">
              {data.top_merchants.length === 0 ? <Empty /> : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {data.top_merchants.slice(0, 8).map(m => {
                    const max = Math.max(...data.top_merchants.slice(0, 8).map(x => x.total));
                    const w = max > 0 ? (m.total / max) * 100 : 0;
                    return (
                      <div key={m.merchant} style={{ padding: "5px 0" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
                          <span style={{ fontSize: 12, color: "var(--t1)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>{m.merchant}</span>
                          <div style={{ display: "flex", gap: 8 }}>
                            <span style={{ fontSize: 10, color: "var(--t4)", fontFamily: MONO, letterSpacing: "0.06em" }}>{m.count}×</span>
                            <span style={{ fontSize: 12, fontFamily: MONO, color: "var(--t1)", minWidth: 48, textAlign: "right" }}>${fmtInt(m.total)}</span>
                          </div>
                        </div>
                        <div style={{ height: 2, background: "rgba(255,255,255,0.05)", borderRadius: 1, overflow: "hidden" }}>
                          <div style={{ width: `${w}%`, height: "100%", background: "var(--blue)", transition: "width 0.4s" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>

            {/* DAY OF WEEK */}
            <Panel title="WHEN YOU SPEND · 90D" rightLabel="$ TOTAL">
              {(() => {
                const max = Math.max(...data.day_of_week.map(d => d.total));
                const peak = data.day_of_week.reduce((p, c) => c.total > p.total ? c : p, data.day_of_week[0]);
                return (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 8 }}>
                      {data.day_of_week.map(d => {
                        const h = max > 0 ? (d.total / max) * 80 : 0;
                        const isPeak = d.day === peak.day;
                        return (
                          <div key={d.day} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                            <div style={{ height: 80, display: "flex", flexDirection: "column", justifyContent: "flex-end", width: "100%" }}>
                              <div style={{
                                height: `${h}%`, minHeight: 2,
                                background: isPeak ? "var(--blue)" : "rgba(125,184,232,0.35)",
                                borderRadius: "1px 1px 0 0",
                              }} />
                            </div>
                            <span style={{ fontSize: 8, fontFamily: MONO, fontWeight: 700, letterSpacing: "0.14em", color: isPeak ? "var(--blue)" : "var(--t3)" }}>
                              {d.day}
                            </span>
                            <span style={{ fontSize: 9, fontFamily: MONO, color: isPeak ? "var(--t1)" : "var(--t4)" }}>
                              ${d.total >= 1000 ? `${(d.total/1000).toFixed(1)}k` : d.total}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <p style={{ fontSize: 10, color: "var(--t3)", fontFamily: MONO, letterSpacing: "0.12em", textAlign: "center" }}>
                      PEAK DAY: <span style={{ color: "var(--blue)" }}>{peak.day}</span> · ${fmtInt(peak.total)} TOTAL · ${fmtInt(peak.avg)} AVG/TXN
                    </p>
                  </>
                );
              })()}
            </Panel>

            {/* RECURRING SUBSCRIPTIONS */}
            <Panel
              title={`RECURRING · ${data.recurring.length} SUBS`}
              rightLabel={data.recurring.length > 0
                ? `$${fmtInt(data.recurring.reduce((s, r) => s + r.monthly_amount, 0))}/MO · $${fmtInt(data.recurring.reduce((s, r) => s + r.annual_estimate, 0))}/YR`
                : ""}
            >
              {data.recurring.length === 0 ? (
                <p style={{ fontSize: 12, color: "var(--t4)", padding: "16px 0", fontFamily: MONO, letterSpacing: "0.1em", textAlign: "center" }}>
                  NO MONTHLY SUBSCRIPTIONS DETECTED YET
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {data.recurring.slice(0, 8).map((r, i) => (
                    <div key={r.merchant + i} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "7px 0", borderBottom: i < Math.min(7, data.recurring.length - 1) ? "1px solid var(--border)" : "none",
                    }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 12, color: "var(--t1)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {r.merchant}
                        </p>
                        <p style={{ fontSize: 9, color: "var(--t4)", fontFamily: MONO, letterSpacing: "0.1em" }}>
                          {r.occurrences}× · LAST {new Date(r.last_seen + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase()}
                        </p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ fontSize: 12, fontFamily: MONO, color: "var(--t1)" }}>
                          ${r.monthly_amount.toFixed(2)}<span style={{ fontSize: 9, color: "var(--t4)", marginLeft: 3 }}>/mo</span>
                        </p>
                        <p style={{ fontSize: 9, color: "var(--t4)", fontFamily: MONO, letterSpacing: "0.1em" }}>
                          ${r.annual_estimate}/YR
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            {/* ANOMALIES — full row */}
            {data.anomalies.length > 0 && (
              <div style={{ gridColumn: "1 / -1" }}>
                <Panel
                  title={`◭ ANOMALIES · ${data.anomalies.length} OUTLIERS`}
                  rightLabel="2σ+ ABOVE AVG"
                >
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 8 }}>
                    {data.anomalies.slice(0, 6).map((a, i) => (
                      <div key={i} style={{
                        background: "var(--surface)", border: "1px solid rgba(200,90,90,0.18)",
                        borderRadius: 2, padding: "9px 12px",
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--t1)" }}>{a.merchant}</span>
                          <span style={{ fontSize: 11, fontFamily: MONO, color: "var(--red)" }}>${a.amount.toFixed(2)}</span>
                        </div>
                        <p style={{ fontSize: 10, color: "var(--t3)", lineHeight: 1.4, marginBottom: 4 }}>{a.reason}</p>
                        <p style={{ fontSize: 9, color: "var(--t4)", fontFamily: MONO, letterSpacing: "0.1em" }}>
                          {new Date(a.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toUpperCase()} · {a.z_score}σ
                        </p>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Panel({ title, rightLabel, children }: { title: string; rightLabel?: string; children: React.ReactNode }) {
  return (
    <div style={{
      padding: "12px 16px",
      borderRight: "1px solid var(--border)",
      borderBottom: "1px solid var(--border)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.32em", color: "var(--t3)", fontFamily: MONO }}>
          {title}
        </span>
        {rightLabel && (
          <span style={{ fontSize: 9, color: "var(--t4)", fontFamily: MONO, letterSpacing: "0.16em" }}>
            {rightLabel}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function Empty() {
  return (
    <p style={{ fontSize: 12, color: "var(--t4)", padding: "16px 0", fontFamily: MONO, letterSpacing: "0.1em", textAlign: "center" }}>
      NO DATA YET
    </p>
  );
}

function shellStyle(): React.CSSProperties {
  return {
    background: "linear-gradient(160deg, #0f141d 0%, #080b11 100%)",
    border: "1px solid rgba(125,184,232,0.10)", borderRadius: 3,
    overflow: "hidden",
  };
}

function btnStyle(): React.CSSProperties {
  return {
    background: "transparent", border: "1px solid var(--border)",
    borderRadius: 2, padding: "4px 9px",
    color: "var(--t3)", cursor: "pointer",
    fontFamily: MONO, fontSize: 9, letterSpacing: "0.18em", fontWeight: 700,
  };
}
