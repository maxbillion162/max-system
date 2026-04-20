"use client";

import { useState, useEffect } from "react";
import { HudCard } from "@/components/ui/HudCard";
import { supabase } from "@/lib/supabase";

const GOALS_INIT = [
  {
    id: "income-100k",
    category: "Income", label: "$100K First Year",
    desc: "Hit $100K total compensation in your first full year as an Account Manager at the staffing firm.",
    current: 0, target: 100000, unit: "$", deadline: "Jul 2027", color: "var(--green)",
    colorHex: "#10b981", started: false,
    milestones: [{ l: "$25K", v: 25000 }, { l: "$50K", v: 50000 }, { l: "$75K", v: 75000 }, { l: "$100K", v: 100000 }],
    insight: "Job starts July 2026. Base + commission. Track every paycheck here.",
  },
  {
    id: "emergency-fund",
    category: "Finance", label: "Emergency Fund — $10K",
    desc: "Build a 3-month cash cushion before allocating aggressively to investments.",
    current: 2800, target: 10000, unit: "$", deadline: "Dec 2026", color: "var(--purple)",
    colorHex: "#8b5cf6", started: true,
    milestones: [{ l: "$2.5K", v: 2500 }, { l: "$5K", v: 5000 }, { l: "$7.5K", v: 7500 }, { l: "$10K", v: 10000 }],
    insight: "At current pace: December 2026. Save $200/mo more to hit it in October.",
  },
  {
    id: "gym-52weeks",
    category: "Fitness", label: "Gym 4×/Week — Full Year",
    desc: "Maintain 4+ gym sessions per week for 52 straight weeks. Push/Pull/Legs every cycle.",
    current: 12, target: 52, unit: "weeks", deadline: "Apr 2027", color: "var(--teal)",
    colorHex: "#06b6d4", started: true,
    milestones: [{ l: "1 month", v: 4 }, { l: "3 months", v: 13 }, { l: "6 months", v: 26 }, { l: "1 year", v: 52 }],
    insight: "12 weeks in. Best streak: 18 days. You've built real momentum.",
  },
  {
    id: "ai-learning",
    category: "Learning", label: "Master AI + Vibe Coding",
    desc: "Build real competency in Claude Code, Python basics, and AI-assisted workflows — not just familiarity.",
    current: 8, target: 30, unit: "sessions", deadline: "Sep 2026", color: "var(--orange)",
    colorHex: "#f97316", started: true,
    milestones: [{ l: "5 sessions", v: 5 }, { l: "10", v: 10 }, { l: "20", v: 20 }, { l: "30", v: 30 }],
    insight: "8 sessions in. Next: finish M.A.X. build, then start a Python fundamentals track.",
  },
  {
    id: "morning-routine",
    category: "Morning", label: "Morning Routine — 30 Days",
    desc: "Wake up by 7:30 AM and complete a consistent morning routine for 30 consecutive days before job starts.",
    current: 0, target: 30, unit: "days", deadline: "Jun 2026", color: "#ec4899",
    colorHex: "#ec4899", started: false,
    milestones: [{ l: "7 days", v: 7 }, { l: "14 days", v: 14 }, { l: "21 days", v: 21 }, { l: "30 days", v: 30 }],
    insight: "Critical before July start. Build the habit now while schedule is flexible.",
  },
];

export default function GoalsPage() {
  const [goals, setGoals] = useState(GOALS_INIT);
  const [editing, setEditing] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");

  useEffect(() => {
    supabase.from("goals").select("id,current").then(({ data }) => {
      if (!data || data.length === 0) return;
      const map = Object.fromEntries(data.map(r => [r.id, r.current]));
      setGoals(p => p.map(g => map[g.id] !== undefined ? { ...g, current: Number(map[g.id]) } : g));
    });
  }, []);

  function startEdit(id: string, current: number) {
    setEditing(id);
    setEditVal(String(current));
  }

  async function saveEdit(id: string) {
    const val = parseFloat(editVal);
    if (isNaN(val)) { setEditing(null); return; }
    setGoals(p => p.map(g => g.id === id ? { ...g, current: val, started: val > 0 } : g));
    await supabase.from("goals").upsert({ id, current: val, updated_at: new Date().toISOString() });
    setEditing(null);
  }

  const avgPct = Math.round(goals.reduce((a, g) => a + (g.current / g.target) * 100, 0) / goals.length);
  const milestonesDoneCount = goals.reduce((acc, g) => acc + g.milestones.filter(m => m.v <= g.current).length, 0);

  return (
    <div style={{ padding: "40px 52px", background: "var(--bg)", minHeight: "100vh" }}>
      <div style={{ maxWidth: 900 }}>

        <div className="afu" style={{ marginBottom: 36 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--blue)", opacity: 0.7, marginBottom: 8 }}>Goals HQ</p>
          <h1 style={{ fontSize: 36, fontWeight: 800, color: "var(--t1)", letterSpacing: "-0.02em", marginBottom: 6 }}>Your Targets</h1>
          <p style={{ fontSize: 14, color: "var(--t2)" }}>Every goal tracked. Every milestone visible. No excuses.</p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-5" style={{ marginBottom: 28 }}>
          {[
            { label: "Active Goals",   val: goals.length.toString(),        color: "var(--blue)"  },
            { label: "Milestones Hit", val: milestonesDoneCount.toString(), color: "var(--green)" },
            { label: "Avg Progress",   val: `${avgPct}%`,                   color: "var(--amber)" },
          ].map((s, i) => (
            <HudCard key={s.label} style={{ padding: "24px 28px" }} delay={i * .07}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--t3)", marginBottom: 14 }}>{s.label}</p>
              <div style={{ fontSize: 44, fontWeight: 800, color: s.color, fontFamily: "monospace" }}>{s.val}</div>
            </HudCard>
          ))}
        </div>

        {/* Goal cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {goals.map((g, gi) => {
            const pct = Math.min(100, Math.round((g.current / g.target) * 100));
            const C = 2 * Math.PI * 22;
            const dash = C - (pct / 100) * C;
            const dispVal = g.unit === "$"
              ? `$${g.current.toLocaleString()} of $${g.target.toLocaleString()}`
              : `${g.current} of ${g.target} ${g.unit}`;

            return (
              <HudCard key={g.id} style={{ padding: "32px 32px" }} delay={.15 + gi * .07}>
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
                    <div style={{ height: 4, borderRadius: 2, background: "var(--border2)", marginBottom: 8 }}>
                      <div style={{ height: 4, borderRadius: 2, width: `${pct || 1}%`, background: g.colorHex, transition: "width 1s ease" }} />
                    </div>

                    {/* Editable value */}
                    <div className="flex items-center justify-between mb-4">
                      {editing === g.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            autoFocus
                            type="number"
                            value={editVal}
                            onChange={e => setEditVal(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") saveEdit(g.id); if (e.key === "Escape") setEditing(null); }}
                            className="bg-transparent outline-none font-mono text-sm"
                            style={{ color: "var(--t1)", border: `1px solid ${g.colorHex}50`, borderRadius: 4, padding: "2px 8px", width: 120 }}
                          />
                          <button onClick={() => saveEdit(g.id)}
                            className="text-xs px-2 py-1 rounded"
                            style={{ background: `${g.colorHex}20`, color: g.colorHex }}>Save</button>
                          <button onClick={() => setEditing(null)}
                            className="text-xs px-2 py-1 rounded"
                            style={{ background: "rgba(255,255,255,0.04)", color: "var(--t3)" }}>Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => startEdit(g.id, g.current)}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
                          style={{ background: `${g.colorHex}12`, border: `1px solid ${g.colorHex}30`, color: g.colorHex }}>
                          <span className="text-sm font-mono">{dispVal}</span>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                      )}
                      <span className="text-sm font-bold" style={{ color: g.colorHex }}>{pct}% complete</span>
                    </div>

                    {/* Milestones */}
                    <div className="flex gap-2 flex-wrap mb-4">
                      {g.milestones.map((m, mi) => {
                        const reached = m.v <= g.current;
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
      </div>
    </div>
  );
}
