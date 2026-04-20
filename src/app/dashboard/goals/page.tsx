"use client";

import { HudCard } from "@/components/ui/HudCard";

const GOALS = [
  {
    category: "Income", label: "$100K First Year",
    desc: "Hit $100K total compensation in your first full year as an Account Manager at the staffing firm.",
    current: 0, target: 100000, unit: "$", deadline: "Jul 2027", color: "var(--green)",
    colorHex: "#10b981", started: false,
    milestones: [{ l: "$25K", v: 25000 }, { l: "$50K", v: 50000 }, { l: "$75K", v: 75000 }, { l: "$100K", v: 100000 }],
    insight: "Job starts July 2026. Base + commission. Track every paycheck here.",
  },
  {
    category: "Finance", label: "Emergency Fund — $10K",
    desc: "Build a 3-month cash cushion before allocating aggressively to investments.",
    current: 2800, target: 10000, unit: "$", deadline: "Dec 2026", color: "var(--purple)",
    colorHex: "#8b5cf6", started: true,
    milestones: [{ l: "$2.5K", v: 2500, done: true }, { l: "$5K", v: 5000 }, { l: "$7.5K", v: 7500 }, { l: "$10K", v: 10000 }],
    insight: "At current pace: December 2026. Save $200/mo more to hit it in October.",
  },
  {
    category: "Fitness", label: "Gym 4×/Week — Full Year",
    desc: "Maintain 4+ gym sessions per week for 52 straight weeks. Push/Pull/Legs every cycle.",
    current: 12, target: 52, unit: "weeks", deadline: "Apr 2027", color: "var(--teal)",
    colorHex: "#06b6d4", started: true,
    milestones: [{ l: "1 month", v: 4, done: true }, { l: "3 months", v: 13 }, { l: "6 months", v: 26 }, { l: "1 year", v: 52 }],
    insight: "12 weeks in. Best streak: 18 days. You've built real momentum.",
  },
  {
    category: "Learning", label: "Master AI + Vibe Coding",
    desc: "Build real competency in Claude Code, Python basics, and AI-assisted workflows — not just familiarity.",
    current: 8, target: 30, unit: "sessions", deadline: "Sep 2026", color: "var(--orange)",
    colorHex: "#f97316", started: true,
    milestones: [{ l: "5 sessions", v: 5, done: true }, { l: "10", v: 10 }, { l: "20", v: 20 }, { l: "30", v: 30 }],
    insight: "8 sessions in. Next: finish M.A.X. build, then start a Python fundamentals track.",
  },
  {
    category: "Morning", label: "Morning Routine — 30 Days",
    desc: "Wake up by 7:30 AM and complete a consistent morning routine for 30 consecutive days before job starts.",
    current: 0, target: 30, unit: "days", deadline: "Jun 2026", color: "#ec4899",
    colorHex: "#ec4899", started: false,
    milestones: [{ l: "7 days", v: 7 }, { l: "14 days", v: 14 }, { l: "21 days", v: 21 }, { l: "30 days", v: 30 }],
    insight: "Critical before July start. Build the habit now while schedule is flexible.",
  },
];

export default function GoalsPage() {
  const avgPct = Math.round(GOALS.reduce((a, g) => a + (g.current / g.target) * 100, 0) / GOALS.length);
  const milestonesDone = GOALS.flatMap(g => g.milestones).filter(m => (m as { done?: boolean }).done).length;

  return (
    <div className="grid-bg min-h-screen" style={{ padding: "40px 48px" }}>
      <div style={{ maxWidth: 900 }}>

        <div className="mb-8 afu">
          <p className="text-sm font-semibold tracking-widest uppercase mb-2" style={{ color: "var(--teal)", opacity: .6 }}>Goals HQ</p>
          <h1 className="text-4xl font-black tracking-tight mb-2 grad-text">Your Targets</h1>
          <p className="text-base" style={{ color: "var(--t2)" }}>Every goal tracked. Every milestone visible. No excuses.</p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-5 mb-7">
          {[
            { label: "Active Goals",    val: GOALS.length.toString(),      color: "var(--teal)"  },
            { label: "Milestones Hit",  val: milestonesDone.toString(),    color: "var(--green)" },
            { label: "Avg Progress",    val: `${avgPct}%`,                 color: "var(--orange)"},
          ].map((s, i) => (
            <HudCard key={s.label} className="p-6" delay={i * .07}>
              <p className="text-sm font-semibold tracking-widest uppercase mb-3" style={{ color: "var(--t3)" }}>{s.label}</p>
              <div className="text-5xl font-black" style={{ color: s.color }}>{s.val}</div>
            </HudCard>
          ))}
        </div>

        {/* Goal cards */}
        <div className="space-y-6">
          {GOALS.map((g, gi) => {
            const pct = Math.min(100, Math.round((g.current / g.target) * 100));
            const C = 2 * Math.PI * 22;
            const dash = C - (pct / 100) * C;
            const dispVal = g.unit === "$"
              ? `$${g.current.toLocaleString()} of $${g.target.toLocaleString()}`
              : `${g.current} of ${g.target} ${g.unit}`;

            return (
              <HudCard key={g.label} className="p-8" delay={.15 + gi * .07}>
                <div className="flex items-start gap-6">
                  {/* Radial */}
                  <div className="flex-shrink-0 flex flex-col items-center gap-1">
                    <svg width="64" height="64" viewBox="0 0 64 64">
                      <circle cx="32" cy="32" r="22" fill="none" stroke={`${g.colorHex}15`} strokeWidth="4.5" />
                      <circle cx="32" cy="32" r="22" fill="none" stroke={g.colorHex} strokeWidth="4.5"
                        strokeDasharray={C} strokeDashoffset={dash} strokeLinecap="round"
                        transform="rotate(-90 32 32)"
                        style={{ filter: `drop-shadow(0 0 8px ${g.colorHex}70)`, transition: "stroke-dashoffset 1s ease" }} />
                      <text x="32" y="36" textAnchor="middle" fontSize="13" fontWeight="900" fill="var(--t1)">{pct}%</text>
                    </svg>
                    {!g.started && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded"
                        style={{ background: "rgba(148,163,184,0.08)", color: "var(--t3)" }}>
                        Not started
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-semibold px-2.5 py-0.5 rounded-full"
                        style={{ background: `${g.colorHex}12`, color: g.colorHex, border: `1px solid ${g.colorHex}25` }}>
                        {g.category}
                      </span>
                      <span className="text-sm" style={{ color: "var(--t3)" }}>Due {g.deadline}</span>
                    </div>
                    <h3 className="text-xl font-bold mb-1.5" style={{ color: "var(--t1)" }}>{g.label}</h3>
                    <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--t2)" }}>{g.desc}</p>

                    {/* Progress bar */}
                    <div className="h-2 rounded-full mb-2" style={{ background: "rgba(6,182,212,0.07)" }}>
                      <div className="h-2 rounded-full transition-all duration-1000"
                        style={{ width: `${pct || 1}%`, background: g.colorHex, boxShadow: `0 0 10px ${g.colorHex}50` }} />
                    </div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm font-mono" style={{ color: "var(--t3)" }}>{dispVal}</span>
                      <span className="text-sm font-bold" style={{ color: g.colorHex }}>{pct}% complete</span>
                    </div>

                    {/* Milestones */}
                    <div className="flex gap-2 flex-wrap mb-4">
                      {g.milestones.map((m, mi) => {
                        const reached = (m as { done?: boolean }).done || m.v <= g.current;
                        return (
                          <div key={mi} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
                            style={{
                              background: reached ? `${g.colorHex}12` : "rgba(6,182,212,0.03)",
                              border: `1px solid ${reached ? g.colorHex + "35" : "rgba(6,182,212,0.08)"}`,
                              color: reached ? g.colorHex : "var(--t3)"
                            }}>
                            {reached && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"><polyline points="20 6 9 17 4 12" /></svg>}
                            {m.l}
                          </div>
                        );
                      })}
                    </div>

                    {/* M.A.X. insight */}
                    <div className="px-4 py-3 rounded-xl text-sm"
                      style={{ background: "rgba(6,182,212,0.04)", border: "1px solid rgba(6,182,212,0.08)" }}>
                      <span style={{ color: "var(--teal)", fontWeight: 700 }}>M.A.X. · </span>
                      <span style={{ color: "var(--t2)" }}>{g.insight}</span>
                    </div>
                  </div>
                </div>
              </HudCard>
            );
          })}
        </div>

        {/* Add */}
        <div className="mt-5 p-5 rounded-xl flex items-center gap-4 cursor-pointer transition-all hover:opacity-70 afu d5"
          style={{ border: "1px dashed rgba(6,182,212,0.12)", background: "rgba(6,182,212,0.02)" }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(6,182,212,0.07)", border: "1px solid rgba(6,182,212,0.12)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
          <span className="text-base" style={{ color: "var(--t3)" }}>Tell M.A.X. what you want to achieve — new goal added instantly</span>
        </div>
      </div>
    </div>
  );
}
