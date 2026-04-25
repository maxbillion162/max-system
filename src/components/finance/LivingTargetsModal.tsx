"use client";

import { useEffect, useState } from "react";
import { FeedbackControl } from "@/components/ui/FeedbackControl";

const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

interface Suggestion {
  category:         string;
  current_target:   number;
  suggested_target: number;
  monthly_avg:      number;
  reasoning:        string;
}

interface Props {
  open:    boolean;
  onClose: () => void;
  onApply: (rows: { category: string; budgeted: number }[]) => Promise<void>;
}

export function LivingTargetsModal({ open, onClose, onApply }: Props) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Map<string, number>>(new Map());
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true); setError(null); setSuggestions([]); setChosen(new Map());
    fetch("/api/budget/living-targets", { method: "POST" })
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setError(data.error);
        } else if (!data.suggestions || data.suggestions.length === 0) {
          setError(data.reason ?? "No suggestions available right now.");
        } else {
          setSuggestions(data.suggestions);
          // Pre-select all as accepted
          setChosen(new Map(data.suggestions.map((s: Suggestion) => [s.category, s.suggested_target])));
        }
      })
      .catch(() => setError("Couldn't reach M.A.X."))
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function setRow(category: string, value: number | null) {
    setChosen(prev => {
      const next = new Map(prev);
      if (value === null) next.delete(category);
      else next.set(category, value);
      return next;
    });
  }

  async function handleApply() {
    setApplying(true);
    try {
      const rows = Array.from(chosen.entries()).map(([category, budgeted]) => ({ category, budgeted }));
      if (rows.length > 0) await onApply(rows);
      onClose();
    } finally {
      setApplying(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.78)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 28,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "linear-gradient(160deg, #0f141d 0%, #080b11 100%)",
          border: "1px solid var(--blue-border)", borderRadius: 3,
          width: "100%", maxWidth: 720, maxHeight: "85vh",
          display: "flex", flexDirection: "column",
        }}
      >
        {/* Header */}
        <div style={{ padding: "20px 26px", borderBottom: "1px solid var(--border)" }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.32em", color: "var(--blue)", fontFamily: MONO, marginBottom: 6 }}>
            ✦ LIVING TARGETS
          </p>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--t1)", letterSpacing: "-0.01em" }}>
            Realistic, slightly-leaner targets based on your last 90 days
          </h2>
          <p style={{ fontSize: 12, color: "var(--t3)", marginTop: 6, lineHeight: 1.5 }}>
            Aspirational budgets you never hit train you to ignore your own budget. M.A.X.&apos;s
            proposed targets sit 10-15% below your actual monthly average per category — small wins,
            compounded.
          </p>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 26px" }}>
          {loading && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 0", gap: 8 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 6, height: 6, borderRadius: "50%", background: "var(--blue)", opacity: 0.6,
                  animation: `bounce 0.8s ease-in-out ${i * 0.18}s infinite`,
                }} />
              ))}
              <span style={{ fontSize: 11, color: "var(--t3)", fontFamily: MONO, letterSpacing: "0.12em", marginLeft: 6 }}>
                M.A.X. IS READING YOUR HISTORY…
              </span>
            </div>
          )}

          {error && !loading && (
            <p style={{ fontSize: 13, color: "var(--t3)", lineHeight: 1.6, padding: "20px 0" }}>
              {error}
            </p>
          )}

          {suggestions.length > 0 && !loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {suggestions.map(s => {
                const isAccepted = chosen.has(s.category);
                const value = chosen.get(s.category) ?? s.suggested_target;
                return (
                  <div key={s.category} style={{
                    background: isAccepted ? "rgba(125,184,232,0.04)" : "transparent",
                    border: `1px solid ${isAccepted ? "var(--blue-border)" : "var(--border)"}`,
                    borderRadius: 3, padding: "12px 14px",
                  }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 6 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>{s.category}</span>
                          <span style={{ fontSize: 9, color: "var(--t4)", fontFamily: MONO, letterSpacing: "0.14em" }}>
                            {s.current_target > 0 ? `WAS $${s.current_target}` : "NEW"}
                          </span>
                          <span style={{ fontSize: 9, color: "var(--t4)", fontFamily: MONO, letterSpacing: "0.14em" }}>
                            · 90-DAY AVG ${s.monthly_avg}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, color: "var(--t3)", fontFamily: MONO }}>$</span>
                        <input
                          type="number"
                          value={value}
                          onChange={(e) => setRow(s.category, Math.max(0, parseInt(e.target.value, 10) || 0))}
                          disabled={!isAccepted}
                          style={{
                            width: 72,
                            background: "var(--surface2)",
                            border: "1px solid var(--border2)",
                            borderRadius: 2,
                            padding: "5px 8px",
                            color: isAccepted ? "var(--t1)" : "var(--t4)",
                            fontFamily: MONO, fontSize: 13,
                            outline: "none",
                            textAlign: "right",
                          }}
                        />
                        <button
                          onClick={() => isAccepted ? setRow(s.category, null) : setRow(s.category, s.suggested_target)}
                          style={{
                            padding: "5px 10px", borderRadius: 2,
                            background: isAccepted ? "rgba(95,176,125,0.12)" : "transparent",
                            border: `1px solid ${isAccepted ? "rgba(95,176,125,0.4)" : "var(--border)"}`,
                            color: isAccepted ? "var(--green)" : "var(--t3)",
                            fontFamily: MONO, fontSize: 9, letterSpacing: "0.16em", fontWeight: 700,
                            cursor: "pointer", minWidth: 70,
                          }}
                        >
                          {isAccepted ? "✓ ACCEPT" : "ACCEPT"}
                        </button>
                      </div>
                    </div>
                    <p style={{ fontSize: 12, color: "var(--t3)", lineHeight: 1.5 }}>{s.reasoning}</p>
                    <div style={{ marginTop: 6 }}>
                      <FeedbackControl
                        artifactType="living_target"
                        artifactId={`lt-${s.category}-${Date.now()}`}
                        metadata={{ category: s.category, suggested: s.suggested_target, avg: s.monthly_avg }}
                        variant="inline"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "14px 26px", borderTop: "1px solid var(--border)",
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
        }}>
          <span style={{ fontSize: 11, color: "var(--t3)", fontFamily: MONO, letterSpacing: "0.1em" }}>
            {chosen.size} of {suggestions.length} accepted
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onClose} style={{
              padding: "8px 14px", borderRadius: 2,
              background: "transparent", border: "1px solid var(--border)",
              color: "var(--t3)", cursor: "pointer",
              fontFamily: MONO, fontSize: 11, letterSpacing: "0.16em",
            }}>CANCEL</button>
            <button
              onClick={handleApply}
              disabled={chosen.size === 0 || applying}
              style={{
                padding: "8px 18px", borderRadius: 2,
                background: chosen.size > 0 ? "var(--blue-dim)" : "var(--surface2)",
                border: "1px solid var(--blue-border)",
                color: chosen.size > 0 ? "var(--blue)" : "var(--t4)",
                cursor: chosen.size > 0 && !applying ? "pointer" : "default",
                opacity: chosen.size === 0 ? 0.4 : 1,
                fontFamily: MONO, fontSize: 11, letterSpacing: "0.18em", fontWeight: 700,
              }}
            >
              {applying ? "APPLYING…" : `APPLY (${chosen.size})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
