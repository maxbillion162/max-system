"use client";

/**
 * Discipline — the daily-view merge of Habits + Goals.
 *
 * Goal (per Max's plan): one page worth opening every morning. Two zones:
 *   - Today's habits as checkable chips with streak + category color
 *   - Active goals with progress + the habits that serve each goal
 *
 * Deep editing (add/edit/delete habits, goal milestones, journal notes,
 * PPL splits, gamification) stays on the existing /dashboard/habits and
 * /dashboard/goals pages, which this page links to. That keeps this page
 * fast, quiet, and daily-useful without duplicating 1300+ lines of UI.
 */

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

interface Goal {
  id: string; label: string; desc: string; current: number; target: number;
  unit: string; deadline: string; color: string; category: string;
}
interface Habit { id: string; name: string; cat: string; color: string }

function todayStr() { return new Date().toISOString().slice(0, 10); }
function daysUntil(deadline: string): number {
  return Math.max(0, Math.round((new Date(deadline).getTime() - Date.now()) / 86_400_000));
}
function computeStreak(completed: Set<string>): number {
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    if (completed.has(d.toISOString().slice(0, 10))) streak++;
    else break;
  }
  return streak;
}

/** Same semantic linker used on the full Goals page — habit serves a goal if
 *  the category matches, if both are fitness-ish, or if common keyword pairs hit. */
function habitsForGoal(goal: Goal, habits: Habit[]): Habit[] {
  const gl   = (goal.label + " " + goal.category).toLowerCase();
  const gcat = goal.category.toLowerCase();
  return habits.filter(h => {
    const hl   = (h.name + " " + h.cat).toLowerCase();
    const hcat = h.cat.toLowerCase();
    if (gcat === hcat) return true;
    if ((gcat === "fitness" || gcat === "health") && (hcat === "health" || hcat === "fitness")) return true;
    const pairs = [["gym","gym"],["workout","workout"],["morning","morning"],["sleep","sleep"],["read","learn"],["learn","learn"],["protein","nutrition"]];
    return pairs.some(([gkw, hkw]) => gl.includes(gkw) && hl.includes(hkw));
  });
}

export default function DisciplinePage() {
  const [goals,    setGoals]    = useState<Goal[]>([]);
  const [habits,   setHabits]   = useState<Habit[]>([]);
  const [logs,     setLogs]     = useState<Map<string, Set<string>>>(new Map());
  const [loading,  setLoading]  = useState(true);
  const today = todayStr();

  const load = useCallback(async () => {
    const [goalsRes, habitsRes, logsRes] = await Promise.allSettled([
      supabase.from("goals").select("id,label,description,current,target,unit,deadline,color,category").order("deadline"),
      supabase.from("habits").select("id,name,cat,color"),
      supabase.from("habit_logs").select("habit_id,date,completed").eq("completed", true),
    ]);

    if (goalsRes.status === "fulfilled" && goalsRes.value.data) {
      setGoals(goalsRes.value.data.map(r => ({
        id:       String(r.id),
        label:    String(r.label ?? ""),
        desc:     String(r.description ?? ""),
        current:  Number(r.current ?? 0),
        target:   Number(r.target ?? 100),
        unit:     String(r.unit ?? "$"),
        deadline: String(r.deadline ?? ""),
        color:    String(r.color ?? "#7DB8E8"),
        category: String(r.category ?? "Personal"),
      })));
    }
    if (habitsRes.status === "fulfilled" && habitsRes.value.data) {
      setHabits(habitsRes.value.data.map(r => ({
        id:    String(r.id),
        name:  String(r.name ?? ""),
        cat:   String(r.cat ?? "Other"),
        color: String(r.color ?? "#7DB8E8"),
      })));
    }
    if (logsRes.status === "fulfilled" && logsRes.value.data) {
      const map = new Map<string, Set<string>>();
      for (const log of logsRes.value.data as { habit_id: string; date: string }[]) {
        if (!map.has(log.habit_id)) map.set(log.habit_id, new Set());
        map.get(log.habit_id)!.add(log.date);
      }
      setLogs(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleHabit(habitId: string) {
    const current = logs.get(habitId) ?? new Set();
    const wasDone = current.has(today);
    // Optimistic
    setLogs(prev => {
      const next = new Map(prev);
      const set  = new Set(next.get(habitId) ?? []);
      if (wasDone) set.delete(today); else set.add(today);
      next.set(habitId, set);
      return next;
    });
    // Persist
    if (wasDone) {
      await supabase.from("habit_logs").update({ completed: false }).eq("habit_id", habitId).eq("date", today);
    } else {
      await supabase.from("habit_logs").upsert({ habit_id: habitId, date: today, completed: true });
    }
  }

  if (loading) {
    return (
      <div style={{ display: "flex", height: "60vh", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", gap: 6 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--blue)", opacity: 0.5, animation: `bounce 0.8s ease-in-out ${i * 0.18}s infinite` }} />
          ))}
        </div>
        <p style={{ fontSize: 12, color: "var(--t4)" }}>Loading discipline…</p>
      </div>
    );
  }

  const doneToday = habits.filter(h => logs.get(h.id)?.has(today)).length;
  const totalToday = habits.length;
  const pctToday = totalToday > 0 ? Math.round((doneToday / totalToday) * 100) : 0;

  // Goal to prioritize this week: deadline ≤30d with lowest completion %
  const focusGoal = goals
    .filter(g => g.deadline && daysUntil(g.deadline) > 0 && daysUntil(g.deadline) <= 45 && g.target > 0 && g.current < g.target)
    .map(g => ({ g, urgency: (1 - g.current / g.target) / Math.max(1, daysUntil(g.deadline) / 7) }))
    .sort((a, b) => b.urgency - a.urgency)[0]?.g;

  return (
    <div style={{ padding: "40px 52px", background: "var(--bg)", minHeight: "100vh", maxWidth: 1120, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ marginBottom: 32, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--blue)", opacity: 0.7, marginBottom: 8 }}>Discipline</p>
          <h1 style={{ fontSize: 36, fontWeight: 800, color: "var(--t1)", letterSpacing: "-0.02em", marginBottom: 6 }}>Today's Execution</h1>
          <p style={{ fontSize: 14, color: "var(--t2)" }}>Your habits, feeding the goals that matter. One glance.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/dashboard/habits" style={navBtnStyle()}>Edit Habits →</Link>
          <Link href="/dashboard/goals" style={navBtnStyle()}>Edit Goals →</Link>
        </div>
      </div>

      {/* Focus strip */}
      {focusGoal && (
        <div style={{ marginBottom: 24, padding: "14px 18px", borderRadius: 3, border: `1px solid ${focusGoal.color}35`, background: `${focusGoal.color}08`, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.22em", color: focusGoal.color }}>FOCUS</span>
          <span style={{ fontSize: 13, color: "var(--t1b)", flex: 1, minWidth: 240 }}>
            <strong style={{ color: "var(--t1)" }}>{focusGoal.label}</strong> — {Math.round((focusGoal.current / focusGoal.target) * 100)}% done, {daysUntil(focusGoal.deadline)}d to deadline.
          </span>
          <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--t3)" }}>
            {focusGoal.unit === "$"
              ? `$${Math.round(focusGoal.current).toLocaleString()} / $${Math.round(focusGoal.target).toLocaleString()}`
              : `${focusGoal.current} / ${focusGoal.target} ${focusGoal.unit}`}
          </span>
        </div>
      )}

      {/* TODAY ZONE */}
      <section style={{ marginBottom: 36 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--t2)" }}>Today</p>
          <p style={{ fontSize: 12, color: "var(--t3)", fontFamily: "monospace" }}>
            {totalToday === 0 ? "no habits yet" : `${doneToday} / ${totalToday} · ${pctToday}%`}
          </p>
        </div>

        {totalToday === 0 ? (
          <div style={{ padding: "28px 18px", borderRadius: 3, border: "1px dashed var(--border2)", textAlign: "center" }}>
            <p style={{ fontSize: 13, color: "var(--t3)", marginBottom: 10 }}>No habits yet. Add some to start your daily execution.</p>
            <Link href="/dashboard/habits" style={{ ...navBtnStyle(), display: "inline-block" }}>Add habits →</Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {habits.map(h => {
              const done = logs.get(h.id)?.has(today) ?? false;
              const streak = computeStreak(logs.get(h.id) ?? new Set());
              return (
                <button
                  key={h.id}
                  onClick={() => toggleHabit(h.id)}
                  title={h.cat}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 9,
                    padding: "10px 14px", borderRadius: 3,
                    background: done ? `${h.color}14` : "var(--surface)",
                    border: `1px solid ${done ? `${h.color}50` : "var(--border)"}`,
                    color: done ? "var(--t1)" : "var(--t2)",
                    fontSize: 13, fontWeight: 500, cursor: "pointer",
                    transition: "background .15s, border-color .15s, color .15s",
                  }}
                  onMouseEnter={e => {
                    if (!done) { (e.currentTarget as HTMLElement).style.borderColor = `${h.color}40`; (e.currentTarget as HTMLElement).style.color = "var(--t1)"; }
                  }}
                  onMouseLeave={e => {
                    if (!done) { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.color = "var(--t2)"; }
                  }}
                >
                  <span style={{
                    width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                    background: done ? h.color : "transparent",
                    border: `1.5px solid ${done ? h.color : "var(--border2)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {done && (
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--bg)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </span>
                  <span>{h.name}</span>
                  {streak > 1 && (
                    <span style={{ fontSize: 10, fontFamily: "monospace", color: done ? h.color : "var(--t4)", fontWeight: 700 }}>
                      {streak}d
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* GOALS ZONE */}
      <section>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--t2)" }}>Active Goals</p>
          <p style={{ fontSize: 12, color: "var(--t3)", fontFamily: "monospace" }}>{goals.length} tracked</p>
        </div>

        {goals.length === 0 ? (
          <div style={{ padding: "28px 18px", borderRadius: 3, border: "1px dashed var(--border2)", textAlign: "center" }}>
            <p style={{ fontSize: 13, color: "var(--t3)", marginBottom: 10 }}>No goals yet. Set your first target.</p>
            <Link href="/dashboard/goals" style={{ ...navBtnStyle(), display: "inline-block" }}>Create goal →</Link>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 14 }}>
            {goals.map(g => {
              const pct = Math.min(100, Math.round((g.current / g.target) * 100));
              const d = daysUntil(g.deadline);
              const linked = habitsForGoal(g, habits);
              const linkedDoneToday = linked.filter(h => logs.get(h.id)?.has(today)).length;
              return (
                <div key={g.id} style={{
                  background: "linear-gradient(160deg, #0f141d 0%, #080b11 100%)",
                  border: `1px solid ${g.color}22`,
                  borderRadius: 3,
                  padding: "18px 20px",
                  boxShadow: `inset 0 1px 0 rgba(125,184,232,0.04)`,
                  transition: "border-color .15s",
                }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = `${g.color}55`)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = `${g.color}22`)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: g.color, padding: "2px 7px", borderRadius: 2, background: `${g.color}10`, border: `1px solid ${g.color}28` }}>
                      {g.category}
                    </span>
                    <div style={{ flex: 1 }} />
                    <span style={{ fontSize: 10, fontFamily: "monospace", color: "var(--t4)" }}>
                      {d > 0 ? `${d}d` : "overdue"}
                    </span>
                  </div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--t1)", marginBottom: 4, letterSpacing: "-0.01em" }}>{g.label}</h3>
                  <p style={{ fontSize: 11, fontFamily: "monospace", color: "var(--t3)", marginBottom: 10 }}>
                    {g.unit === "$"
                      ? `$${Math.round(g.current).toLocaleString()} / $${Math.round(g.target).toLocaleString()}`
                      : `${g.current} / ${g.target} ${g.unit}`}
                    <span style={{ color: "var(--t4)", margin: "0 6px" }}>·</span>
                    <span style={{ color: g.color, fontWeight: 700 }}>{pct}%</span>
                  </p>
                  <div style={{ height: 4, borderRadius: 2, background: "var(--surface2)", marginBottom: 12, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.max(pct, 0.5)}%`, background: `linear-gradient(90deg, ${g.color}, ${g.color}99)`, transition: "width .8s ease" }} />
                  </div>

                  {linked.length > 0 ? (
                    <div>
                      <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--t4)", marginBottom: 6 }}>
                        Feeding habits · {linkedDoneToday}/{linked.length} today
                      </p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                        {linked.map(h => {
                          const done = logs.get(h.id)?.has(today) ?? false;
                          return (
                            <span key={h.id} style={{
                              display: "inline-flex", alignItems: "center", gap: 5,
                              padding: "3px 8px", borderRadius: 2, fontSize: 10, fontWeight: 600,
                              color: done ? h.color : "var(--t3)",
                              background: done ? `${h.color}12` : "transparent",
                              border: `1px solid ${done ? `${h.color}35` : "var(--border)"}`,
                            }}>
                              <span style={{ width: 4, height: 4, borderRadius: "50%", background: done ? h.color : "var(--t4)" }} />
                              {h.name}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p style={{ fontSize: 10, color: "var(--t4)", fontStyle: "italic" }}>No linked habits. <Link href="/dashboard/habits" style={{ color: "var(--blue)", textDecoration: "none" }}>Add one</Link> to build momentum toward this goal.</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function navBtnStyle(): React.CSSProperties {
  return {
    padding: "8px 14px",
    borderRadius: 2,
    background: "transparent",
    border: "1px solid var(--border2)",
    color: "var(--t2)",
    fontSize: 12, fontWeight: 600,
    letterSpacing: "0.04em",
    textDecoration: "none",
    fontFamily: "inherit",
    cursor: "pointer",
    transition: "color .15s, border-color .15s",
  };
}
