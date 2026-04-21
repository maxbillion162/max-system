"use client";

import { useState, useEffect } from "react";
import { HudCard } from "@/components/ui/HudCard";
import { supabase } from "@/lib/supabase";

/* ── Types ── */
interface Task {
  id: string;
  text: string;
  completed: boolean;
  due_date?: string;
  priority?: "high" | "medium" | "low";
  created_at: string;
}

type CalView = "day" | "week" | "month";

const DAYS_SHORT  = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_FULL   = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS      = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const HOURS       = Array.from({ length: 24 }, (_, i) => i);

const PRIORITY_COLOR: Record<string, string> = {
  high:   "var(--red)",
  medium: "var(--amber)",
  low:    "var(--blue)",
};

function pad(n: number) { return String(n).padStart(2, "0"); }
function fmtHour(h: number) {
  if (h === 0)  return "12 AM";
  if (h === 12) return "12 PM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function startOfWeek(d: Date) {
  const s = new Date(d);
  s.setDate(d.getDate() - d.getDay());
  s.setHours(0, 0, 0, 0);
  return s;
}

/* ── Task Modal ── */
function TaskModal({ task, onSave, onClose, onDelete }: {
  task: Task | null;
  onSave: (t: Partial<Task>) => void;
  onClose: () => void;
  onDelete?: () => void;
}) {
  const isNew = task === null;
  const [text,     setText]     = useState(task?.text     ?? "");
  const [dueDate,  setDueDate]  = useState(task?.due_date ?? "");
  const [priority, setPriority] = useState<"high"|"medium"|"low">(task?.priority ?? "medium");

  function save() {
    if (!text.trim()) return;
    onSave({ text: text.trim(), due_date: dueDate || undefined, priority });
    onClose();
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={onClose}>
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border2)",
        borderRadius: 12, padding: 24, width: 380,
        boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
      }} onClick={e => e.stopPropagation()}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--t3)", marginBottom: 16 }}>
          {isNew ? "New Task" : "Edit Task"}
        </p>

        <input value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === "Enter" && save()}
          placeholder="Task description…"
          autoFocus
          style={{
            width: "100%", background: "var(--surface2)", border: "1px solid var(--border2)",
            borderRadius: 6, padding: "10px 12px", fontSize: 14, color: "var(--t1)",
            outline: "none", marginBottom: 12,
          }} />

        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: "var(--t3)", marginBottom: 5 }}>Due date</p>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              style={{
                width: "100%", background: "var(--surface2)", border: "1px solid var(--border2)",
                borderRadius: 6, padding: "8px 10px", fontSize: 12, color: "var(--t1)", outline: "none",
                colorScheme: "dark",
              }} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: "var(--t3)", marginBottom: 5 }}>Priority</p>
            <div style={{ display: "flex", gap: 4 }}>
              {(["high","medium","low"] as const).map(p => (
                <button key={p} onClick={() => setPriority(p)} style={{
                  flex: 1, padding: "8px 4px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600,
                  background: priority === p ? `${PRIORITY_COLOR[p]}20` : "var(--surface2)",
                  border: `1px solid ${priority === p ? PRIORITY_COLOR[p] : "var(--border2)"}`,
                  color: priority === p ? PRIORITY_COLOR[p] : "var(--t3)",
                  transition: "all .15s", textTransform: "capitalize",
                }}>{p}</button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          {!isNew && onDelete && (
            <button onClick={onDelete} style={{
              padding: "8px 14px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600,
              background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "var(--red)",
            }}>Delete</button>
          )}
          <button onClick={onClose} style={{
            padding: "8px 14px", borderRadius: 6, cursor: "pointer", fontSize: 12,
            background: "transparent", border: "1px solid var(--border2)", color: "var(--t3)",
          }}>Cancel</button>
          <button onClick={save} style={{
            padding: "8px 16px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700,
            background: "rgba(69,137,255,0.15)", border: "1px solid rgba(69,137,255,0.3)", color: "var(--blue)",
          }}>Save</button>
        </div>
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const [view,       setView]      = useState<CalView>("week");
  const [cursor,     setCursor]    = useState(new Date());
  const [tasks,      setTasks]     = useState<Task[]>([]);
  const [modal,      setModal]     = useState<{ open: boolean; task: Task | null }>({ open: false, task: null });
  const today = new Date();

  useEffect(() => {
    supabase.from("tasks").select("*").order("created_at").then(({ data }) => { if (data) setTasks(data); });
  }, []);

  async function saveTask(fields: Partial<Task>) {
    if (modal.task) {
      const updated = { ...modal.task, ...fields };
      setTasks(prev => prev.map(t => t.id === modal.task!.id ? updated : t));
      await supabase.from("tasks").update(fields).eq("id", modal.task.id);
    } else {
      const { data } = await supabase.from("tasks").insert({ ...fields, completed: false }).select().single();
      if (data) setTasks(prev => [...prev, data]);
    }
  }

  async function deleteTask(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id));
    await supabase.from("tasks").delete().eq("id", id);
    setModal({ open: false, task: null });
  }

  async function toggleTask(id: string, completed: boolean) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !completed } : t));
    await supabase.from("tasks").update({ completed: !completed }).eq("id", id);
  }

  /* ── Navigation ── */
  function nav(dir: -1 | 1) {
    const d = new Date(cursor);
    if (view === "day")   d.setDate(d.getDate() + dir);
    if (view === "week")  d.setDate(d.getDate() + dir * 7);
    if (view === "month") d.setMonth(d.getMonth() + dir);
    setCursor(d);
  }

  function navLabel() {
    if (view === "day")   return cursor.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    if (view === "week") {
      const ws = startOfWeek(cursor);
      const we = new Date(ws); we.setDate(ws.getDate() + 6);
      return `${ws.toLocaleDateString("en-US",{month:"short",day:"numeric"})} – ${we.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}`;
    }
    return `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
  }

  /* ── Task helpers ── */
  const openTasks  = tasks.filter(t => !t.completed);
  const doneTasks  = tasks.filter(t => t.completed);
  const highPrio   = openTasks.filter(t => t.priority === "high");

  /* ── Week view columns ── */
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek(cursor));
    d.setDate(d.getDate() + i);
    return d;
  });

  /* ── Month view grid ── */
  function monthGrid() {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const last  = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const cells: (Date | null)[] = [];
    for (let i = 0; i < first.getDay(); i++) cells.push(null);
    for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }

  function tasksForDay(d: Date) {
    return tasks.filter(t => t.due_date && isSameDay(new Date(t.due_date + "T00:00:00"), d));
  }

  return (
    <div style={{ padding: "28px 36px", background: "var(--bg)", minHeight: "100vh" }}>

      {/* ── HEADER ── */}
      <div className="afu" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--t3)", marginBottom: 6 }}>Calendar</p>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--t1)", letterSpacing: "-0.02em" }}>Schedule & Tasks</h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* View switcher */}
          <div style={{ display: "flex", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 3, gap: 2 }}>
            {(["day","week","month"] as CalView[]).map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600,
                background: view === v ? "rgba(69,137,255,0.15)" : "transparent",
                border: `1px solid ${view === v ? "rgba(69,137,255,0.3)" : "transparent"}`,
                color: view === v ? "var(--blue)" : "var(--t3)",
                transition: "all .15s", textTransform: "capitalize",
              }}>{v}</button>
            ))}
          </div>

          {/* Nav arrows */}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {[-1, 1].map(dir => (
              <button key={dir} onClick={() => nav(dir as -1|1)} style={{
                width: 32, height: 32, borderRadius: 6, cursor: "pointer",
                background: "var(--surface)", border: "1px solid var(--border)",
                color: "var(--t2)", display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all .15s",
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d={dir === -1 ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"} />
                </svg>
              </button>
            ))}
            <button onClick={() => setCursor(new Date())} style={{
              padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700,
              background: "var(--surface)", border: "1px solid var(--border)", color: "var(--t3)",
              transition: "all .15s",
            }}>Today</button>
          </div>

          {/* Add task */}
          <button onClick={() => setModal({ open: true, task: null })} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700,
            background: "rgba(69,137,255,0.1)", border: "1px solid rgba(69,137,255,0.25)", color: "var(--blue)",
            transition: "all .15s",
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add Task
          </button>
        </div>
      </div>

      {/* ── NAV LABEL ── */}
      <div className="afu" style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 18, fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.01em" }}>{navLabel()}</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16 }}>

        {/* ── CALENDAR PANEL ── */}
        <div>

          {/* DAY VIEW */}
          {view === "day" && (
            <HudCard style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "56px 1fr" }}>
                <div style={{ borderRight: "1px solid var(--border)" }} />
                <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: isSameDay(cursor, today) ? "var(--blue)" : "var(--t1)" }}>
                    {DAYS_FULL[cursor.getDay()]}
                  </p>
                  <p style={{ fontSize: 28, fontWeight: 900, color: "var(--t1)", lineHeight: 1 }}>
                    {cursor.getDate()}
                  </p>
                </div>
              </div>
              <div style={{ maxHeight: 520, overflowY: "auto" }}>
                {HOURS.map(h => (
                  <div key={h} style={{ display: "grid", gridTemplateColumns: "56px 1fr", minHeight: 52 }}>
                    <div style={{ padding: "6px 10px 0", borderRight: "1px solid var(--border)" }}>
                      <span style={{ fontSize: 10, color: "var(--t4)", fontFamily: "monospace" }}>{fmtHour(h)}</span>
                    </div>
                    <div style={{ borderBottom: "1px solid var(--border)", padding: "6px 12px", display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {tasksForDay(cursor).filter(t => {
                        const due = new Date(t.due_date! + "T00:00:00");
                        return due.getHours() === h;
                      }).map(t => (
                        <button key={t.id} onClick={() => setModal({ open: true, task: t })} style={{
                          padding: "3px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: "pointer",
                          background: `${PRIORITY_COLOR[t.priority ?? "medium"]}15`,
                          border: `1px solid ${PRIORITY_COLOR[t.priority ?? "medium"]}30`,
                          color: PRIORITY_COLOR[t.priority ?? "medium"],
                        }}>{t.text}</button>
                      ))}
                      {h === today.getHours() && isSameDay(cursor, today) && (
                        <div style={{ height: 1, background: "var(--red)", width: "100%", opacity: 0.6 }} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </HudCard>
          )}

          {/* WEEK VIEW */}
          {view === "week" && (
            <HudCard style={{ padding: 0, overflow: "hidden" }}>
              {/* Day headers */}
              <div style={{ display: "grid", gridTemplateColumns: "48px repeat(7, 1fr)", borderBottom: "1px solid var(--border)" }}>
                <div />
                {weekDays.map((d, i) => (
                  <div key={i} style={{
                    padding: "12px 8px", textAlign: "center",
                    borderLeft: i > 0 ? "1px solid var(--border)" : undefined,
                    background: isSameDay(d, today) ? "rgba(69,137,255,0.04)" : undefined,
                  }}>
                    <p style={{ fontSize: 10, fontWeight: 600, color: "var(--t3)", marginBottom: 4 }}>{DAYS_SHORT[d.getDay()]}</p>
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%", margin: "0 auto",
                      background: isSameDay(d, today) ? "var(--blue)" : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: isSameDay(d, today) ? "#fff" : "var(--t1)" }}>{d.getDate()}</p>
                    </div>
                  </div>
                ))}
              </div>
              {/* Time grid */}
              <div style={{ maxHeight: 480, overflowY: "auto" }}>
                {HOURS.map(h => (
                  <div key={h} style={{ display: "grid", gridTemplateColumns: "48px repeat(7, 1fr)", minHeight: 44 }}>
                    <div style={{ padding: "4px 6px 0", borderRight: "1px solid var(--border)", borderBottom: "1px solid rgba(30,37,48,0.5)" }}>
                      <span style={{ fontSize: 9, color: "var(--t4)", fontFamily: "monospace" }}>{fmtHour(h)}</span>
                    </div>
                    {weekDays.map((d, i) => (
                      <div key={i} style={{
                        borderLeft: "1px solid var(--border)", borderBottom: "1px solid rgba(30,37,48,0.5)",
                        padding: "3px 4px",
                        background: isSameDay(d, today) ? "rgba(69,137,255,0.02)" : undefined,
                      }}>
                        {tasksForDay(d).map(t => (
                          <button key={t.id} onClick={() => setModal({ open: true, task: t })} style={{
                            display: "block", width: "100%", textAlign: "left",
                            padding: "2px 5px", borderRadius: 3, fontSize: 10, fontWeight: 600,
                            cursor: "pointer", marginBottom: 2,
                            background: `${PRIORITY_COLOR[t.priority ?? "medium"]}15`,
                            border: `1px solid ${PRIORITY_COLOR[t.priority ?? "medium"]}25`,
                            color: PRIORITY_COLOR[t.priority ?? "medium"],
                            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                          }}>{t.text}</button>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </HudCard>
          )}

          {/* MONTH VIEW */}
          {view === "month" && (
            <HudCard style={{ padding: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 1, marginBottom: 4 }}>
                {DAYS_SHORT.map(d => (
                  <div key={d} style={{ padding: "6px 0", textAlign: "center", fontSize: 10, fontWeight: 700, color: "var(--t3)", letterSpacing: "0.08em" }}>{d}</div>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
                {monthGrid().map((d, i) => {
                  if (!d) return <div key={i} />;
                  const dayTasks = tasksForDay(d);
                  const isToday  = isSameDay(d, today);
                  return (
                    <div key={i} style={{
                      minHeight: 76, padding: "6px 8px", borderRadius: 6,
                      background: isToday ? "rgba(69,137,255,0.07)" : "var(--surface)",
                      border: `1px solid ${isToday ? "rgba(69,137,255,0.25)" : "var(--border)"}`,
                      cursor: "pointer", transition: "background .15s",
                    }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: "50%", marginBottom: 4,
                        background: isToday ? "var(--blue)" : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <span style={{ fontSize: 11, fontWeight: isToday ? 800 : 500, color: isToday ? "#fff" : "var(--t2)" }}>{d.getDate()}</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        {dayTasks.slice(0, 3).map(t => (
                          <button key={t.id} onClick={() => setModal({ open: true, task: t })} style={{
                            display: "block", width: "100%", textAlign: "left",
                            padding: "2px 4px", borderRadius: 3, fontSize: 9, fontWeight: 600, cursor: "pointer",
                            background: `${PRIORITY_COLOR[t.priority ?? "medium"]}15`,
                            color: PRIORITY_COLOR[t.priority ?? "medium"],
                            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                            border: "none",
                          }}>{t.text}</button>
                        ))}
                        {dayTasks.length > 3 && (
                          <span style={{ fontSize: 9, color: "var(--t4)" }}>+{dayTasks.length - 3} more</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </HudCard>
          )}
        </div>

        {/* ── SIDEBAR: TASKS ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { label: "Open", value: openTasks.length, color: "var(--blue)" },
              { label: "Done", value: doneTasks.length, color: "var(--green)" },
              { label: "High Priority", value: highPrio.length, color: "var(--red)" },
              { label: "With Deadline", value: tasks.filter(t => t.due_date).length, color: "var(--amber)" },
            ].map(s => (
              <HudCard key={s.label} style={{ padding: "12px 14px" }}>
                <p style={{ fontSize: 20, fontWeight: 800, color: s.color, fontFamily: "monospace" }}>{s.value}</p>
                <p style={{ fontSize: 10, color: "var(--t3)", fontWeight: 600, marginTop: 2 }}>{s.label}</p>
              </HudCard>
            ))}
          </div>

          {/* Open tasks */}
          <HudCard style={{ padding: "16px 16px", flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--t3)" }}>Open Tasks</p>
              <button onClick={() => setModal({ open: true, task: null })} style={{
                width: 20, height: 20, borderRadius: 4, cursor: "pointer",
                background: "rgba(69,137,255,0.08)", border: "1px solid rgba(69,137,255,0.2)",
                color: "var(--blue)", display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 360, overflowY: "auto" }}>
              {openTasks.length === 0 && (
                <p style={{ fontSize: 12, color: "var(--t4)", textAlign: "center", padding: "20px 0" }}>All clear.</p>
              )}
              {openTasks.map(t => (
                <div key={t.id} style={{
                  display: "flex", alignItems: "flex-start", gap: 8,
                  padding: "8px 10px", borderRadius: 6, background: "var(--surface2)",
                  borderLeft: `2px solid ${PRIORITY_COLOR[t.priority ?? "medium"]}`,
                }}>
                  <button onClick={() => toggleTask(t.id, t.completed)} style={{
                    width: 14, height: 14, borderRadius: 3, flexShrink: 0, marginTop: 1,
                    background: "transparent", border: "1px solid var(--border2)", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, color: "var(--t1)", fontWeight: 500, lineHeight: 1.4 }}>{t.text}</p>
                    {t.due_date && (
                      <p style={{ fontSize: 10, color: "var(--t4)", marginTop: 2 }}>
                        Due {new Date(t.due_date + "T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})}
                      </p>
                    )}
                  </div>
                  <button onClick={() => setModal({ open: true, task: t })} style={{
                    background: "none", border: "none", cursor: "pointer", color: "var(--t4)",
                    padding: 2, flexShrink: 0,
                  }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </HudCard>

          {/* Completed */}
          {doneTasks.length > 0 && (
            <HudCard style={{ padding: "14px 16px" }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--t3)", marginBottom: 10 }}>Completed</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 3, maxHeight: 140, overflowY: "auto" }}>
                {doneTasks.map(t => (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 4, background: "var(--surface2)", opacity: 0.5 }}>
                    <div style={{ width: 14, height: 14, borderRadius: 3, background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                    </div>
                    <span style={{ fontSize: 11, color: "var(--t3)", textDecoration: "line-through", flex: 1 }}>{t.text}</span>
                    <button onClick={() => deleteTask(t.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t4)", padding: 2 }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            </HudCard>
          )}
        </div>
      </div>

      {/* Modal */}
      {modal.open && (
        <TaskModal
          task={modal.task}
          onSave={saveTask}
          onClose={() => setModal({ open: false, task: null })}
          onDelete={modal.task ? () => deleteTask(modal.task!.id) : undefined}
        />
      )}
    </div>
  );
}
