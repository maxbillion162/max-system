"use client";

import { useEffect, useState } from "react";
import { FeedbackControl } from "@/components/ui/FeedbackControl";

const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

interface Paycheck {
  amount:   number;
  source?:  string | null;
  date?:    string | null;
}

interface Allocation {
  bucket:    string;
  amount:    number;
  kind:      string;
  reasoning: string;
  goal_id?:  string | null;
}

interface Plan {
  summary:     string;
  allocations: Allocation[];
}

interface Props {
  open:      boolean;
  paycheck:  Paycheck | null;       // when null, shows manual-entry form
  onClose:   () => void;
  onAccept:  (allocations: Allocation[]) => Promise<void>;
}

const KIND_THEME: Record<string, { color: string; label: string }> = {
  bill:              { color: "#C85A5A", label: "BILL" },
  savings_goal:      { color: "#7DB8E8", label: "SAVINGS" },
  ira_contribution:  { color: "#9B7BC2", label: "INVEST" },
  budget_category:   { color: "#5FB07D", label: "BUDGET" },
  discretionary:     { color: "#B89A6E", label: "DISCRETIONARY" },
};

function fmtUsd(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export function PaycheckPlannerModal({ open, paycheck, onClose, onAccept }: Props) {
  const [step, setStep] = useState<"input" | "loading" | "review" | "error">(paycheck ? "loading" : "input");
  const [amount, setAmount] = useState(paycheck?.amount ? String(paycheck.amount) : "");
  const [source, setSource] = useState(paycheck?.source ?? "");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep(paycheck ? "loading" : "input");
      setPlan(null); setError(null);
      setAmount(paycheck?.amount ? String(paycheck.amount) : "");
      setSource(paycheck?.source ?? "");
    } else if (paycheck) {
      void compute(paycheck.amount, paycheck.source ?? undefined, paycheck.date ?? undefined);
    }
  }, [open, paycheck]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape" && open) onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function compute(amt: number, src?: string, date?: string) {
    setStep("loading"); setError(null);
    try {
      const res = await fetch("/api/budget/paycheck-plan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt, source: src, date }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); setStep("error"); }
      else { setPlan(data.plan); setStep("review"); }
    } catch {
      setError("Couldn't reach M.A.X."); setStep("error");
    }
  }

  async function handleAccept() {
    if (!plan) return;
    setAccepting(true);
    try { await onAccept(plan.allocations); onClose(); }
    finally { setAccepting(false); }
  }

  if (!open) return null;

  const total = plan ? plan.allocations.reduce((s, a) => s + a.amount, 0) : 0;
  const inputAmount = parseFloat(amount) || 0;
  const remainder = (paycheck?.amount ?? inputAmount) - total;

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(0,0,0,0.78)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 28,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "linear-gradient(160deg, #0f141d 0%, #080b11 100%)",
        border: "1px solid var(--blue-border)", borderRadius: 3,
        width: "100%", maxWidth: 680, maxHeight: "88vh",
        display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{ padding: "20px 26px", borderBottom: "1px solid var(--border)" }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.32em", color: "var(--blue)", fontFamily: MONO, marginBottom: 6 }}>
            💰 PAYCHECK PLANNER
          </p>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--t1)", letterSpacing: "-0.01em" }}>
            {paycheck
              ? `${fmtUsd(paycheck.amount)} from ${paycheck.source ?? "an unknown source"}`
              : step === "input" ? "Plan a paycheck distribution" : `${fmtUsd(inputAmount)}`}
          </h2>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 26px" }}>
          {step === "input" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ fontSize: 12, color: "var(--t3)", lineHeight: 1.5 }}>
                Enter what landed and M.A.X. will propose how to distribute it across upcoming bills, savings goals, and discretionary.
              </p>
              <div>
                <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", color: "var(--t3)", fontFamily: MONO, marginBottom: 6 }}>AMOUNT</p>
                <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 2, padding: "8px 12px" }}>
                  <span style={{ fontSize: 16, color: "var(--t3)", fontFamily: MONO }}>$</span>
                  <input
                    type="number"
                    autoFocus
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && parseFloat(amount) > 0) void compute(parseFloat(amount), source || undefined); }}
                    placeholder="0.00"
                    style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--t1)", fontFamily: MONO, fontSize: 16 }}
                  />
                </div>
              </div>
              <div>
                <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", color: "var(--t3)", fontFamily: MONO, marginBottom: 6 }}>SOURCE (OPTIONAL)</p>
                <input
                  value={source}
                  onChange={e => setSource(e.target.value)}
                  placeholder="Employer name, freelance gig, etc."
                  style={{
                    width: "100%", background: "var(--surface2)",
                    border: "1px solid var(--border2)", borderRadius: 2,
                    padding: "8px 12px", color: "var(--t1)", fontSize: 13, outline: "none",
                  }}
                />
              </div>
            </div>
          )}

          {step === "loading" && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 0", gap: 8 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 6, height: 6, borderRadius: "50%", background: "var(--blue)", opacity: 0.6,
                  animation: `bounce 0.8s ease-in-out ${i * 0.18}s infinite`,
                }} />
              ))}
              <span style={{ fontSize: 11, color: "var(--t3)", fontFamily: MONO, letterSpacing: "0.12em", marginLeft: 6 }}>
                M.A.X. IS PLANNING THE DISTRIBUTION…
              </span>
            </div>
          )}

          {step === "error" && (
            <div style={{ padding: "30px 0", textAlign: "center" }}>
              <p style={{ fontSize: 13, color: "var(--red)", marginBottom: 12 }}>{error}</p>
              <button onClick={() => setStep(paycheck ? "loading" : "input")} style={{
                padding: "8px 16px", borderRadius: 2, background: "transparent",
                border: "1px solid var(--border)", color: "var(--t2)", cursor: "pointer",
                fontFamily: MONO, fontSize: 11, letterSpacing: "0.16em",
              }}>← BACK</button>
            </div>
          )}

          {step === "review" && plan && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Summary */}
              <div style={{ background: "var(--blue-dim)", border: "1px solid var(--blue-border)", borderRadius: 3, padding: "12px 14px" }}>
                <p style={{ fontSize: 12, color: "var(--t1)", lineHeight: 1.6, marginBottom: 6 }}>{plan.summary}</p>
                <FeedbackControl
                  artifactType="paycheck_plan"
                  artifactId={`pc-${(paycheck?.amount ?? inputAmount)}-${Date.now()}`}
                  metadata={{ amount: paycheck?.amount ?? inputAmount }}
                  variant="inline"
                />
              </div>

              {/* Allocations */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {plan.allocations.map((a, i) => {
                  const theme = KIND_THEME[a.kind] ?? { color: "#8794A6", label: a.kind.toUpperCase() };
                  return (
                    <div key={i} style={{
                      background: "var(--surface)",
                      border: `1px solid ${theme.color}22`, borderRadius: 3,
                      padding: "10px 14px",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ width: 6, height: 6, background: theme.color, borderRadius: 1 }} />
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>{a.bucket}</span>
                          <span style={{ fontSize: 8, fontFamily: MONO, fontWeight: 700, letterSpacing: "0.18em", color: theme.color }}>
                            {theme.label}
                          </span>
                        </div>
                        <span style={{ fontSize: 14, fontFamily: MONO, color: theme.color, letterSpacing: "-0.01em" }}>
                          {fmtUsd(a.amount)}
                        </span>
                      </div>
                      <p style={{ fontSize: 11, color: "var(--t3)", lineHeight: 1.5 }}>{a.reasoning}</p>
                    </div>
                  );
                })}
              </div>

              {/* Total + remainder */}
              <div style={{
                display: "flex", justifyContent: "space-between",
                paddingTop: 10, borderTop: "1px solid var(--border)",
              }}>
                <span style={{ fontSize: 11, color: "var(--t3)", fontFamily: MONO, letterSpacing: "0.14em" }}>
                  TOTAL ALLOCATED · {fmtUsd(total)}
                </span>
                <span style={{
                  fontSize: 11, fontFamily: MONO, letterSpacing: "0.14em",
                  color: Math.abs(remainder) < 1 ? "var(--green)" : remainder < 0 ? "var(--red)" : "var(--blue)",
                }}>
                  {Math.abs(remainder) < 1 ? "FULLY ALLOCATED" : `${remainder < 0 ? "−" : "+"}${fmtUsd(Math.abs(remainder))} REMAINDER`}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 26px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
          <button onClick={onClose} style={{
            padding: "8px 14px", borderRadius: 2,
            background: "transparent", border: "1px solid var(--border)",
            color: "var(--t3)", cursor: "pointer",
            fontFamily: MONO, fontSize: 11, letterSpacing: "0.16em",
          }}>CLOSE</button>
          {step === "input" && (
            <button
              onClick={() => parseFloat(amount) > 0 && void compute(parseFloat(amount), source || undefined)}
              disabled={!parseFloat(amount)}
              style={{
                padding: "8px 18px", borderRadius: 2,
                background: parseFloat(amount) > 0 ? "var(--blue-dim)" : "var(--surface2)",
                border: "1px solid var(--blue-border)",
                color: parseFloat(amount) > 0 ? "var(--blue)" : "var(--t4)",
                cursor: parseFloat(amount) > 0 ? "pointer" : "default",
                fontFamily: MONO, fontSize: 11, letterSpacing: "0.18em", fontWeight: 700,
              }}
            >
              ASK M.A.X.
            </button>
          )}
          {step === "review" && plan && (
            <button onClick={handleAccept} disabled={accepting} style={{
              padding: "8px 18px", borderRadius: 2,
              background: "var(--blue-dim)", border: "1px solid var(--blue-border)",
              color: "var(--blue)", cursor: accepting ? "default" : "pointer",
              fontFamily: MONO, fontSize: 11, letterSpacing: "0.18em", fontWeight: 700,
            }}>
              {accepting ? "ACCEPTING…" : `ACCEPT (${plan.allocations.length})`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
