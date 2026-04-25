"use client";

import { useState, useRef, useEffect } from "react";
import { FeedbackControl } from "@/components/ui/FeedbackControl";

const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

const QUICK_PROMPTS = [
  "How much did I spend this month vs last?",
  "What are my top 5 merchants this year?",
  "Am I on track for $10K emergency fund by August?",
  "Which subscriptions am I paying for?",
];

export function FinanceQueryBar() {
  const [value, setValue]   = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [answerId, setAnswerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function ask(q?: string) {
    const query = (q ?? value).trim();
    if (!query) return;
    setLoading(true); setError(null); setAnswer(null);
    if (q) setValue(q);
    try {
      const res = await fetch("/api/finance/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setAnswer(data.answer ?? "(no response)");
        setAnswerId(`fq-${Date.now()}`);
      }
    } catch {
      setError("M.A.X. couldn't reach the agent. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      background: "linear-gradient(160deg, #0f141d 0%, #080b11 100%)",
      border: "1px solid rgba(125,184,232,0.10)", borderRadius: 3,
      padding: "14px 18px",
      display: "flex", flexDirection: "column", gap: 12,
    }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.32em", color: "var(--blue)", fontFamily: MONO, flexShrink: 0 }}>
          ASK M.A.X.
        </span>
        <div style={{
          flex: 1,
          display: "flex", alignItems: "center", gap: 8,
          background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 2,
          padding: "8px 12px",
        }}>
          <input
            ref={inputRef}
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") void ask(); }}
            placeholder="How much did I spend at Chipotle this year?"
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              color: "var(--t1)", fontSize: 13, fontFamily: "inherit",
            }}
          />
          <span style={{
            fontSize: 9, color: "var(--t4)", fontFamily: MONO, letterSpacing: "0.16em",
            padding: "2px 6px", border: "1px solid var(--border)", borderRadius: 2,
          }}>
            /
          </span>
        </div>
        <button
          onClick={() => void ask()}
          disabled={loading || !value.trim()}
          style={{
            background: loading ? "var(--surface2)" : "var(--blue-dim)",
            border: "1px solid var(--blue-border)",
            color: "var(--blue)", padding: "8px 16px", borderRadius: 2,
            cursor: loading || !value.trim() ? "default" : "pointer",
            fontFamily: MONO, fontSize: 10, letterSpacing: "0.18em",
            opacity: !value.trim() ? 0.4 : 1,
            transition: "opacity .15s",
          }}
        >
          {loading ? "THINKING…" : "ASK"}
        </button>
      </div>

      {/* Quick prompts */}
      {!answer && !loading && !error && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {QUICK_PROMPTS.map(q => (
            <button
              key={q}
              onClick={() => void ask(q)}
              style={{
                background: "transparent", border: "1px solid var(--border)",
                borderRadius: 2, padding: "5px 11px",
                color: "var(--t3)", cursor: "pointer",
                fontSize: 11, transition: "color .15s, border-color .15s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--blue)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--blue-border)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--t3)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; }}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Answer */}
      {(loading || answer || error) && (
        <div style={{
          borderTop: "1px solid var(--border)", paddingTop: 12,
          display: "flex", flexDirection: "column", gap: 8,
        }}>
          {loading && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 6, height: 6, borderRadius: "50%", background: "var(--blue)", opacity: 0.6,
                  animation: `bounce 0.8s ease-in-out ${i * 0.18}s infinite`,
                }} />
              ))}
              <span style={{ fontSize: 11, color: "var(--t3)", fontFamily: MONO, letterSpacing: "0.1em" }}>
                M.A.X. IS REASONING…
              </span>
            </div>
          )}
          {error && (
            <p style={{ fontSize: 12, color: "var(--red)", fontFamily: "inherit" }}>{error}</p>
          )}
          {answer && (
            <>
              <p style={{ fontSize: 13, color: "var(--t1)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                {answer}
              </p>
              {answerId && (
                <FeedbackControl
                  artifactType="finance_query"
                  artifactId={answerId}
                  metadata={{ query: value }}
                  variant="inline"
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
