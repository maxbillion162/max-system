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

interface GCalEvent {
  id: string;
  title: string;
  description: string;
  location: string;
  start: string;
  end: string;
  allDay: boolean;
  color: string | null;
  htmlLink: string;
  status: string;
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

// Google Calendar color IDs → hex
const GCAL_COLORS: Record<string, string> = {
  "1": "#ac725e", "2": "#d06b64", "3": "#f83a22", "4": "#fa573c",
  "5": "#ff7537", "6": "#ffad46", "7": "#42d692", "8": "#16a765",
  "9": "#7bd148", "10": "#b3dc6c", "11": "#fbe983", "default": "#4589ff",
};

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
function fmtTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
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
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 12, padding: 24, width: 380, boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }} onClick={e => e.stopPropagation()}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--t3)", marginBottom: 16 }}>{isNew ? "New Task" : "Edit Task"}</p>
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === "Enter" && save()} placeholder="Task description…" autoFocus style={{ width: "100%", background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 6, padding: "10px 12px", fontSize: 14, color: "var(--t1)", outline: "none", marginBottom: 12 }} />
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: "var(--t3)", marginBottom: 5 }}>Due date</p>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={{ width: "100%", background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 6, padding: "8px 10px", fontSize: 12, color: "var(--t1)", outline: "none", colorScheme: "dark" }} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: "var(--t3)", marginBottom: 5 }}>Priority</p>
            <div style={{ display: "flex", gap: 4 }}>
              {(["high","medium","low"] as const).map(p => (
                <button key={p} onClick={() => setPriority(p)} style={{ flex: 1, padding: "8px 4px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600, background: priority === p ? `${PRIORITY_COLOR[p]}20` : "var(--surface2)", border: `1px solid ${priority === p ? PRIORITY_COLOR[p] : "var(--border2)"}`, color: priority === p ? PRIORITY_COLOR[p] : "var(--t3)", transition: "all .15s", textTransform: "capitalize" }}>{p}</button>
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          {!isNew && onDelete && <button onClick={onDelete} style={{ padding: "8px 14px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "var(--red)" }}>Delete</button>}
          <button onClick={onClose} style={{ padding: "8px 14px", borderRadius: 6, cursor: "pointer", fontSize: 12, background: "transparent", border: "1px solid var(--border2)", color: "var(--t3)" }}>Cancel</button>
          <button onClick={save} style={{ padding: "8px 16px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700, background: "rgba(69,137,255,0.15)", border: "1px solid rgba(69,137,255,0.3)", color: "var(--blue)" }}>Save</button>
        </div>
      </div>
    </div>
  );
}

/* ── New Event Modal ── */
function EventModal({ defaultDate, onSave, onClose }: {
  defaultDate: Date;
  onSave: (e: { title: string; start: string; end: string; description: string; location: string }) => Promise<void>;
  onClose: () => void;
}) {
  const fmt = (d: Date) => d.toISOString().slice(0, 16);
  const defaultStart = new Date(defaultDate);
  defaultStart.setHours(9, 0, 0, 0);
  const defaultEnd   = new Date(defaultDate);
  defaultEnd.setHours(10, 0, 0, 0);

  const [title,       setTitle]       = useState("");
  const [start,       setStart]       = useState(fmt(defaultStart));
  const [end,         setEnd]         = useState(fmt(defaultEnd));
  const [description, setDescription] = useState("");
  const [location,    setLocation]    = useState("");
  const [saving,      setSaving]      = useState(false);

  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    await onSave({ title: title.trim(), start, end, description, location });
    onClose();
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 12, padding: 24, width: 420, boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }} onClick={e => e.stopPropagation()}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--t3)", marginBottom: 16 }}>New Google Calendar Event</p>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Event title…" autoFocus style={{ width: "100%", background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 6, padding: "10px 12px", fontSize: 14, color: "var(--t1)", outline: "none", marginBottom: 10 }} />
        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: "var(--t3)", marginBottom: 5 }}>Start</p>
            <input type="datetime-local" value={start} onChange={e => setStart(e.target.value)} style={{ width: "100%", background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 6, padding: "8px 10px", fontSize: 12, color: "var(--t1)", outline: "none", colorScheme: "dark" }} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: "var(--t3)", marginBottom: 5 }}>End</p>
            <input type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} style={{ width: "100%", background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 6, padding: "8px 10px", fontSize: 12, color: "var(--t1)", outline: "none", colorScheme: "dark" }} />
          </div>
        </div>
        <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Location (optional)…" style={{ width: "100%", background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 6, padding: "8px 12px", fontSize: 12, color: "var(--t1)", outline: "none", marginBottom: 10 }} />
        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Description (optional)…" rows={2} style={{ width: "100%", background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 6, padding: "8px 12px", fontSize: 12, color: "var(--t1)", outline: "none", resize: "none", marginBottom: 14, fontFamily: "inherit" }} />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "8px 14px", borderRadius: 6, cursor: "pointer", fontSize: 12, background: "transparent", border: "1px solid var(--border2)", color: "var(--t3)" }}>Cancel</button>
          <button onClick={save} disabled={saving || !title.trim()} style={{ padding: "8px 16px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700, background: "rgba(69,137,255,0.15)", border: "1px solid rgba(69,137,255,0.3)", color: "var(--blue)", opacity: saving ? 0.6 : 1 }}>{saving ? "Saving…" : "Add to Calendar"}</button>
        </div>
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const [view,          setView]         = useState<CalView>("week");
  const [cursor,        setCursor]       = useState(new Date());
  const [tasks,         setTasks]        = useState<Task[]>([]);
  const [gcalEvents,    setGcalEvents]   = useState<GCalEvent[]>([]);
  const [gcalConnected, setGcalConnected] = useState(false);
  const [loadingCal,    setLoadingCal]   = useState(true);
  const [taskModal,     setTaskModal]    = useState<{ open: boolean; task: Task | null }>({ open: false, task: null });
  const [eventModal,    setEventModal]   = useState(false);
  const today = new Date();

  useEffect(() => {
    supabase.from("tasks").select("*").order("created_at").then(({ data }) => { if (data) setTasks(data); });
  }, []);

  useEffect(() => {
    setLoadingCal(true);
    const start = new Date(); start.setMonth(start.getMonth() - 1);
    const end   = new Date(); end.setMonth(end.getMonth() + 3);
    fetch(`/api/google/calendar?timeMin=${start.toISOString()}&timeMax=${end.toISOString()}`)
      .then(r => r.json())
      .then(d => {
        setGcalConnected(d.connected ?? false);
        setGcalEvents(d.events ?? []);
      })
      .catch(() => setGcalConnected(false))
      .finally(() => setLoadingCal(false));
  }, []);

  async function createGcalEvent(fields: { title: string; start: string; end: string; description: string; location: string }) {
    const res = await fetch("/api/google/calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...fields, timeZone: "America/New_York" }),
    });
    const data = await res.json();
    if (data.success && data.event) {
      const e = data.event;
      setGcalEvents(prev => [...prev, {
        id: e.id, title: e.summary ?? fields.title, description: e.description ?? "",
        location: e.location ?? "", start: e.start?.dateTime ?? e.start?.date ?? fields.start,
        end: e.end?.dateTime ?? e.end?.date ?? fields.end,
        allDay: !e.start?.dateTime, color: null, htmlLink: e.htmlLink ?? "", status: "confirmed",
      }]);
    }
  }

  async function saveTask(fields: Partial<Task>) {
    if (taskModal.task) {
      const updated = { ...taskModal.task, ...fields };
      setTasks(prev => prev.map(t => t.id === taskModal.task!.id ? updated : t));
      await supabase.from("tasks").update(fields).eq("id", taskModal.task.id);
    } else {
      const { data } = await supabase.from("tasks").insert({ ...fields, completed: false }).select().single();
      if (data) setTasks(prev => [...prev, data]);
    }
  }

  async function deleteTask(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id));
    await supabase.from("tasks").delete().eq("id", id);
    setTaskModal({ open: false, task: null });
  }

  async function toggleTask(id: string, completed: boolean) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !completed } : t));
    await supabase.from("tasks").update({ completed: !completed }).eq("id", id);
  }

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

  const openTasks = tasks.filter(t => !t.completed);
  const doneTasks = tasks.filter(t => t.completed);
  const highPrio  = openTasks.filter(t => t.priority === "high");

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek(cursor));
    d.setDate(d.getDate() + i);
    return d;
  });

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

  function eventsForDay(d: Date) {
    return gcalEvents.filter(e => {
      const start = new Date(e.allDay ? e.start + "T00:00:00" : e.start);
      return isSameDay(start, d);
    });
  }

  function eventsForHour(d: Date, h: number) {
    return gcalEvents.filter(e => {
      if (e.allDay) return false;
      const start = new Date(e.start);
      return isSameDay(start, d) && start.getHours() === h;
    });
  }

  const gcalColor = (e: GCalEvent) => e.color ? (GCAL_COLORS[e.color] ?? GCAL_COLORS.default) : GCAL_COLORS.default;

  return (
    <div style={{ padding: "28px 36px", background: "var(--bg)", minHeight: "100vh" }}>

      {/* Google connect banner */}
      {!loadingCal && !gcalConnected && (
        <div style={{ marginBottom: 20, padding: "12px 18px", borderRadius: 10, background: "rgba(69,137,255,0.06)", border: "1px solid rgba(69,137,255,0.18)", display: "flex", alignItems: "center", gap: 14 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <p style={{ fontSize: 12, color: "var(--t2)", flex: 1 }}>Connect Google Calendar to sync your real events — meetings, appointments, and reminders.</p>
          <a href="/api/auth/google" style={{ padding: "7px 16px", borderRadius: 7, background: "rgba(69,137,255,0.12)", border: "1px solid rgba(69,137,255,0.3)", color: "var(--blue)", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>Connect Google</a>
        </div>
      )}
      {gcalConnected && (
        <div style={{ marginBottom: 20, padding: "10px 16px", borderRadius: 10, background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.18)", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green)", display: "inline-block" }} />
          <p style={{ fontSize: 11, color: "var(--green)", fontWeight: 600 }}>Google Calendar connected · {gcalEvents.length} events synced</p>
        </div>
      )}

      {/* HEADER */}
      <div className="afu" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--t3)", marginBottom: 6 }}>Calendar</p>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--t1)", letterSpacing: "-0.02em" }}>Schedule & Tasks</h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 3, gap: 2 }}>
            {(["day","week","month"] as CalView[]).map(v => (
              <button key={v} onClick={() => setView(v)} style={{ padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, background: view === v ? "rgba(69,137,255,0.15)" : "transparent", border: `1px solid ${view === v ? "rgba(69,137,255,0.3)" : "transparent"}`, color: view === v ? "var(--blue)" : "var(--t3)", transition: "all .15s", textTransform: "capitalize" }}>{v}</button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {[-1, 1].map(dir => (
              <button key={dir} onClick={() => nav(dir as -1|1)} style={{ width: 32, height: 32, borderRadius: 6, cursor: "pointer", background: "var(--surface)", border: "1px solid var(--border)", color: "var(--t2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d={dir === -1 ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"} /></svg>
              </button>
            ))}
            <button onClick={() => setCursor(new Date())} style={{ padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--t3)" }}>Today</button>
          </div>
          {gcalConnected && (
            <button onClick={() => setEventModal(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", color: "var(--green)" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              Add Event
            </button>
          )}
          <button onClick={() => setTaskModal({ open: true, task: null })} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700, background: "rgba(69,137,255,0.1)", border: "1px solid rgba(69,137,255,0.25)", color: "var(--blue)" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            Add Task
          </button>
        </div>
      </div>

      <div className="afu" style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 18, fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.01em" }}>{navLabel()}</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16 }}>

        {/* CALENDAR PANEL */}
        <div>

          {/* DAY VIEW */}
          {view === "day" && (
            <HudCard style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "56px 1fr" }}>
                <div style={{ borderRight: "1px solid var(--border)" }} />
                <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: isSameDay(cursor, today) ? "var(--blue)" : "var(--t1)" }}>{DAYS_FULL[cursor.getDay()]}</p>
                  <p style={{ fontSize: 28, fontWeight: 900, color: "var(--t1)", lineHeight: 1 }}>{cursor.getDate()}</p>
                </div>
              </div>
              <div style={{ maxHeight: 520, overflowY: "auto" }}>
                {HOURS.map(h => (
                  <div key={h} style={{ display: "grid", gridTemplateColumns: "56px 1fr", minHeight: 52 }}>
                    <div style={{ padding: "6px 10px 0", borderRight: "1px solid var(--border)" }}>
                      <span style={{ fontSize: 10, color: "var(--t4)", fontFamily: "monospace" }}>{fmtHour(h)}</span>
                    </div>
                    <div style={{ borderBottom: "1px solid var(--border)", padding: "4px 8px", display: "flex", flexWrap: "wrap", gap: 3 }}>
                      {eventsForHour(cursor, h).map(e => (
                        <a key={e.id} href={e.htmlLink} target="_blank" rel="noreferrer" style={{
                          display: "block", padding: "3px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, textDecoration: "none",
                          background: `${gcalColor(e)}20`, border: `1px solid ${gcalColor(e)}40`, color: gcalColor(e),
                        }}>
                          {fmtTime(e.start)} {e.title}
                          {e.location && <span style={{ fontWeight: 400, opacity: 0.7 }}> · {e.location}</span>}
                        </a>
                      ))}
                      {tasksForDay(cursor).filter(t => { const due = new Date(t.due_date! + "T00:00:00"); return due.getHours() === h; }).map(t => (
                        <button key={t.id} onClick={() => setTaskModal({ open: true, task: t })} style={{ padding: "3px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: "pointer", background: `${PRIORITY_COLOR[t.priority ?? "medium"]}15`, border: `1px solid ${PRIORITY_COLOR[t.priority ?? "medium"]}30`, color: PRIORITY_COLOR[t.priority ?? "medium"] }}>{t.text}</button>
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
              <div style={{ display: "grid", gridTemplateColumns: "48px repeat(7, 1fr)", borderBottom: "1px solid var(--border)" }}>
                <div />
                {weekDays.map((d, i) => (
                  <div key={i} style={{ padding: "12px 8px", textAlign: "center", borderLeft: i > 0 ? "1px solid var(--border)" : undefined, background: isSameDay(d, today) ? "rgba(69,137,255,0.04)" : undefined }}>
                    <p style={{ fontSize: 10, fontWeight: 600, color: "var(--t3)", marginBottom: 4 }}>{DAYS_SHORT[d.getDay()]}</p>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", margin: "0 auto", background: isSameDay(d, today) ? "var(--blue)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: isSameDay(d, today) ? "#fff" : "var(--t1)" }}>{d.getDate()}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ maxHeight: 480, overflowY: "auto" }}>
                {HOURS.map(h => (
                  <div key={h} style={{ display: "grid", gridTemplateColumns: "48px repeat(7, 1fr)", minHeight: 44 }}>
                    <div style={{ padding: "4px 6px 0", borderRight: "1px solid var(--border)", borderBottom: "1px solid rgba(30,37,48,0.5)" }}>
                      <span style={{ fontSize: 9, color: "var(--t4)", fontFamily: "monospace" }}>{fmtHour(h)}</span>
                    </div>
                    {weekDays.map((d, i) => (
                      <div key={i} style={{ borderLeft: "1px solid var(--border)", borderBottom: "1px solid rgba(30,37,48,0.5)", padding: "2px 3px", background: isSameDay(d, today) ? "rgba(69,137,255,0.02)" : undefined }}>
                        {eventsForHour(d, h).map(e => (
                          <a key={e.id} href={e.htmlLink} target="_blank" rel="noreferrer" style={{ display: "block", width: "100%", padding: "2px 5px", borderRadius: 3, fontSize: 9, fontWeight: 600, marginBottom: 2, textDecoration: "none", background: `${gcalColor(e)}15`, border: `1px solid ${gcalColor(e)}25`, color: gcalColor(e), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.title}</a>
                        ))}
                        {tasksForDay(d).map(t => (
                          <button key={t.id} onClick={() => setTaskModal({ open: true, task: t })} style={{ display: "block", width: "100%", textAlign: "left", padding: "2px 5px", borderRadius: 3, fontSize: 10, fontWeight: 600, cursor: "pointer", marginBottom: 2, background: `${PRIORITY_COLOR[t.priority ?? "medium"]}15`, border: `1px solid ${PRIORITY_COLOR[t.priority ?? "medium"]}25`, color: PRIORITY_COLOR[t.priority ?? "medium"], whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.text}</button>
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
                {DAYS_SHORT.map(d => (<div key={d} style={{ padding: "6px 0", textAlign: "center", fontSize: 10, fontWeight: 700, color: "var(--t3)", letterSpacing: "0.08em" }}>{d}</div>))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
                {monthGrid().map((d, i) => {
                  if (!d) return <div key={i} />;
                  const dayTasks  = tasksForDay(d);
                  const dayEvents = eventsForDay(d);
                  const isToday   = isSameDay(d, today);
                  return (
                    <div key={i} style={{ minHeight: 76, padding: "6px 8px", borderRadius: 6, background: isToday ? "rgba(69,137,255,0.07)" : "var(--surface)", border: `1px solid ${isToday ? "rgba(69,137,255,0.25)" : "var(--border)"}`, cursor: "pointer" }}>
                      <div style={{ width: 22, height: 22, borderRadius: "50%", marginBottom: 4, background: isToday ? "var(--blue)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontSize: 11, fontWeight: isToday ? 800 : 500, color: isToday ? "#fff" : "var(--t2)" }}>{d.getDate()}</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        {dayEvents.slice(0, 2).map(e => (
                          <a key={e.id} href={e.htmlLink} target="_blank" rel="noreferrer" onClick={ev => ev.stopPropagation()} style={{ display: "block", padding: "2px 4px", borderRadius: 3, fontSize: 9, fontWeight: 600, textDecoration: "none", background: `${gcalColor(e)}15`, color: gcalColor(e), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.title}</a>
                        ))}
                        {dayTasks.slice(0, 2).map(t => (
                          <button key={t.id} onClick={() => setTaskModal({ open: true, task: t })} style={{ display: "block", width: "100%", textAlign: "left", padding: "2px 4px", borderRadius: 3, fontSize: 9, fontWeight: 600, cursor: "pointer", background: `${PRIORITY_COLOR[t.priority ?? "medium"]}15`, color: PRIORITY_COLOR[t.priority ?? "medium"], whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", border: "none" }}>{t.text}</button>
                        ))}
                        {(dayEvents.length + dayTasks.length) > 4 && (
                          <span style={{ fontSize: 9, color: "var(--t4)" }}>+{dayEvents.length + dayTasks.length - 4} more</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </HudCard>
          )}
        </div>

        {/* SIDEBAR: TASKS */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { label: "Open", value: openTasks.length, color: "var(--blue)" },
              { label: "Done", value: doneTasks.length, color: "var(--green)" },
              { label: "High Priority", value: highPrio.length, color: "var(--red)" },
              { label: gcalConnected ? "GCal Events" : "With Deadline", value: gcalConnected ? gcalEvents.length : tasks.filter(t => t.due_date).length, color: "var(--amber)" },
            ].map(s => (
              <HudCard key={s.label} style={{ padding: "12px 14px" }}>
                <p style={{ fontSize: 20, fontWeight: 800, color: s.color, fontFamily: "monospace" }}>{s.value}</p>
                <p style={{ fontSize: 10, color: "var(--t3)", fontWeight: 600, marginTop: 2 }}>{s.label}</p>
              </HudCard>
            ))}
          </div>

          <HudCard style={{ padding: "16px 16px", flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--t3)" }}>Open Tasks</p>
              <button onClick={() => setTaskModal({ open: true, task: null })} style={{ width: 20, height: 20, borderRadius: 4, cursor: "pointer", background: "rgba(69,137,255,0.08)", border: "1px solid rgba(69,137,255,0.2)", color: "var(--blue)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 360, overflowY: "auto" }}>
              {openTasks.length === 0 && <p style={{ fontSize: 12, color: "var(--t4)", textAlign: "center", padding: "20px 0" }}>All clear.</p>}
              {openTasks.map(t => (
                <div key={t.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 10px", borderRadius: 6, background: "var(--surface2)", borderLeft: `2px solid ${PRIORITY_COLOR[t.priority ?? "medium"]}` }}>
                  <button onClick={() => toggleTask(t.id, t.completed)} style={{ width: 14, height: 14, borderRadius: 3, flexShrink: 0, marginTop: 1, background: "transparent", border: "1px solid var(--border2)", cursor: "pointer" }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, color: "var(--t1)", fontWeight: 500, lineHeight: 1.4 }}>{t.text}</p>
                    {t.due_date && <p style={{ fontSize: 10, color: "var(--t4)", marginTop: 2 }}>Due {new Date(t.due_date + "T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})}</p>}
                  </div>
                  <button onClick={() => setTaskModal({ open: true, task: t })} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t4)", padding: 2, flexShrink: 0 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                </div>
              ))}
            </div>
          </HudCard>

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

      {taskModal.open && (
        <TaskModal task={taskModal.task} onSave={saveTask} onClose={() => setTaskModal({ open: false, task: null })} onDelete={taskModal.task ? () => deleteTask(taskModal.task!.id) : undefined} />
      )}
      {eventModal && (
        <EventModal defaultDate={cursor} onSave={createGcalEvent} onClose={() => setEventModal(false)} />
      )}
    </div>
  );
}
