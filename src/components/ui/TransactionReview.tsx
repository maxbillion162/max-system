"use client";

import { useState, useEffect, useCallback } from "react";

export interface ReviewTransaction {
  id: string;
  merchant: string;
  merchant_normalized: string;
  amount: number;
  date: string;
  budget_category: string;
  confidence?: number;
}

interface Props {
  transactions: ReviewTransaction[];
  categories: string[];
  categoryColors: Record<string, string>;
  onConfirm: (tx: ReviewTransaction, category: string) => Promise<void>;
  onDone: () => void;
}

export default function TransactionReview({ transactions, categories, categoryColors, onConfirm, onDone }: Props) {
  const [idx,        setIdx]        = useState(0);
  const [slide,      setSlide]      = useState<"left" | "right" | null>(null);
  const [choosing,   setChoosing]   = useState(false);
  const [confirmed,  setConfirmed]  = useState(0);

  const current = transactions[idx];
  const total   = transactions.length;
  const done    = idx >= total;

  const advance = useCallback((direction: "left" | "right", newCategory?: string) => {
    if (!current) return;
    const cat = direction === "right" ? current.budget_category : newCategory ?? current.budget_category;
    setSlide(direction);
    setTimeout(async () => {
      await onConfirm(current, cat);
      setConfirmed(c => c + 1);
      setIdx(i => i + 1);
      setSlide(null);
      setChoosing(false);
    }, 280);
  }, [current, onConfirm]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (done || choosing) return;
      if (e.key === "ArrowRight") advance("right");
      if (e.key === "ArrowLeft")  setChoosing(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [done, choosing, advance]);

  if (done) {
    return (
      <div style={{ textAlign: "center", padding: "40px 20px" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>✦</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--t1)", marginBottom: 6 }}>All done — {confirmed} transactions confirmed</div>
        <div style={{ fontSize: 13, color: "var(--t3)", marginBottom: 24 }}>M.A.X. will remember these rules for future transactions.</div>
        <button onClick={onDone} style={{ padding: "10px 24px", borderRadius: 8, fontSize: 13, fontWeight: 700, background: "rgba(69,137,255,0.15)", border: "1px solid rgba(69,137,255,0.35)", color: "var(--blue)", cursor: "pointer" }}>
          Done
        </button>
      </div>
    );
  }

  const color  = categoryColors[current.budget_category] ?? "#4589ff";
  const pctDone = (idx / total) * 100;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
      {/* Progress */}
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: "var(--t4)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Review Progress</div>
          <div style={{ fontSize: 11, color: "var(--t3)", fontWeight: 600 }}>{idx} / {total}</div>
        </div>
        <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,0.06)" }}>
          <div style={{ height: "100%", borderRadius: 2, background: "var(--blue)", width: `${pctDone}%`, transition: "width 0.3s ease" }} />
        </div>
      </div>

      {/* Card */}
      <div style={{
        width: "100%", maxWidth: 420, position: "relative", userSelect: "none",
        transform: slide === "right" ? "translateX(120%) rotate(8deg)" : slide === "left" ? "translateX(-120%) rotate(-8deg)" : "translateX(0)",
        opacity: slide ? 0 : 1,
        transition: "transform 0.28s cubic-bezier(0.4,0,0.2,1), opacity 0.28s ease",
      }}>
        <div style={{
          background: "linear-gradient(135deg, #0c0f1c, #080a14)",
          border: `1px solid ${color}35`,
          borderRadius: 16,
          padding: "28px 28px 24px",
          boxShadow: `0 12px 48px rgba(0,0,0,0.5), 0 0 30px ${color}10`,
        }}>
          {/* M.A.X. badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(69,137,255,0.6)" }}>M.A.X. categorized</div>
          </div>

          {/* Merchant */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
            <div style={{ width: 52, height: 52, borderRadius: 12, background: `${color}18`, border: `1px solid ${color}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color, flexShrink: 0 }}>
              {current.merchant.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--t1)", marginBottom: 4 }}>{current.merchant}</div>
              <div style={{ fontSize: 13, color: "var(--t4)" }}>
                {new Date(current.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              </div>
            </div>
            <div style={{ marginLeft: "auto", textAlign: "right" }}>
              <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "monospace", color: "var(--red)" }}>-${current.amount.toFixed(2)}</div>
            </div>
          </div>

          {/* Suggested category */}
          <div style={{ padding: "16px 20px", borderRadius: 10, background: `${color}12`, border: `1px solid ${color}25`, marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--t4)", marginBottom: 8 }}>Suggested Category</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
              <div style={{ fontSize: 18, fontWeight: 700, color }}>
                {current.budget_category}
              </div>
            </div>
          </div>

          {/* Keyboard hint */}
          <div style={{ fontSize: 11, color: "rgba(148,163,184,0.25)", textAlign: "center" }}>
            ← wrong &nbsp;&nbsp;·&nbsp;&nbsp; → correct
          </div>
        </div>
      </div>

      {/* Category picker (shown when wrong) */}
      {choosing ? (
        <div style={{ width: "100%", maxWidth: 420 }}>
          <div style={{ fontSize: 12, color: "var(--t3)", marginBottom: 12, textAlign: "center" }}>Pick the correct category:</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {categories.map(cat => {
              const c = categoryColors[cat] ?? "#4589ff";
              return (
                <button
                  key={cat}
                  onClick={() => advance("left", cat)}
                  style={{
                    padding: "10px 8px", borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: "pointer",
                    background: `${c}12`, border: `1px solid ${c}28`, color: c,
                    transition: "all 0.12s", textAlign: "center",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${c}25`; (e.currentTarget as HTMLElement).style.borderColor = `${c}50`; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${c}12`; (e.currentTarget as HTMLElement).style.borderColor = `${c}28`; }}
                >
                  {cat}
                </button>
              );
            })}
          </div>
          <button onClick={() => setChoosing(false)} style={{ marginTop: 12, width: "100%", padding: "9px 0", borderRadius: 7, background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "var(--t4)", fontSize: 12, cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      ) : (
        /* Action buttons */
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <button
            onClick={() => setChoosing(true)}
            title="Wrong category (←)"
            style={{
              width: 56, height: 56, borderRadius: "50%", cursor: "pointer",
              background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
              color: "var(--red)", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, transition: "all 0.15s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.2)"; (e.currentTarget as HTMLElement).style.transform = "scale(1.08)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.1)"; (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
          >
            ✕
          </button>

          <div style={{ fontSize: 11, color: "rgba(148,163,184,0.25)", textAlign: "center", lineHeight: 1.5 }}>
            wrong<br />or correct
          </div>

          <button
            onClick={() => advance("right")}
            title="Correct category (→)"
            style={{
              width: 56, height: 56, borderRadius: "50%", cursor: "pointer",
              background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)",
              color: "var(--green)", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, transition: "all 0.15s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(16,185,129,0.2)"; (e.currentTarget as HTMLElement).style.transform = "scale(1.08)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(16,185,129,0.1)"; (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
          >
            ✓
          </button>
        </div>
      )}
    </div>
  );
}
