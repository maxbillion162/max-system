"use client";

const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

interface DiscretionaryTrackerProps {
  needs:        number;
  wants:        number;
  savings:      number;
  investment:   number;
  income:       number;
  goalWantsPct?: number;   // user's stated max wants %, e.g. 30
}

function fmtUsd(n: number): string {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function DiscretionaryTracker({ needs, wants, savings, investment, income, goalWantsPct = 30 }: DiscretionaryTrackerProps) {
  const total = needs + wants + savings + investment;
  const pctOf = (n: number) => total > 0 ? (n / total) * 100 : 0;
  const wantsPctOfIncome = income > 0 ? (wants / income) * 100 : null;

  // 50/30/20 reference — not enforced, just shown for orientation
  const sections = [
    { label: "NEEDS",      color: "#5FB07D", value: needs,      pct: pctOf(needs) },
    { label: "WANTS",      color: "#B89A6E", value: wants,      pct: pctOf(wants) },
    { label: "SAVINGS",    color: "#7DB8E8", value: savings,    pct: pctOf(savings) },
    { label: "INVESTMENT", color: "#9B7BC2", value: investment, pct: pctOf(investment) },
  ];

  const isOverGoal = wantsPctOfIncome !== null && wantsPctOfIncome > goalWantsPct;

  return (
    <div style={{
      background: "linear-gradient(160deg, #0f141d 0%, #080b11 100%)",
      border: "1px solid rgba(125,184,232,0.10)", borderRadius: 3,
      padding: "16px 18px",
      display: "flex", flexDirection: "column", gap: 14,
    }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.32em", color: "var(--blue)", fontFamily: MONO }}>
          NEEDS · WANTS · SAVINGS
        </span>
        {wantsPctOfIncome !== null && (
          <span style={{
            fontSize: 10, fontFamily: MONO, letterSpacing: "0.14em",
            color: isOverGoal ? "var(--red)" : "var(--green)",
          }}>
            WANTS {wantsPctOfIncome.toFixed(0)}% OF INCOME
            <span style={{ color: "var(--t4)", marginLeft: 6 }}>· goal &lt;{goalWantsPct}%</span>
          </span>
        )}
      </div>

      {/* Stacked horizontal bar */}
      {total > 0 ? (
        <div style={{ display: "flex", height: 10, borderRadius: 1, overflow: "hidden", background: "var(--surface2)" }}>
          {sections.map(s => (
            s.value > 0 && (
              <div
                key={s.label}
                title={`${s.label}: ${fmtUsd(s.value)} (${s.pct.toFixed(0)}%)`}
                style={{
                  width: `${s.pct}%`,
                  background: s.color,
                  borderRight: "1px solid #080b11",
                  transition: "width 0.6s ease",
                }}
              />
            )
          ))}
        </div>
      ) : (
        <p style={{ fontSize: 12, color: "var(--t4)", fontFamily: MONO, letterSpacing: "0.1em", textAlign: "center", padding: "8px 0" }}>
          no allocations yet
        </p>
      )}

      {/* Legend */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {sections.map(s => (
          <div key={s.label}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
              <span style={{ width: 8, height: 2, background: s.color }} />
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", color: "var(--t3)", fontFamily: MONO }}>
                {s.label}
              </span>
            </div>
            <p style={{ fontSize: 14, fontWeight: 500, color: "var(--t1)", fontFamily: MONO, letterSpacing: "-0.01em" }}>
              {fmtUsd(s.value)}
            </p>
            <p style={{ fontSize: 9, color: "var(--t4)", fontFamily: MONO }}>
              {s.pct.toFixed(0)}%
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
