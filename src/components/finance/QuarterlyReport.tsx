"use client";

import { useEffect, useState } from "react";
import { FeedbackControl } from "@/components/ui/FeedbackControl";

const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

interface Highlight { kind: string; text: string; value?: string }

interface Report {
  id:           string;
  period_label: string;
  period_start: string;
  period_end:   string;
  content:      string;
  highlights:   Highlight[] | null;
  generated_at: string;
  viewed_at:    string | null;
}

const KIND_COLORS: Record<string, string> = {
  win:    "var(--green)",
  leak:   "var(--red)",
  driver: "var(--blue)",
};

export function QuarterlyReport() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [expanded, setExpanded] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/finance/reports");
      const json = await res.json();
      const r: Report | undefined = (json.reports ?? [])[0];
      setReport(r ?? null);
      /* Auto-mark as viewed when loaded */
      if (r && !r.viewed_at) {
        await fetch("/api/finance/reports", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: r.id }),
        });
      }
    } finally {
      setLoading(false);
    }
  }

  async function generate() {
    setGenerating(true);
    try {
      const res = await fetch("/api/finance/reports", { method: "POST" });
      const json = await res.json();
      if (json.report) setReport(json.report);
    } finally {
      setGenerating(false);
    }
  }

  useEffect(() => { void load(); }, []);

  if (loading) {
    return (
      <div style={shell()}>
        <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--t4)", fontFamily: MONO, fontSize: 11 }}>
          loading quarterly report…
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div style={shell()}>
        <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <span style={label()}>QUARTERLY NARRATIVE</span>
            <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 4, lineHeight: 1.5 }}>
              No reports yet. Cron runs Apr/Jul/Oct/Jan 1st — or generate now for the previous quarter.
            </p>
          </div>
          <button onClick={generate} disabled={generating} style={btn(true)}>
            {generating ? "WRITING…" : "▶ GENERATE NOW"}
          </button>
        </div>
      </div>
    );
  }

  const isFresh = !report.viewed_at;
  const paragraphs = report.content.split(/\n\s*\n/).filter(p => p.trim());
  const visibleParagraphs = expanded ? paragraphs : paragraphs.slice(0, 1);

  return (
    <div style={shell()}>
      {/* Header */}
      <div style={{ padding: "16px 20px 10px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={label()}>QUARTERLY NARRATIVE</span>
            {isFresh && (
              <span style={{
                fontSize: 8, fontWeight: 700, letterSpacing: "0.18em", color: "var(--green)",
                background: "rgba(95,176,125,0.12)", border: "1px solid rgba(95,176,125,0.4)",
                padding: "2px 6px", borderRadius: 2, fontFamily: MONO,
              }}>NEW</span>
            )}
          </div>
          <p style={{ fontSize: 22, fontWeight: 600, color: "var(--t1)", marginTop: 6, fontFamily: MONO, letterSpacing: "-0.02em" }}>
            {report.period_label}
          </p>
          <p style={{ fontSize: 10, color: "var(--t4)", marginTop: 2, fontFamily: MONO, letterSpacing: "0.06em" }}>
            {report.period_start.toUpperCase()} → {report.period_end.toUpperCase()} · GENERATED {new Date(report.generated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase()}
          </p>
        </div>
        <button onClick={generate} disabled={generating} style={btn(false)}>
          {generating ? "WRITING…" : "↻ REGENERATE"}
        </button>
      </div>

      {/* Highlights */}
      {report.highlights && report.highlights.length > 0 && (
        <div style={{ padding: "0 20px 12px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
          {report.highlights.map((h, i) => {
            const color = KIND_COLORS[h.kind] ?? "var(--t2)";
            return (
              <div key={i} style={{
                background: `${color}10`, border: `1px solid ${color}40`, borderLeft: `3px solid ${color}`,
                borderRadius: 3, padding: "9px 12px",
              }}>
                <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", color, fontFamily: MONO }}>
                  {h.kind.toUpperCase()}{h.value ? ` · ${h.value}` : ""}
                </p>
                <p style={{ fontSize: 12, color: "var(--t1)", marginTop: 4, lineHeight: 1.4 }}>{h.text}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Narrative */}
      <div style={{ padding: "8px 22px 14px", borderTop: "1px solid var(--border)" }}>
        {visibleParagraphs.map((p, i) => (
          <p key={i} style={{ fontSize: 13, color: "var(--t1)", lineHeight: 1.65, marginBottom: 14 }}>
            {p}
          </p>
        ))}
        {paragraphs.length > 1 && (
          <button onClick={() => setExpanded(v => !v)}
            style={{
              background: "transparent", border: "none", color: "var(--blue)",
              fontFamily: MONO, fontSize: 10, letterSpacing: "0.18em", fontWeight: 700,
              cursor: "pointer", padding: 0,
            }}>
            {expanded ? "↑ COLLAPSE" : `↓ READ FULL · ${paragraphs.length - 1} MORE`}
          </button>
        )}
      </div>

      {/* Feedback */}
      <div style={{ padding: "8px 20px 12px", borderTop: "1px solid var(--border)" }}>
        <FeedbackControl
          artifactType="quarterly_narrative"
          artifactId={report.id}
          metadata={{ period: report.period_label }}
          label="DID THIS REPORT LAND?"
        />
      </div>
    </div>
  );
}

function shell(): React.CSSProperties {
  return {
    background: "linear-gradient(160deg, #0f141d 0%, #080b11 100%)",
    border: "1px solid rgba(125,184,232,0.10)", borderRadius: 3,
    display: "flex", flexDirection: "column",
  };
}
function label(): React.CSSProperties {
  return { fontSize: 9, fontWeight: 700, letterSpacing: "0.32em", color: "var(--blue)", fontFamily: MONO };
}
function btn(primary: boolean): React.CSSProperties {
  return {
    background: primary ? "var(--blue-dim)" : "transparent",
    border: `1px solid ${primary ? "var(--blue-border)" : "var(--border)"}`,
    color: primary ? "var(--blue)" : "var(--t2)",
    padding: "6px 12px", borderRadius: 2, cursor: "pointer",
    fontFamily: MONO, fontSize: 10, letterSpacing: "0.18em", fontWeight: 700,
  };
}
