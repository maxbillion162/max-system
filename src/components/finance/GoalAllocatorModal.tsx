"use client";

import { useEffect, useState } from "react";
import { FeedbackControl } from "@/components/ui/FeedbackControl";

const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

interface Goal {
  id:       string;
  label:    string;
  current:  number;
  target:   number;
  unit?:    string;
  deadline?: string | null;
  category?: string | null;
  color?:    string;
}

interface DistributionRow {
  category:       string;
  budgeted:       number;
  classification: string;
  reasoning:      string;
}

interface Plan {
  goal:                     { id: string; label: string; current: number; target: number; deadline: string | null };
  income:                   number;
  monthly_savings_required: number;
  deadline_feasible:        boolean;
  summary:                  string;
  distribution:             DistributionRow[];
  total_budgeted:           number;
  unallocated:              number;
}

interface Props {
  open:    boolean;
  goals:   Goal[];
  onClose: () => void;
  onApply: (rows: { category: string; budgeted: number }[]) => Promise<void>;
}

const CLASS_COLOR: Record<string, string> = {
  need: "#5FB07D", want: "#B89A6E", savings: "#7DB8E8", investment: "#9B7BC2",
};

function fmtUsd(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export function GoalAllocatorModal({ open, goals, onClose, onApply }: Props) {
  const [step, setStep] = useState<"pick" | "loading" | "review" | "error">("pick");
  const [chosenGoalId, setChosenGoalId] = useState<string | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!open) { setStep("pick"); setChosenGoalId(null); setPlan(null); setError(null); setEdits({}); }
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function handlePick(goalId: string) {
    setChosenGoalId(goalId);
    setStep("loading");
    setError(null);
    try {
      const res = await fetch("/api/budget/suggest-allocation", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal_id: goalId }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setStep("error");
      } else {
        setPlan(data.plan);
        setEdits({});
        setStep("review");
      }
    } catch {
      setError("Couldn't reach M.A.X.");
      setStep("error");
    }
  }

  async function handleApply() {
    if (!plan) return;
    setApplying(true);
    try {
      const rows = plan.distribution.map(d => ({
        category: d.category,
        budgeted: edits[d.category] ?? d.budgeted,
      }));
      await onApply(rows);
      onClose();
    } finally {
      setApplying(false);
    }
  }

  if (!open) return null;

  const editedTotal = plan
    ? plan.distribution.reduce((s, d) => s + (edits[d.category] ?? d.budgeted), 0)
    : 0;
  const editedUnallocated = plan ? plan.income - editedTotal : 0;

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(0,0,0,0.78)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 28,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "linear-gradient(160deg, #0f141d 0%, #080b11 100%)",
        border: "1px solid var(--blue-border)", borderRadius: 3,
        width: "100%", maxWidth: 760, maxHeight: "88vh",
        display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{ padding: "20px 26px", borderBottom: "1px solid var(--border)" }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.32em", color: "var(--blue)", fontFamily: MONO, marginBottom: 6 }}>
            ⊕ GOAL-DRIVEN ALLOCATOR
          </p>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--t1)", letterSpacing: "-0.01em" }}>
            {step === "pick" ? "Pick the goal that drives this budget" : plan ? `Budget designed to hit ${plan.goal.label}` : "Working backwards from your goal…"}
          </h2>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 26px" }}>
          {step === "pick" && (
            goals.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--t3)", padding: "30px 0", textAlign: "center", lineHeight: 1.6 }}>
                You don&apos;t have any active goals yet. Add one on the Discipline page first, then come back.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <p style={{ fontSize: 12, color: "var(--t3)", marginBottom: 8, lineHeight: 1.5 }}>
                  M.A.X. will read your last 90 days of spending, compute the monthly contribution your goal needs, then propose a distribution that fits — trimming wants, preserving needs.
                </p>
                {goals.map(g => {
                  const remaining = Math.max(0, g.target - g.current);
                  const monthsToGo = g.deadline
                    ? Math.max(1, Math.round((new Date(g.deadline).getTime() - Date.now()) / (30 * 24 * 60 * 60 * 1000)))
                    : 12;
                  const monthlyRequired = remaining / monthsToGo;
                  return (
                    <button key={g.id} onClick={() => handlePick(g.id)} style={{
                      textAlign: "left", padding: "12px 14px", borderRadius: 3,
                      background: "var(--surface)", border: "1px solid var(--border)",
                      cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
                      transition: "border-color .15s, background .15s",
                    }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--blue-border)"; e.currentTarget.style.background = "var(--blue-dim)"; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--surface)"; }}
                    >
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", marginBottom: 2 }}>{g.label}</p>
                        <p style={{ fontSize: 11, color: "var(--t3)", fontFamily: MONO, letterSpacing: "0.06em" }}>
                          {fmtUsd(g.current)} / {fmtUsd(g.target)}
                          {g.deadline && <span> · by {new Date(g.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>}
                        </p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ fontSize: 14, fontFamily: MONO, color: "var(--blue)", letterSpacing: "-0.01em" }}>
                          {fmtUsd(monthlyRequired)}<span style={{ fontSize: 10, color: "var(--t4)", marginLeft: 3 }}>/MO</span>
                        </p>
                        <p style={{ fontSize: 9, color: "var(--t4)", fontFamily: MONO, letterSpacing: "0.14em", marginTop: 2 }}>
                          REQUIRED
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )
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
                M.A.X. IS DESIGNING THE BUDGET…
              </span>
            </div>
          )}

          {step === "error" && (
            <div style={{ padding: "30px 0", textAlign: "center" }}>
              <p style={{ fontSize: 13, color: "var(--red)", marginBottom: 12 }}>{error}</p>
              <button onClick={() => setStep("pick")} style={{
                padding: "8px 16px", borderRadius: 2, background: "transparent",
                border: "1px solid var(--border)", color: "var(--t2)", cursor: "pointer",
                fontFamily: MONO, fontSize: 11, letterSpacing: "0.16em",
              }}>← BACK</button>
            </div>
          )}

          {step === "review" && plan && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Summary */}
              <div style={{ background: "var(--blue-dim)", border: "1px solid var(--blue-border)", borderRadius: 3, padding: "12px 14px" }}>
                <div style={{ display: "flex", gap: 16, marginBottom: 8 }}>
                  <Stat label="GOAL CONTRIBUTION" value={fmtUsd(plan.monthly_savings_required) + "/mo"} color="var(--blue)" />
                  <Stat label="INCOME" value={fmtUsd(plan.income)} color="var(--green)" />
                  <Stat label="UNALLOCATED" value={fmtUsd(editedUnallocated)} color={editedUnallocated < 0 ? "var(--red)" : "var(--t1)"} />
                </div>
                <p style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.6 }}>{plan.summary}</p>
                <FeedbackControl
                  artifactType="goal_allocation"
                  artifactId={`ga-${plan.goal.id}-${Date.now()}`}
                  metadata={{ goal: plan.goal.label, monthly: plan.monthly_savings_required }}
                  variant="inline"
                />
                {!plan.deadline_feasible && (
                  <p style={{ fontSize: 11, color: "var(--red)", marginTop: 8, fontFamily: MONO, letterSpacing: "0.1em" }}>
                    ⚠ DEADLINE ALREADY PASSED OR UNREALISTIC GIVEN INCOME
                  </p>
                )}
              </div>

              {/* Distribution */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {plan.distribution.map(d => {
                  const value = edits[d.category] ?? d.budgeted;
                  const accent = CLASS_COLOR[d.classification] ?? "#7DB8E8";
                  return (
                    <div key={d.category} style={{
                      background: "var(--surface)", border: `1px solid ${accent}22`,
                      borderRadius: 3, padding: "10px 14px",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ width: 6, height: 6, background: accent, borderRadius: 1 }} />
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>{d.category}</span>
                          <span style={{ fontSize: 8, fontFamily: MONO, fontWeight: 700, letterSpacing: "0.18em", color: accent }}>
                            {(d.classification ?? "WANT").toUpperCase()}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 11, color: "var(--t3)", fontFamily: MONO }}>$</span>
                          <input
                            type="number"
                            value={value}
                            onChange={e => setEdits(prev => ({ ...prev, [d.category]: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
                            style={{
                              width: 72, background: "var(--surface2)",
                              border: "1px solid var(--border2)", borderRadius: 2,
                              padding: "5px 8px", color: "var(--t1)",
                              fontFamily: MONO, fontSize: 13, outline: "none",
                              textAlign: "right",
                            }}
                          />
                        </div>
                      </div>
                      <p style={{ fontSize: 11, color: "var(--t3)", lineHeight: 1.5 }}>{d.reasoning}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 26px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button onClick={step === "review" ? () => setStep("pick") : onClose} style={{
            padding: "8px 14px", borderRadius: 2,
            background: "transparent", border: "1px solid var(--border)",
            color: "var(--t3)", cursor: "pointer",
            fontFamily: MONO, fontSize: 11, letterSpacing: "0.16em",
          }}>{step === "review" ? "← PICK ANOTHER GOAL" : "CLOSE"}</button>
          {step === "review" && plan && (
            <button onClick={handleApply} disabled={applying} style={{
              padding: "8px 18px", borderRadius: 2,
              background: "var(--blue-dim)", border: "1px solid var(--blue-border)",
              color: "var(--blue)", cursor: applying ? "default" : "pointer",
              fontFamily: MONO, fontSize: 11, letterSpacing: "0.18em", fontWeight: 700,
            }}>
              {applying ? "APPLYING…" : `APPLY BUDGET (${plan.distribution.length})`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <p style={{ fontSize: 9, fontFamily: MONO, fontWeight: 700, letterSpacing: "0.18em", color: "var(--t3)" }}>{label}</p>
      <p style={{ fontSize: 16, fontFamily: MONO, color, letterSpacing: "-0.01em", marginTop: 2 }}>{value}</p>
    </div>
  );
}
