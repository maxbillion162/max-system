"use client";

import { useEffect, useState } from "react";
import { FeedbackControl } from "@/components/ui/FeedbackControl";

const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

interface Pattern {
  title:           string;
  body:            string;
  severity:        "win" | "watch" | "warn" | string;
  evidence_metric: string;
}

interface DnaRow {
  id:                    string;
  patterns:              Pattern[];
  baseline_period_start: string;
  baseline_period_end:   string;
  txn_count:             number;
  generated_at:          string;
}

const SEV_COLORS: Record<string, { fg: string; bg: string; bd: string; label: string }> = {
  win:   { fg: "var(--green)",  bg: "rgba(95,176,125,0.08)", bd: "rgba(95,176,125,0.4)", label: "WIN" },
  watch: { fg: "var(--blue)",   bg: "rgba(125,184,232,0.06)", bd: "var(--blue-border)",  label: "WATCH" },
  warn:  { fg: "var(--red)",    bg: "rgba(200,90,90,0.08)",  bd: "rgba(200,90,90,0.4)",  label: "WARN" },
};

export function MoneyDNA() {
  const [dna, setDna] = useState<DnaRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [emptyReason, setEmptyReason] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/finance/money-dna");
      const json = await res.json();
      if (json.dna) setDna(json.dna);
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    setRefreshing(true);
    setEmptyReason(null);
    try {
      const res = await fetch("/api/finance/money-dna", { method: "POST" });
      const json = await res.json();
      if (json.dna) setDna(json.dna);
      else if (json.empty_reason) setEmptyReason(json.empty_reason);
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => { void load(); }, []);

  return (
    <div style={{
      background: "linear-gradient(160deg, #0f141d 0%, #080b11 100%)",
      border: "1px solid rgba(125,184,232,0.10)", borderRadius: 3,
    }}>
      {/* Header */}
      <div style={{ padding: "16px 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.32em", color: "var(--blue)", fontFamily: MONO }}>
            MONEY DNA
          </span>
          <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 4, fontFamily: MONO, letterSpacing: "0.06em" }}>
            {dna ? (
              <>BASELINE {dna.baseline_period_start} → {dna.baseline_period_end} · {dna.txn_count} TXNS · GENERATED {new Date(dna.generated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase()}</>
            ) : (
              <>YOUR SPENDING PERSONALITY · 6-MONTH ANALYSIS</>
            )}
          </p>
        </div>
        <button onClick={refresh} disabled={refreshing}
          style={{
            background: "transparent", border: "1px solid var(--border)",
            color: refreshing ? "var(--t4)" : "var(--t2)",
            padding: "6px 12px", borderRadius: 2,
            fontFamily: MONO, fontSize: 10, letterSpacing: "0.18em", fontWeight: 700,
            cursor: refreshing ? "default" : "pointer",
          }}>
          {refreshing ? "READING…" : "↻ REFRESH"}
        </button>
      </div>

      {/* States */}
      {loading && (
        <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--t4)", fontFamily: MONO, fontSize: 11 }}>
          loading DNA…
        </div>
      )}
      {!loading && !dna && !emptyReason && (
        <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--t3)", fontSize: 12, lineHeight: 1.6 }}>
          <p style={{ marginBottom: 6, color: "var(--t1)", fontWeight: 600 }}>No DNA yet</p>
          Hit REFRESH to read your last 6 months. Future weekly cron will keep it fresh.
        </div>
      )}
      {emptyReason && (
        <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--t3)", fontSize: 12, lineHeight: 1.6 }}>
          {emptyReason}
        </div>
      )}

      {/* Patterns */}
      {dna && dna.patterns.length > 0 && (
        <>
          <div style={{ padding: "0 20px 14px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10 }}>
            {dna.patterns.map((p, i) => {
              const sev = SEV_COLORS[p.severity] ?? SEV_COLORS.watch;
              return (
                <div key={i} style={{
                  background: sev.bg, border: `1px solid ${sev.bd}`,
                  borderLeft: `3px solid ${sev.fg}`,
                  borderRadius: 3, padding: "12px 14px",
                  display: "flex", flexDirection: "column", gap: 6,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{
                      fontSize: 9, fontWeight: 700, letterSpacing: "0.18em",
                      color: sev.fg, fontFamily: MONO,
                    }}>{sev.label}</span>
                  </div>
                  <p style={{ fontSize: 13, color: "var(--t1)", fontWeight: 600, lineHeight: 1.3 }}>
                    {p.title}
                  </p>
                  <p style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.5 }}>
                    {p.body}
                  </p>
                  {p.evidence_metric && (
                    <p style={{ fontSize: 10, color: "var(--t4)", fontFamily: MONO, letterSpacing: "0.1em", marginTop: 4 }}>
                      ↳ {p.evidence_metric}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Feedback on the whole reading */}
          <div style={{ borderTop: "1px solid var(--border)", padding: "10px 20px" }}>
            <FeedbackControl
              artifactType="money_dna"
              artifactId={dna.id}
              metadata={{ pattern_count: dna.patterns.length }}
              label="DOES THIS DNA RING TRUE?"
            />
          </div>
        </>
      )}
    </div>
  );
}
