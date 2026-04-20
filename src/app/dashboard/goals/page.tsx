"use client";

import { useState, useEffect } from "react";
import { HudCard } from "@/components/ui/HudCard";
import { supabase } from "@/lib/supabase";

interface Goal {
  id: string;
  category: string;
  label: string;
  desc: string;
  current: number;
  target: number;
  unit: string;
  deadline: string;
  colorHex: string;
  milestones: { l: string; v: number }[];
}

const GOALS_INIT: Goal[] = [
  {
    id: "income-100k",
    category: "Income", label: "$100K First Year",
    desc: "Hit $100K total compensation in your first full year as an Account Manager at the staffing firm.",
    current: 0, target: 100000, unit: "$", deadline: "2027-07-01", colorHex: "#10b981",
    milestones: [{ l: "$25K", v: 25000 }, { l: "$50K", v: 50000 }, { l: "$75K", v: 75000 }, { l: "$100K", v: 100000 }],
  },
  {
    id: "emergency-fund",
    category: "Finance", label: "Emergency Fund — $10K",
    desc: "Build a 3-month cash cushion before allocating aggressively to investments.",
    current: 2800, target: 10000, unit: "$", deadline: "2026-12-01", colorHex: "#8b5cf6",
    milestones: [{ l: "$2.5K", v: 2500 }, { l: "$5K", v: 5000 }, { l: "$7.5K", v: 7500 }, { l: "$10K", v: 10000 }],
  },
  {
    id: "gym-52weeks",
    category: "Fitness", label: "Gym 4×/Week — Full Year",
    desc: "Maintain 4+ gym sessions per week for 52 straight weeks. Push/Pull/Legs every cycle.",
    current: 12, target: 52, unit: "weeks", deadline: "2027-04-01", colorHex: "#06b6d4",
    milestones: [{ l: "1 month", v: 4 }, { l: "3 months", v: 13 }, { l: "6 months", v: 26 }, { l: "1 year", v: 52 }],
  },
  {
    id: "ai-learning",
    category: "Learning", label: "Master AI + Vibe Coding",
    desc: "Build real competency in Claude Code, Python basics, and AI-assisted workflows — not just familiarity.",
    current: 8, target: 30, unit: "sessions", deadline: "2026-09-01", colorHex: "#f97316",
    milestones: [{ l: "5 sessions", v: 5 }, { l: "10", v: 10 }, { l: "20", v: 20 }, { l: "30", v: 30 }],
  },
  {
    id: "morning-routine",
    category: "Morning", label: "Morning Routine — 30 Days",
    desc: "Wake up by 7:30 AM and complete a consistent morning routine for 30 consecutive days before job starts.",
    current: 0, target: 30, unit: "days", deadline: "2026-06-01", colorHex: "#ec4899",
    milestones: [{ l: "7 days", v: 7 }, { l: "14 days", v: 14 }, { l: "21 days", v: 21 }, { l: "30 days", v: 30 }],
  },
];

const CATEGORIES = ["Income", "Finance", "Fitness", "Learning", "Morning", "Health", "Business", "Personal"];
const COLORS = ["#10b981","#8b5cf6","#06b6d4","#f97316","#ec4899","#4589ff","#f59e0b","#ef4444"];

// ── Dynamic insight generator ─────────────────────────────────────────────────
function generateInsight(g: Goal): string {
  const now = new Date();
  const deadline = new Date(g.deadline);
  const msLeft = deadline.getTime() - now.getTime();
  const daysLeft = Math.max(0, Math.floor(msLeft / (1000 * 60 * 60 * 24)));
  const monthsLeft = Math.max(0, Math.round(daysLeft / 30.5));
  const remaining = g.target - g.current;
  const pct = Math.round((g.current / g.target) * 100);

  if (g.current >= g.target) return `Goal complete. ${g.label} — done. Consider setting a new target.`;

  if (daysLeft <= 0) {
    return `Deadline passed. ${remaining > 0 ? `Still ${g.unit === "$" ? `$${remaining.toLocaleString()}` : `${remaining} ${g.unit}`} short.` : "Goal achieved."} Update the deadline or close this out.`;
  }

  if (g.unit === "$") {
    if (g.current === 0) return `Not started. Need $${remaining.toLocaleString()} by ${deadline.toLocaleDateString("en-US", { month: "short", year: "numeric" })} — that's $${Math.ceil(remaining / Math.max(1, monthsLeft)).toLocaleString()}/mo starting now.`;
    const perMonth = Math.ceil(remaining / Math.max(1, monthsLeft));
    const projMonths = monthsLeft > 0 ? Math.ceil(remaining / (g.current / Math.max(1, (12 - monthsLeft)))) : 0;
    return `$${remaining.toLocaleString()} remaining over ${monthsLeft} months — need $${perMonth.toLocaleString()}/mo to hit the deadline. At current pace you ${projMonths <= monthsLeft ? "are on track" : `miss by ~${projMonths - monthsLeft} months`}.`;
  }

  if (g.unit === "weeks") {
    const weeksLeft = Math.floor(daysLeft / 7);
    if (g.current === 0) return `Not started. ${g.target} weeks needed, ${weeksLeft} weeks until deadline. Start this week or you won't have enough runway.`;
    const pace = g.current / Math.max(1, (52 - weeksLeft));
    return `${g.current} of ${g.target} weeks done (${pct}%). ${weeksLeft} weeks to deadline — ${pace >= 1 ? "maintaining consistent pace" : "falling behind on consistency"}. ${remaining} weeks left to complete.`;
  }

  if (g.unit === "sessions") {
    const sessionsPerMonth = monthsLeft > 0 ? Math.ceil(remaining / monthsLeft) : remaining;
    if (g.current === 0) return `Not started. ${g.target} sessions by ${deadline.toLocaleDateString("en-US", { month: "short", year: "numeric" })} — ${sessionsPerMonth}/mo needed.`;
    return `${g.current}/${g.target} sessions logged (${pct}%). ${remaining} left over ${monthsLeft} months — ${sessionsPerMonth} sessions/mo keeps you on track. Current cadence: ${Math.round(g.current / Math.max(1, monthsLeft))} sessions/mo.`;
  }

  if (g.unit === "days") {
    if (g.current === 0) return `Not started. ${daysLeft} days until deadline — need ${g.target} consecutive days. You must start in the next ${Math.max(0, daysLeft - g.target)} days or you won't have enough time.`;
    return `${g.current}/${g.target} days completed (${pct}%). ${remaining} more consecutive days needed. ${daysLeft} days until deadline — ${remaining <= daysLeft ? "still achievable if you start the streak now" : "deadline may need to move"}.`;
  }

  return `${pct}% complete. ${remaining} ${g.unit} remaining with ${monthsLeft} months to deadline.`;
}

// ── Edit Modal ────────────────────────────────────────────────────────────────
function GoalEditModal({ goal, onSave, onClose }: {
  goal: Goal;
  onSave: (updated: Partial<Goal>) => void;
  onClose: () => void;
}) {
  const [label,    setLabel]    = useState(goal.label);
  const [desc,     setDesc]     = useState(goal.desc);
  const [current,  setCurrent]  = useState(String(goal.current));
  const [target,   setTarget]   = useState(String(goal.target));
  const [unit,     setUnit]     = useState(goal.unit);
  const [deadline, setDeadline] = useState(goal.deadline);
  const [category, setCategory] = useState(goal.category);
  const [color,    setColor]    = useState(goal.colorHex);

  function handleSave() {
    onSave({
      label, desc, category, unit, deadline, colorHex: color,
      current: parseFloat(current) || 0,
      target:  parseFloat(target)  || goal.target,
    });
    onClose();
  }

  const inputStyle = {
    width: "100%", background: "var(--surface2)", border: "1px solid var(--border2)",
    borderRadius: 6, padding: "9px 12px", color: "var(--t1)", fontSize: 13,
    fontWeight: 500, outline: "none", transition: "border-color .15s",
  };

  const labelStyle = {
    fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const,
    color: "var(--t3)", display: "block", marginBottom: 6,
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 12, padding: "28px 32px", width: 480, maxWidth: "92vw", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 80px rgba(0,0,0,0.5)" }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: color }} />
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--t1)" }}>Edit Goal</h3>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t3)", padding: 4 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
          {/* Label */}
          <div>
            <label style={labelStyle}>Goal Name</label>
            <input value={label} onChange={e => setLabel(e.target.value)} style={inputStyle}
              onFocus={e => (e.target.style.borderColor = "var(--blue)")} onBlur={e => (e.target.style.borderColor = "var(--border2)")} />
          </div>

          {/* Description */}
          <div>
            <label style={labelStyle}>Description</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2}
              style={{ ...inputStyle, resize: "vertical" as const, fontFamily: "inherit" }}
              onFocus={e => (e.target.style.borderColor = "var(--blue)")} onBlur={e => (e.target.style.borderColor = "var(--border2)")} />
          </div>

          {/* Current + Target */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Current Progress</label>
              <input type="number" value={current} onChange={e => setCurrent(e.target.value)} style={inputStyle}
                onFocus={e => (e.target.style.borderColor = "var(--blue)")} onBlur={e => (e.target.style.borderColor = "var(--border2)")} />
            </div>
            <div>
              <label style={labelStyle}>Target</label>
              <input type="number" value={target} onChange={e => setTarget(e.target.value)} style={inputStyle}
                onFocus={e => (e.target.style.borderColor = "var(--blue)")} onBlur={e => (e.target.style.borderColor = "var(--border2)")} />
            </div>
          </div>

          {/* Unit + Deadline */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Unit</label>
              <input value={unit} onChange={e => setUnit(e.target.value)} placeholder="$, weeks, days…" style={inputStyle}
                onFocus={e => (e.target.style.borderColor = "var(--blue)")} onBlur={e => (e.target.style.borderColor = "var(--border2)")} />
            </div>
            <div>
              <label style={labelStyle}>Deadline</label>
              <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} style={{ ...inputStyle, colorScheme: "dark" }}
                onFocus={e => (e.target.style.borderColor = "var(--blue)")} onBlur={e => (e.target.style.borderColor = "var(--border2)")} />
            </div>
          </div>

          {/* Category */}
          <div>
            <label style={labelStyle}>Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Color */}
          <div>
            <label style={labelStyle}>Color</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)} style={{
                  width: 28, height: 28, borderRadius: "50%", background: c, border: "none", cursor: "pointer",
                  outline: color === c ? `3px solid ${c}` : "none", outlineOffset: 2,
                  boxShadow: color === c ? `0 0 10px ${c}60` : "none",
                  transition: "all .15s",
                }} />
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "11px 0", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "transparent", border: "1px solid var(--border2)", color: "var(--t3)" }}>Cancel</button>
          <button onClick={handleSave} style={{ flex: 2, padding: "11px 0", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer", background: "rgba(69,137,255,0.15)", border: "1px solid rgba(69,137,255,0.4)", color: "var(--blue)" }}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}

// ── Add Goal Modal ────────────────────────────────────────────────────────────
function AddGoalModal({ onAdd, onClose }: { onAdd: (g: Goal) => void; onClose: () => void }) {
  const blank: Goal = { id: "", category: "Finance", label: "", desc: "", current: 0, target: 100, unit: "$", deadline: "2027-01-01", colorHex: "#4589ff", milestones: [] };
  const [draft, setDraft] = useState(blank);

  function handleAdd() {
    if (!draft.label.trim()) return;
    const id = draft.label.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") + "-" + Date.now();
    onAdd({ ...draft, id });
    onClose();
  }

  const inputStyle = { width: "100%", background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 6, padding: "9px 12px", color: "var(--t1)", fontSize: 13, fontWeight: 500, outline: "none", transition: "border-color .15s" };
  const labelStyle = { fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "var(--t3)", display: "block", marginBottom: 6 };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 12, padding: "28px 32px", width: 480, maxWidth: "92vw", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 80px rgba(0,0,0,0.5)" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--t1)" }}>New Goal</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t3)", padding: 4 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
          <div>
            <label style={labelStyle}>Goal Name</label>
            <input value={draft.label} onChange={e => setDraft(p => ({ ...p, label: e.target.value }))} placeholder="e.g. Save $5K for vacation" style={inputStyle}
              onFocus={e => (e.target.style.borderColor = "var(--blue)")} onBlur={e => (e.target.style.borderColor = "var(--border2)")} />
          </div>
          <div>
            <label style={labelStyle}>Description</label>
            <textarea value={draft.desc} onChange={e => setDraft(p => ({ ...p, desc: e.target.value }))} rows={2} placeholder="What does hitting this goal mean to you?"
              style={{ ...inputStyle, resize: "vertical" as const, fontFamily: "inherit" }}
              onFocus={e => (e.target.style.borderColor = "var(--blue)")} onBlur={e => (e.target.style.borderColor = "var(--border2)")} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Target</label>
              <input type="number" value={draft.target} onChange={e => setDraft(p => ({ ...p, target: parseFloat(e.target.value) || 0 }))} style={inputStyle}
                onFocus={e => (e.target.style.borderColor = "var(--blue)")} onBlur={e => (e.target.style.borderColor = "var(--border2)")} />
            </div>
            <div>
              <label style={labelStyle}>Unit</label>
              <input value={draft.unit} onChange={e => setDraft(p => ({ ...p, unit: e.target.value }))} placeholder="$, weeks, days…" style={inputStyle}
                onFocus={e => (e.target.style.borderColor = "var(--blue)")} onBlur={e => (e.target.style.borderColor = "var(--border2)")} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Category</label>
              <select value={draft.category} onChange={e => setDraft(p => ({ ...p, category: e.target.value }))} style={{ ...inputStyle, cursor: "pointer" }}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Deadline</label>
              <input type="date" value={draft.deadline} onChange={e => setDraft(p => ({ ...p, deadline: e.target.value }))} style={{ ...inputStyle, colorScheme: "dark" }}
                onFocus={e => (e.target.style.borderColor = "var(--blue)")} onBlur={e => (e.target.style.borderColor = "var(--border2)")} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Color</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {COLORS.map(c => (
                <button key={c} onClick={() => setDraft(p => ({ ...p, colorHex: c }))} style={{ width: 28, height: 28, borderRadius: "50%", background: c, border: "none", cursor: "pointer", outline: draft.colorHex === c ? `3px solid ${c}` : "none", outlineOffset: 2, transition: "all .15s" }} />
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "11px 0", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "transparent", border: "1px solid var(--border2)", color: "var(--t3)" }}>Cancel</button>
          <button onClick={handleAdd} disabled={!draft.label.trim()} style={{ flex: 2, padding: "11px 0", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer", background: "rgba(69,137,255,0.15)", border: "1px solid rgba(69,137,255,0.4)", color: "var(--blue)", opacity: draft.label.trim() ? 1 : 0.4 }}>Add Goal</button>
        </div>
      </div>
    </div>
  );
}

// ── Edit button ───────────────────────────────────────────────────────────────
function EditBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} title="Edit goal" style={{ background: "none", border: "1px solid var(--border)", borderRadius: 5, padding: "5px 7px", cursor: "pointer", color: "var(--t3)", display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, transition: "all .15s", flexShrink: 0 }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--blue)"; (e.currentTarget as HTMLElement).style.color = "var(--blue)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.color = "var(--t3)"; }}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
      Edit
    </button>
  );
}

// ── Format deadline for display ───────────────────────────────────────────────
function fmtDeadline(d: string): string {
  try { return new Date(d).toLocaleDateString("en-US", { month: "short", year: "numeric" }); }
  catch { return d; }
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function GoalsPage() {
  const [goals, setGoals]     = useState<Goal[]>(GOALS_INIT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);

  useEffect(() => {
    supabase.from("goals").select("id,current").then(({ data }) => {
      if (!data || data.length === 0) return;
      const map = Object.fromEntries(data.map(r => [r.id, r.current]));
      setGoals(p => p.map(g => map[g.id] !== undefined ? { ...g, current: Number(map[g.id]) } : g));
    });
  }, []);

  async function saveGoal(id: string, updates: Partial<Goal>) {
    setGoals(p => p.map(g => g.id === id ? { ...g, ...updates } : g));
    await supabase.from("goals").upsert({ id, current: updates.current ?? goals.find(g => g.id === id)?.current ?? 0, updated_at: new Date().toISOString() });
  }

  async function addGoal(g: Goal) {
    setGoals(p => [...p, g]);
    await supabase.from("goals").upsert({ id: g.id, current: g.current, updated_at: new Date().toISOString() });
  }

  const avgPct = Math.round(goals.reduce((a, g) => a + Math.min(100, (g.current / g.target) * 100), 0) / goals.length);
  const milestonesDone = goals.reduce((acc, g) => acc + g.milestones.filter(m => m.v <= g.current).length, 0);
  const editingGoal = goals.find(g => g.id === editingId);

  return (
    <div style={{ padding: "40px 52px", background: "var(--bg)", minHeight: "100vh" }}>

      {/* Modals */}
      {editingGoal && (
        <GoalEditModal
          goal={editingGoal}
          onSave={updates => saveGoal(editingGoal.id, updates)}
          onClose={() => setEditingId(null)}
        />
      )}
      {addingNew && <AddGoalModal onAdd={addGoal} onClose={() => setAddingNew(false)} />}

      <div style={{ maxWidth: 900 }}>

        {/* Header */}
        <div className="afu" style={{ marginBottom: 36 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--blue)", opacity: 0.7, marginBottom: 8 }}>Goals HQ</p>
          <h1 style={{ fontSize: 36, fontWeight: 800, color: "var(--t1)", letterSpacing: "-0.02em", marginBottom: 6 }}>Your Targets</h1>
          <p style={{ fontSize: 14, color: "var(--t2)" }}>Every goal tracked. Every milestone visible. No excuses.</p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-5" style={{ marginBottom: 28 }}>
          {[
            { label: "Active Goals",   val: goals.length.toString(),        color: "var(--blue)"  },
            { label: "Milestones Hit", val: milestonesDone.toString(),       color: "var(--green)" },
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
            const insight = generateInsight(g);

            return (
              <HudCard key={g.id} style={{ padding: "28px 32px" }} delay={.15 + gi * .06}>
                <div className="flex items-start gap-6">

                  {/* Radial progress */}
                  <div className="flex-shrink-0">
                    <svg width="64" height="64" viewBox="0 0 64 64">
                      <circle cx="32" cy="32" r="22" fill="none" stroke={`${g.colorHex}15`} strokeWidth="4.5" />
                      <circle cx="32" cy="32" r="22" fill="none" stroke={g.colorHex} strokeWidth="4.5"
                        strokeDasharray={C} strokeDashoffset={dash} strokeLinecap="round"
                        transform="rotate(-90 32 32)"
                        style={{ transition: "stroke-dashoffset 1s ease" }} />
                      <text x="32" y="36" textAnchor="middle" fontSize="13" fontWeight="900" fill="var(--t1)">{pct}%</text>
                    </svg>
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Title row */}
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8, gap: 12 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span className="text-sm font-semibold px-2.5 py-0.5 rounded-full"
                            style={{ background: `${g.colorHex}12`, color: g.colorHex, border: `1px solid ${g.colorHex}25` }}>
                            {g.category}
                          </span>
                          <span style={{ fontSize: 12, color: "var(--t3)" }}>Due {fmtDeadline(g.deadline)}</span>
                        </div>
                        <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--t1)", lineHeight: 1.3 }}>{g.label}</h3>
                      </div>
                      <EditBtn onClick={() => setEditingId(g.id)} />
                    </div>

                    <p style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.6, marginBottom: 16 }}>{g.desc}</p>

                    {/* Progress bar */}
                    <div style={{ height: 4, borderRadius: 2, background: "var(--border2)", marginBottom: 6 }}>
                      <div style={{ height: 4, borderRadius: 2, width: `${pct || 1}%`, background: g.colorHex, transition: "width 1s ease" }} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                      <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--t3)" }}>{dispVal}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: g.colorHex }}>{pct}% complete</span>
                    </div>

                    {/* Milestones */}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                      {g.milestones.map((m, mi) => {
                        const reached = m.v <= g.current;
                        return (
                          <div key={mi} style={{
                            display: "flex", alignItems: "center", gap: 6,
                            padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 500,
                            background: reached ? `${g.colorHex}12` : "rgba(6,182,212,0.03)",
                            border: `1px solid ${reached ? g.colorHex + "35" : "rgba(6,182,212,0.08)"}`,
                            color: reached ? g.colorHex : "var(--t3)",
                          }}>
                            {reached && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"><polyline points="20 6 9 17 4 12" /></svg>}
                            {m.l}
                          </div>
                        );
                      })}
                    </div>

                    {/* Dynamic M.A.X. insight */}
                    <div style={{ padding: "12px 16px", borderRadius: 8, background: "rgba(6,182,212,0.04)", border: "1px solid rgba(6,182,212,0.08)" }}>
                      <span style={{ color: "var(--teal)", fontWeight: 700, fontSize: 12 }}>M.A.X. · </span>
                      <span style={{ color: "var(--t2)", fontSize: 12, lineHeight: 1.6 }}>{insight}</span>
                    </div>
                  </div>
                </div>
              </HudCard>
            );
          })}
        </div>

        {/* Add Goal */}
        <button onClick={() => setAddingNew(true)}
          className="mt-5 w-full transition-all hover:opacity-80"
          style={{ padding: "20px", borderRadius: 10, border: "1px dashed rgba(6,182,212,0.15)", background: "rgba(6,182,212,0.02)", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(6,182,212,0.07)", border: "1px solid rgba(6,182,212,0.12)", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </div>
          <span style={{ fontSize: 14, color: "var(--t3)" }}>Add new goal</span>
        </button>

      </div>
    </div>
  );
}
