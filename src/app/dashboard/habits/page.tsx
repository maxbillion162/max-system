"use client";

import { useState, useEffect } from "react";
import { HudCard } from "@/components/ui/HudCard";
import { supabase } from "@/lib/supabase";

/* ── Types ── */
interface Habit {
  id: string;
  label: string;
  cat: string;
  color: string;
  streak: number;
  best: number;
  h: boolean[]; // [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
}

const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const CATS = ["Morning","Health","Nutrition","Learning","Sleep","Mindset","Work","Other"];
const COLORS = ["#4589ff","#10b981","#f97316","#ec4899","#8b5cf6","#06b6d4","#ef4444","#f59e0b"];

const INIT: Habit[] = [
  { id:"h1", label:"Up by 7:30 AM",       cat:"Morning",   color:"#ec4899", streak:0,  best:5,  h:[false,false,true,true,true,false,false] },
  { id:"h2", label:"Gym",                  cat:"Health",    color:"#10b981", streak:12, best:18, h:[true,true,false,true,true,true,true]    },
  { id:"h3", label:"Workout logged",       cat:"Health",    color:"#06b6d4", streak:4,  best:12, h:[false,true,false,true,true,true,true]   },
  { id:"h4", label:"Read / Learn 30 min",  cat:"Learning",  color:"#f97316", streak:3,  best:14, h:[true,true,false,false,true,true,true]   },
  { id:"h5", label:"Phone off by 11 PM",   cat:"Sleep",     color:"#8b5cf6", streak:1,  best:7,  h:[false,true,false,true,false,false,true] },
  { id:"h6", label:"Hit protein goal",     cat:"Nutrition", color:"#10b981", streak:2,  best:9,  h:[true,false,false,true,false,true,true]  },
];

/* ── PPL Split ── */
interface PPLDay { name: string; detail: string; color: string; days: string }
const PPL_INIT: PPLDay[] = [
  { name:"Push", detail:"Chest · Triceps · Shoulders", color:"#06b6d4", days:"Mon / Thu" },
  { name:"Pull", detail:"Back · Biceps",               color:"#10b981", days:"Tue / Fri" },
  { name:"Legs", detail:"Quads · Hamstrings · Glutes", color:"#8b5cf6", days:"Wed / Sat" },
];

/* ── Edit Btn ── */
function EditBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} title="Edit" style={{
      background:"none", border:"1px solid var(--border)", borderRadius:5,
      padding:"4px 6px", cursor:"pointer", color:"var(--t3)",
      display:"flex", alignItems:"center", gap:4,
      fontSize:11, fontWeight:600, transition:"all .15s", flexShrink:0,
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor="var(--blue)"; (e.currentTarget as HTMLElement).style.color="var(--blue)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor="var(--border)"; (e.currentTarget as HTMLElement).style.color="var(--t3)"; }}
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
      Edit
    </button>
  );
}

/* ── Habit Modal ── */
function HabitModal({ habit, onSave, onClose, onDelete }: {
  habit: Habit | null;
  onSave: (h: Habit) => void;
  onClose: () => void;
  onDelete?: () => void;
}) {
  const isNew = habit === null;
  const [label, setLabel] = useState(habit?.label ?? "");
  const [cat,   setCat]   = useState(habit?.cat   ?? "Health");
  const [color, setColor] = useState(habit?.color ?? "#4589ff");

  function handleSave() {
    if (!label.trim()) return;
    onSave({
      id:     habit?.id ?? `h${Date.now()}`,
      label:  label.trim(),
      cat,
      color,
      streak: habit?.streak ?? 0,
      best:   habit?.best   ?? 0,
      h:      habit?.h      ?? [false,false,false,false,false,false,false],
    });
    onClose();
  }

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:100,
      background:"rgba(0,0,0,0.7)", backdropFilter:"blur(4px)",
      display:"flex", alignItems:"center", justifyContent:"center",
    }} onClick={onClose}>
      <div style={{
        background:"var(--surface)", border:"1px solid var(--border2)",
        borderRadius:12, padding:"28px 32px", width:420, maxWidth:"90vw",
        boxShadow:"0 24px 80px rgba(0,0,0,0.5)",
      }} onClick={e => e.stopPropagation()}>

        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
          <h3 style={{ fontSize:16, fontWeight:700, color:"var(--t1)" }}>{isNew ? "Add Habit" : "Edit Habit"}</h3>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--t3)", padding:4 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:18, marginBottom:28 }}>
          {/* Name */}
          <div>
            <label style={{ fontSize:11, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"var(--t3)", display:"block", marginBottom:6 }}>Habit Name</label>
            <input
              autoFocus
              value={label}
              onChange={e => setLabel(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onClose(); }}
              placeholder="e.g. Read 30 minutes"
              style={{
                width:"100%", background:"var(--surface2)", border:"1px solid var(--border2)",
                borderRadius:6, padding:"10px 12px", color:"var(--t1)", fontSize:14, fontWeight:600,
                outline:"none", boxSizing:"border-box",
              }}
              onFocus={e => (e.target.style.borderColor="var(--blue)")}
              onBlur={e => (e.target.style.borderColor="var(--border2)")}
            />
          </div>

          {/* Category */}
          <div>
            <label style={{ fontSize:11, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"var(--t3)", display:"block", marginBottom:6 }}>Category</label>
            <select
              value={cat}
              onChange={e => setCat(e.target.value)}
              style={{
                width:"100%", background:"var(--surface2)", border:"1px solid var(--border2)",
                borderRadius:6, padding:"10px 12px", color:"var(--t1)", fontSize:13, fontWeight:600,
                outline:"none", boxSizing:"border-box", cursor:"pointer",
              }}
              onFocus={e => (e.target.style.borderColor="var(--blue)")}
              onBlur={e => (e.target.style.borderColor="var(--border2)")}
            >
              {CATS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Color */}
          <div>
            <label style={{ fontSize:11, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"var(--t3)", display:"block", marginBottom:8 }}>Color</label>
            <div style={{ display:"flex", gap:8 }}>
              {COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)} style={{
                  width:28, height:28, borderRadius:6, background:c, border:"none", cursor:"pointer",
                  outline: color === c ? `2px solid ${c}` : "2px solid transparent",
                  outlineOffset:2,
                  transform: color === c ? "scale(1.15)" : "scale(1)",
                  transition:"all .15s",
                }} />
              ))}
            </div>
          </div>
        </div>

        <div style={{ display:"flex", gap:10 }}>
          {!isNew && onDelete && (
            <button onClick={() => { onDelete(); onClose(); }} style={{
              padding:"11px 16px", borderRadius:6, fontSize:13, fontWeight:600, cursor:"pointer",
              background:"rgba(239,68,68,0.06)", border:"1px solid rgba(239,68,68,0.2)", color:"var(--red)",
            }}>Delete</button>
          )}
          <button onClick={onClose} style={{
            flex:1, padding:"11px 0", borderRadius:6, fontSize:13, fontWeight:600, cursor:"pointer",
            background:"transparent", border:"1px solid var(--border2)", color:"var(--t3)",
          }}>Cancel</button>
          <button onClick={handleSave} disabled={!label.trim()} style={{
            flex:2, padding:"11px 0", borderRadius:6, fontSize:13, fontWeight:700, cursor:"pointer",
            background:"rgba(69,137,255,0.15)", border:"1px solid rgba(69,137,255,0.4)", color:"var(--blue)",
            opacity: label.trim() ? 1 : 0.4,
          }}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}

/* ── PPL Edit Modal ── */
function PPLModal({ splits, onSave, onClose }: {
  splits: PPLDay[];
  onSave: (s: PPLDay[]) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<PPLDay[]>(splits.map(s => ({ ...s })));
  function update(i: number, k: keyof PPLDay, v: string) {
    setDraft(p => p.map((s, j) => j === i ? { ...s, [k]: v } : s));
  }
  return (
    <div style={{
      position:"fixed", inset:0, zIndex:100,
      background:"rgba(0,0,0,0.7)", backdropFilter:"blur(4px)",
      display:"flex", alignItems:"center", justifyContent:"center",
    }} onClick={onClose}>
      <div style={{
        background:"var(--surface)", border:"1px solid var(--border2)",
        borderRadius:12, padding:"28px 32px", width:480, maxWidth:"90vw",
        boxShadow:"0 24px 80px rgba(0,0,0,0.5)",
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
          <h3 style={{ fontSize:16, fontWeight:700, color:"var(--t1)" }}>Edit Workout Split</h3>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--t3)", padding:4 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:20, marginBottom:28 }}>
          {draft.map((s, i) => (
            <div key={i} style={{ padding:"16px 18px", borderRadius:8, background:"var(--surface2)", border:"1px solid var(--border)" }}>
              <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:s.color, marginBottom:12 }}>{s.name}</div>
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {(["detail","days"] as (keyof PPLDay)[]).map(k => (
                  <div key={k}>
                    <label style={{ fontSize:11, color:"var(--t3)", display:"block", marginBottom:4 }}>{k === "detail" ? "Muscle Groups" : "Schedule"}</label>
                    <input
                      value={s[k] as string}
                      onChange={e => update(i, k, e.target.value)}
                      style={{ width:"100%", background:"var(--surface3,var(--bg))", border:"1px solid var(--border2)", borderRadius:5, padding:"8px 10px", color:"var(--t1)", fontSize:13, outline:"none", boxSizing:"border-box" }}
                      onFocus={e => (e.target.style.borderColor=s.color)}
                      onBlur={e => (e.target.style.borderColor="var(--border2)")}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={onClose} style={{ flex:1, padding:"11px 0", borderRadius:6, fontSize:13, fontWeight:600, cursor:"pointer", background:"transparent", border:"1px solid var(--border2)", color:"var(--t3)" }}>Cancel</button>
          <button onClick={() => { onSave(draft); onClose(); }} style={{ flex:2, padding:"11px 0", borderRadius:6, fontSize:13, fontWeight:700, cursor:"pointer", background:"rgba(69,137,255,0.15)", border:"1px solid rgba(69,137,255,0.4)", color:"var(--blue)" }}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}

/* ── Helpers ── */
function rate7(h: Habit) { return h.h.filter(Boolean).length / 7; }
function weekRate(habits: Habit[]) {
  const done = habits.reduce((a, h) => a + h.h.filter(Boolean).length, 0);
  return habits.length > 0 ? done / (habits.length * 7) : 0;
}

/* ── Main ── */
export default function HabitsPage() {
  const [habits, setHabits] = useState<Habit[]>(INIT);
  const [ppl, setPpl]       = useState<PPLDay[]>(PPL_INIT);
  const [editModal, setEditModal] = useState<Habit | null | "new">(undefined as unknown as null);
  const [modalOpen, setModalOpen] = useState(false);
  const [pplModal, setPplModal]   = useState(false);

  /* Load from Supabase */
  useEffect(() => {
    supabase.from("habits").select("*").then(({ data }) => {
      if (!data || data.length === 0) return;
      setHabits(data.map(r => ({
        id:     String(r.id),
        label:  r.name ?? r.label ?? "",
        cat:    r.cat ?? "General",
        color:  r.color ?? "#4589ff",
        streak: r.streak ?? 0,
        best:   r.best ?? 0,
        h:      Array.isArray(r.history) ? r.history : [false,false,false,false,false,false, !!r.completed],
      })));
    });
  }, []);

  async function upsertHabit(h: Habit) {
    await supabase.from("habits").upsert({
      id:        h.id,
      name:      h.label,
      cat:       h.cat,
      color:     h.color,
      streak:    h.streak,
      best:      h.best,
      history:   h.h,
      completed: h.h[6],
      updated_at: new Date().toISOString(),
    });
  }

  async function toggle(id: string) {
    setHabits(p => p.map(h => {
      if (h.id !== id) return h;
      const nh = [...h.h]; nh[6] = !nh[6];
      const newStreak = nh[6] ? h.streak + 1 : Math.max(0, h.streak - 1);
      const newBest   = Math.max(h.best, newStreak);
      const updated = { ...h, h: nh, streak: newStreak, best: newBest };
      upsertHabit(updated);
      return updated;
    }));
  }

  function saveHabit(h: Habit) {
    setHabits(p => {
      const exists = p.find(x => x.id === h.id);
      const next = exists ? p.map(x => x.id === h.id ? h : x) : [...p, h];
      upsertHabit(h);
      return next;
    });
  }

  async function deleteHabit(id: string) {
    setHabits(p => p.filter(h => h.id !== id));
    await supabase.from("habits").delete().eq("id", id);
  }

  /* Stats */
  const done       = habits.filter(h => h.h[6]).length;
  const total      = habits.length;
  const todayPct   = total > 0 ? Math.round((done / total) * 100) : 0;
  const rate7d     = Math.round(weekRate(habits) * 100);
  const C          = 2 * Math.PI * 48;
  const dash       = C - (todayPct / 100) * C;

  const topStreak  = habits.reduce((best, h) => h.streak > best.streak ? h : best, habits[0] ?? { streak: 0, label: "—", color: "var(--blue)" });
  const weakest    = habits.length > 0 ? habits.reduce((w, h) => rate7(h) < rate7(w) ? h : w, habits[0]) : null;
  const strongest  = habits.length > 0 ? habits.reduce((s, h) => rate7(h) > rate7(s) ? h : s, habits[0]) : null;

  /* Category breakdown */
  const catMap: Record<string, { done: number; total: number; color: string }> = {};
  for (const h of habits) {
    if (!catMap[h.cat]) catMap[h.cat] = { done: 0, total: 0, color: h.color };
    catMap[h.cat].total += 7;
    catMap[h.cat].done  += h.h.filter(Boolean).length;
  }
  const cats = Object.entries(catMap).sort((a, b) => (b[1].done / b[1].total) - (a[1].done / a[1].total));

  /* M.A.X. insight */
  let insight = "";
  if (total === 0) {
    insight = "No habits tracked yet. Add your first habit below.";
  } else if (todayPct === 100) {
    insight = `Perfect day — all ${total} habits complete. ${topStreak.streak > 1 ? `${topStreak.label} is on a ${topStreak.streak}-day streak.` : "Keep the momentum tomorrow."}`;
  } else if (weakest && rate7(weakest) < 0.4) {
    insight = `${weakest.label} is your weakest habit at ${Math.round(rate7(weakest) * 100)}% this week. Focus here first — small wins compound.`;
  } else if (topStreak && topStreak.streak >= 7) {
    insight = `${topStreak.label} streak: ${topStreak.streak} days. Don't break the chain — ${total - done} habit${total - done !== 1 ? "s" : ""} still need today's check-in.`;
  } else if (rate7d >= 80) {
    insight = `${rate7d}% weekly rate — top tier consistency. ${strongest ? `${strongest.label} leads at ${Math.round(rate7(strongest) * 100)}%.` : ""}`;
  } else {
    insight = `${done} of ${total} done today. 7-day average: ${rate7d}%. ${total - done > 0 ? `${total - done} remaining.` : ""}`;
  }

  /* Group by category */
  const grouped: Record<string, Habit[]> = {};
  for (const h of habits) {
    if (!grouped[h.cat]) grouped[h.cat] = [];
    grouped[h.cat].push(h);
  }

  return (
    <div style={{ padding:"40px 52px", background:"var(--bg)", minHeight:"100vh" }}>

      {/* Modals */}
      {modalOpen && (
        <HabitModal
          habit={editModal === "new" ? null : (editModal as Habit)}
          onSave={saveHabit}
          onClose={() => setModalOpen(false)}
          onDelete={editModal && editModal !== "new" ? () => deleteHabit((editModal as Habit).id) : undefined}
        />
      )}
      {pplModal && (
        <PPLModal splits={ppl} onSave={setPpl} onClose={() => setPplModal(false)} />
      )}

      <div style={{ maxWidth:1000 }}>

        {/* Header */}
        <div className="afu" style={{ marginBottom:36 }}>
          <p style={{ fontSize:11, fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase", color:"var(--blue)", opacity:0.7, marginBottom:8 }}>Habits & Health</p>
          <h1 style={{ fontSize:36, fontWeight:800, color:"var(--t1)", letterSpacing:"-0.02em", marginBottom:6 }}>Daily Discipline</h1>
          <p style={{ fontSize:14, color:"var(--t2)" }}>Build the identity. The results follow.</p>
        </div>

        {/* Today Card */}
        <HudCard style={{ padding:"28px 36px", marginBottom:20 }} delay={.05}>
          <div style={{ display:"flex", alignItems:"center", gap:32 }}>
            {/* Ring */}
            <div style={{ flexShrink:0 }}>
              <svg width="108" height="108" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="48" fill="none" stroke="rgba(69,137,255,0.07)" strokeWidth="6"/>
                <circle cx="60" cy="60" r="48" fill="none"
                  stroke={todayPct === 100 ? "var(--green)" : "var(--blue)"} strokeWidth="6"
                  strokeDasharray={C} strokeDashoffset={dash} strokeLinecap="round"
                  transform="rotate(-90 60 60)"
                  style={{ filter:`drop-shadow(0 0 8px ${todayPct===100?"var(--green)":"var(--blue)"})`, transition:"stroke-dashoffset .6s ease" }}/>
                <text x="60" y="55" textAnchor="middle" fontSize="24" fontWeight="900" fill="var(--t1)">{done}</text>
                <text x="60" y="74" textAnchor="middle" fontSize="12" fill="var(--t3)">of {total}</text>
              </svg>
            </div>

            {/* Stats */}
            <div style={{ flex:1 }}>
              <h2 style={{ fontSize:26, fontWeight:800, color:"var(--t1)", marginBottom:6 }}>
                {todayPct === 100 ? "Perfect day." : done === 0 ? "Let's get going." : `${total - done} habit${total - done !== 1 ? "s" : ""} left.`}
              </h2>
              {/* M.A.X. insight */}
              <div style={{ padding:"10px 14px", borderRadius:6, background:"var(--surface2)", border:"1px solid var(--border)", fontSize:13, marginBottom:20 }}>
                <span style={{ color:"var(--blue)", fontWeight:700 }}>M.A.X. · </span>
                <span style={{ color:"var(--t2)" }}>{insight}</span>
              </div>
              <div style={{ display:"flex", gap:24 }}>
                {[
                  { label:"Today",       val:`${todayPct}%`,    color:"var(--blue)"  },
                  { label:"7-Day Avg",   val:`${rate7d}%`,      color:"var(--green)" },
                  { label:"Top Streak",  val:topStreak ? `${topStreak.streak}d` : "0d", color:"var(--amber)" },
                  { label:"Tracked",     val:`${total}`,        color:"var(--t2)"    },
                ].map(s => (
                  <div key={s.label} style={{ borderRight:"1px solid var(--border)", paddingRight:24 }}>
                    <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"var(--t3)", marginBottom:4 }}>{s.label}</div>
                    <div style={{ fontSize:24, fontWeight:800, fontFamily:"monospace", color:s.color }}>{s.val}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </HudCard>

        {/* Habits Table */}
        <HudCard style={{ overflow:"hidden", marginBottom:20 }} delay={.1}>
          {/* Table Header */}
          <div style={{
            display:"grid", gridTemplateColumns:"1fr 168px 90px 72px 56px",
            padding:"12px 28px", fontSize:10, fontWeight:700, letterSpacing:"0.12em",
            textTransform:"uppercase", color:"var(--t3)",
            background:"rgba(69,137,255,0.03)", borderBottom:"1px solid var(--border)",
          }}>
            <div>Habit</div>
            <div style={{ textAlign:"center" }}>Last 7 Days</div>
            <div style={{ textAlign:"center" }}>Streak</div>
            <div style={{ textAlign:"center" }}>Today</div>
            <div />
          </div>

          {/* Grouped rows */}
          {Object.entries(grouped).map(([cat, hs]) => (
            <div key={cat}>
              <div style={{ padding:"8px 28px 4px", fontSize:10, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", color:"var(--t3)", background:"var(--surface2)", borderBottom:"1px solid var(--border)" }}>
                {cat}
              </div>
              {hs.map((habit, i) => (
                <div key={habit.id} style={{
                  display:"grid", gridTemplateColumns:"1fr 168px 90px 72px 56px",
                  padding:"16px 28px", alignItems:"center",
                  borderBottom: i < hs.length - 1 ? "1px solid var(--border)" : "none",
                  transition:"background .15s",
                }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background="rgba(255,255,255,0.015)"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background="transparent"}
                >
                  {/* Label */}
                  <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:0 }}>
                    <span style={{ width:8, height:8, borderRadius:"50%", background:habit.color, boxShadow:`0 0 6px ${habit.color}`, flexShrink:0 }} />
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:14, fontWeight:600, color:"var(--t1)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{habit.label}</div>
                      <div style={{ fontSize:11, color:"var(--t3)", marginTop:1 }}>{Math.round(rate7(habit)*100)}% this week</div>
                    </div>
                  </div>

                  {/* 7-day dots */}
                  <div style={{ display:"flex", alignItems:"center", gap:5, justifyContent:"center" }}>
                    {habit.h.map((d, di) => (
                      <div key={di} title={DAYS[di]} style={{
                        width:20, height:20, borderRadius:4, display:"flex", alignItems:"center", justifyContent:"center",
                        background: d ? `${habit.color}18` : "rgba(255,255,255,0.03)",
                        border:`1px solid ${d ? habit.color+"45" : "rgba(255,255,255,0.05)"}`,
                      }}>
                        {d && <div style={{ width:7, height:7, borderRadius:"50%", background:habit.color }} />}
                      </div>
                    ))}
                  </div>

                  {/* Streak */}
                  <div style={{ textAlign:"center" }}>
                    {habit.streak > 0
                      ? <span style={{ fontSize:14, fontWeight:700, color:"var(--amber)" }}>🔥 {habit.streak}</span>
                      : <span style={{ fontSize:14, color:"var(--t3)" }}>—</span>}
                  </div>

                  {/* Today toggle */}
                  <div style={{ display:"flex", justifyContent:"center" }}>
                    <button onClick={() => toggle(habit.id)} style={{
                      width:32, height:32, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center",
                      cursor:"pointer", transition:"all .15s",
                      background: habit.h[6] ? `${habit.color}18` : "rgba(255,255,255,0.03)",
                      border:`1.5px solid ${habit.h[6] ? habit.color+"60" : "rgba(255,255,255,0.08)"}`,
                      boxShadow: habit.h[6] ? `0 0 12px ${habit.color}30` : "none",
                    }}>
                      {habit.h[6] && (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={habit.color} strokeWidth="3">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                    </button>
                  </div>

                  {/* Edit */}
                  <div style={{ display:"flex", justifyContent:"center" }}>
                    <EditBtn onClick={() => { setEditModal(habit); setModalOpen(true); }} />
                  </div>
                </div>
              ))}
              <div style={{ borderBottom:"1px solid var(--border)" }} />
            </div>
          ))}

          {/* Add habit row */}
          <div style={{ padding:"14px 28px" }}>
            <button onClick={() => { setEditModal("new"); setModalOpen(true); }} style={{
              background:"none", border:"1px dashed var(--border2)", borderRadius:6,
              padding:"10px 18px", cursor:"pointer", color:"var(--t3)", fontSize:13, fontWeight:600,
              width:"100%", transition:"all .15s",
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor="var(--blue)"; (e.currentTarget as HTMLElement).style.color="var(--blue)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor="var(--border2)"; (e.currentTarget as HTMLElement).style.color="var(--t3)"; }}
            >
              + Add Habit
            </button>
          </div>
        </HudCard>

        {/* Bottom row: Category breakdown + PPL */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>

          {/* Category Performance */}
          <HudCard style={{ padding:"28px 28px" }} delay={.15}>
            <h2 style={{ fontSize:16, fontWeight:700, color:"var(--t1)", marginBottom:20 }}>Category Performance</h2>
            {cats.length === 0 && (
              <p style={{ fontSize:13, color:"var(--t3)" }}>No habits tracked yet.</p>
            )}
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              {cats.map(([name, { done: cd, total: ct, color }]) => {
                const pct = ct > 0 ? Math.round((cd / ct) * 100) : 0;
                return (
                  <div key={name}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <span style={{ width:8, height:8, borderRadius:2, background:color, flexShrink:0 }} />
                        <span style={{ fontSize:13, fontWeight:600, color:"var(--t1)" }}>{name}</span>
                      </div>
                      <span style={{ fontSize:13, fontWeight:700, fontFamily:"monospace", color: pct >= 70 ? "var(--green)" : pct >= 40 ? "var(--amber)" : "var(--red)" }}>{pct}%</span>
                    </div>
                    <div style={{ height:5, borderRadius:3, background:"var(--surface2)", overflow:"hidden" }}>
                      <div style={{
                        height:"100%", borderRadius:3,
                        width:`${pct}%`,
                        background: pct >= 70 ? "var(--green)" : pct >= 40 ? "var(--amber)" : "var(--red)",
                        transition:"width 0.6s ease",
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </HudCard>

          {/* Workout Split */}
          <HudCard style={{ padding:"28px 28px" }} delay={.2}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
              <h2 style={{ fontSize:16, fontWeight:700, color:"var(--t1)" }}>Workout Split</h2>
              <EditBtn onClick={() => setPplModal(true)} />
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {ppl.map(d => (
                <div key={d.name} style={{
                  padding:"18px 20px", borderRadius:8,
                  background:`${d.color}06`, border:`1px solid ${d.color}18`,
                  display:"flex", alignItems:"center", justifyContent:"space-between",
                }}>
                  <div>
                    <div style={{ fontSize:16, fontWeight:800, color:d.color, marginBottom:4 }}>{d.name}</div>
                    <div style={{ fontSize:12, color:"var(--t2)" }}>{d.detail}</div>
                  </div>
                  <div style={{ fontSize:12, fontWeight:600, color:"var(--t3)", textAlign:"right" }}>{d.days}</div>
                </div>
              ))}
            </div>
          </HudCard>
        </div>

      </div>
    </div>
  );
}
