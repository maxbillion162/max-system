"use client";

/**
 * Discipline — one-page daily execution surface.
 *
 * Full CRUD on habits + goals lives here. No navigating to other pages.
 * The old /dashboard/habits and /dashboard/goals routes remain functional
 * for compatibility (agent tool references, bookmarks) but this page is
 * the flagship.
 *
 * Design principles:
 * - Density earns its place. Every element ships real information or a real action.
 * - Tabular mono numbers. Thin hairline borders. Ice-blue accent used sparingly.
 * - Optimistic UI with rollback on any destructive action failure.
 * - ESC closes any modal. Backdrop click closes any modal.
 * - Milestone crosses celebrate (brief ice-blue pulse + toast) — subtle.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/lib/supabase";

/* ════════════════════════════════════════════════════════════════════
   TYPES + CONSTANTS
   ════════════════════════════════════════════════════════════════════ */

interface Goal {
  id: string; label: string; desc: string;
  current: number; target: number; unit: string;
  deadline: string; color: string; category: string;
  milestones: { l: string; v: number }[];
  subgoals:   { text: string; done: boolean }[];
}
interface Habit {
  id: string; name: string; cat: string; color: string;
  best: number;
}
interface Note {
  id: string; goal_id: string; text: string; created_at: string;
}
/** Explicit manual link: habit id → goal ids it feeds.
 *  Stored as single row in settings under key 'habit_goal_links'. */
type LinkMap = Record<string, string[]>;

const GOAL_CATEGORIES = ["Income", "Finance", "Fitness", "Learning", "Morning", "Health", "Business", "Personal"];
const HABIT_CATEGORIES = ["Morning", "Health", "Nutrition", "Learning", "Sleep", "Mindset", "Work", "Other"];
const COLORS = ["#7DB8E8", "#5FB07D", "#C85A5A", "#9B8AFB", "#E4EAF2", "#8794A6"];

const LEVEL_DEFS = [
  { name: "Recruit",     min: 0,  color: "var(--t3)"    },
  { name: "Consistent",  min: 7,  color: "var(--blue)"  },
  { name: "Machine",     min: 21, color: "var(--amber)" },
  { name: "Untouchable", min: 60, color: "var(--green)" },
];

const MONO = `ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace`;

/* ════════════════════════════════════════════════════════════════════
   HELPERS
   ════════════════════════════════════════════════════════════════════ */

function todayStr(): string { return new Date().toISOString().slice(0, 10); }
function daysUntil(deadline: string): number {
  if (!deadline) return 0;
  return Math.max(0, Math.round((new Date(deadline).getTime() - Date.now()) / 86_400_000));
}
function daysAgoStr(n: number): string {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function getLast30Days(): string[] {
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (29 - i));
    return d.toISOString().slice(0, 10);
  });
}
function computeStreak(completed: Set<string>): number {
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 400; i++) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    if (completed.has(d.toISOString().slice(0, 10))) streak++;
    else break;
  }
  return streak;
}
function getLevel(best: number) {
  return [...LEVEL_DEFS].reverse().find(l => best >= l.min) ?? LEVEL_DEFS[0];
}
function getStatus(g: Goal) {
  const now = new Date(), deadline = new Date(g.deadline);
  const pct = Math.min(100, (g.current / Math.max(1, g.target)) * 100);
  const daysLeft = daysUntil(g.deadline);
  if (g.current >= g.target) return { label: "COMPLETE",   color: "var(--green)" };
  if (daysLeft <= 0)         return { label: "OVERDUE",    color: "var(--red)"   };
  const startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const expectedPct = Math.min(100, (now.getTime() - startDate.getTime()) / Math.max(1, (deadline.getTime() - startDate.getTime())) * 100);
  if (pct >= expectedPct * 1.1) return { label: "CRUSHING", color: "var(--green)" };
  if (pct >= expectedPct * 0.9) return { label: "ON TRACK", color: "var(--blue)"  };
  if (pct >= expectedPct * 0.6) return { label: "BEHIND",   color: "var(--amber)" };
  return { label: "STALLED", color: "var(--red)" };
}
function formatValue(g: Goal): string {
  return g.unit === "$"
    ? `$${Math.round(g.current).toLocaleString()} / $${Math.round(g.target).toLocaleString()}`
    : `${g.current} / ${g.target} ${g.unit}`;
}

/* ════════════════════════════════════════════════════════════════════
   MODAL WRAPPER
   ════════════════════════════════════════════════════════════════════ */

function Modal({ onClose, children, width = 480 }: { onClose: () => void; children: React.ReactNode; width?: number }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "linear-gradient(160deg, #0f141d 0%, #080b11 100%)",
          border: "1px solid var(--border2)",
          borderRadius: 3,
          padding: "26px 28px",
          width, maxWidth: "92vw", maxHeight: "90vh", overflowY: "auto",
          boxShadow: "0 32px 80px rgba(0,0,0,0.65)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   GOAL EDITOR (add + edit)
   ════════════════════════════════════════════════════════════════════ */

interface GoalDraft {
  id?: string;
  label: string; desc: string;
  current: number; target: number;
  unit: string; deadline: string;
  color: string; category: string;
  milestones: { l: string; v: number }[];
  subgoals:   { text: string; done: boolean }[];
}

function GoalEditor({ initial, onSave, onClose, onDelete }: {
  initial?: Goal;
  onSave: (d: GoalDraft) => Promise<void>;
  onClose: () => void;
  onDelete?: () => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<GoalDraft>(() => initial
    ? { id: initial.id, label: initial.label, desc: initial.desc, current: initial.current, target: initial.target,
        unit: initial.unit, deadline: initial.deadline, color: initial.color, category: initial.category,
        milestones: initial.milestones, subgoals: initial.subgoals }
    : { label: "", desc: "", current: 0, target: 100, unit: "$", deadline: new Date(Date.now() + 180 * 86_400_000).toISOString().slice(0, 10),
        color: "#7DB8E8", category: "Finance", milestones: [], subgoals: [] });
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const isNew = !initial;

  async function handleSave() {
    if (!draft.label.trim()) return;
    setBusy(true);
    await onSave(draft);
    setBusy(false);
    onClose();
  }

  return (
    <Modal onClose={onClose} width={540}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--t1)", letterSpacing: "0.02em" }}>{isNew ? "NEW GOAL" : "EDIT GOAL"}</h3>
        <button onClick={onClose} style={iconBtn()}><CloseIcon /></button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Field label="Goal">
          <input autoFocus value={draft.label} onChange={e => setDraft(p => ({ ...p, label: e.target.value }))}
            placeholder="e.g. Save $10K emergency fund" style={inputStyle()} />
        </Field>

        <Field label="Description">
          <textarea value={draft.desc} onChange={e => setDraft(p => ({ ...p, desc: e.target.value }))} rows={2}
            placeholder="What this means to you" style={{ ...inputStyle(), resize: "vertical", fontFamily: "inherit" }} />
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <Field label="Current"><input type="number" value={draft.current} onChange={e => setDraft(p => ({ ...p, current: parseFloat(e.target.value) || 0 }))} style={inputStyle()} /></Field>
          <Field label="Target"><input type="number" value={draft.target} onChange={e => setDraft(p => ({ ...p, target: parseFloat(e.target.value) || 1 }))} style={inputStyle()} /></Field>
          <Field label="Unit"><input value={draft.unit} onChange={e => setDraft(p => ({ ...p, unit: e.target.value }))} placeholder="$, days, weeks…" style={inputStyle()} /></Field>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Category">
            <select value={draft.category} onChange={e => setDraft(p => ({ ...p, category: e.target.value }))} style={{ ...inputStyle(), cursor: "pointer" }}>
              {GOAL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Deadline">
            <input type="date" value={draft.deadline} onChange={e => setDraft(p => ({ ...p, deadline: e.target.value }))}
              style={{ ...inputStyle(), colorScheme: "dark" }} />
          </Field>
        </div>

        <Field label="Accent color">
          <div style={{ display: "flex", gap: 8 }}>
            {COLORS.map(c => (
              <button key={c} onClick={() => setDraft(p => ({ ...p, color: c }))}
                style={{
                  width: 24, height: 24, borderRadius: 2, background: c, border: "none", cursor: "pointer",
                  outline: draft.color === c ? `2px solid ${c}` : "2px solid transparent", outlineOffset: 2,
                }} />
            ))}
          </div>
        </Field>

        <MilestonesEditor value={draft.milestones} onChange={m => setDraft(p => ({ ...p, milestones: m }))} unit={draft.unit} />
        <SubgoalsEditor   value={draft.subgoals}   onChange={s => setDraft(p => ({ ...p, subgoals: s }))} />

        {confirming && onDelete && (
          <div style={{ padding: "10px 14px", borderRadius: 3, background: "rgba(200,90,90,0.08)", border: "1px solid rgba(200,90,90,0.3)" }}>
            <p style={{ fontSize: 12, color: "var(--t1)", marginBottom: 8 }}>Delete <strong>{initial?.label}</strong>? Notes will also be removed.</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setConfirming(false)} disabled={busy} style={{ ...btnSecondary(), flex: 1 }}>Keep</button>
              <button
                onClick={async () => { setBusy(true); const ok = await onDelete(); setBusy(false); if (ok) onClose(); else setConfirming(false); }}
                disabled={busy} style={{ ...btnDanger(), flex: 1 }}>
                {busy ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        {onDelete && !confirming && <button onClick={() => setConfirming(true)} style={btnDanger()}>Delete</button>}
        <button onClick={onClose} style={{ ...btnSecondary(), flex: 1 }}>Cancel</button>
        <button onClick={handleSave} disabled={busy || !draft.label.trim()} style={{ ...btnPrimary(), flex: 2, opacity: draft.label.trim() ? 1 : 0.4 }}>
          {busy ? "Saving…" : isNew ? "Create Goal" : "Save Changes"}
        </button>
      </div>
    </Modal>
  );
}

function MilestonesEditor({ value, onChange, unit }: { value: { l: string; v: number }[]; onChange: (v: { l: string; v: number }[]) => void; unit: string }) {
  const [label, setLabel] = useState(""); const [val, setVal] = useState("");
  return (
    <Field label="Milestones">
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
        {value.map((m, i) => (
          <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ flex: 1, fontSize: 12, color: "var(--t2)", fontFamily: MONO }}>{m.l} · {unit === "$" ? `$${m.v.toLocaleString()}` : `${m.v} ${unit}`}</span>
            <button onClick={() => onChange(value.filter((_, j) => j !== i))} style={iconBtn()}><CloseIcon size={10} /></button>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Label (e.g. Halfway)" style={{ ...inputStyle(), flex: 1 }} />
        <input type="number" value={val} onChange={e => setVal(e.target.value)} placeholder="Value" style={{ ...inputStyle(), width: 100 }} />
        <button onClick={() => { if (label.trim() && val) { onChange([...value, { l: label.trim(), v: parseFloat(val) }]); setLabel(""); setVal(""); } }} style={btnSecondary()}>+</button>
      </div>
    </Field>
  );
}

function SubgoalsEditor({ value, onChange }: { value: { text: string; done: boolean }[]; onChange: (v: { text: string; done: boolean }[]) => void }) {
  const [text, setText] = useState("");
  return (
    <Field label="Sub-goals">
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
        {value.map((s, i) => (
          <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button onClick={() => onChange(value.map((x, j) => j === i ? { ...x, done: !x.done } : x))}
              style={{ width: 14, height: 14, borderRadius: 2, border: `1.5px solid ${s.done ? "var(--blue)" : "var(--border2)"}`, background: s.done ? "var(--blue)" : "transparent", cursor: "pointer", flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 12, color: s.done ? "var(--t3)" : "var(--t1b)", textDecoration: s.done ? "line-through" : "none" }}>{s.text}</span>
            <button onClick={() => onChange(value.filter((_, j) => j !== i))} style={iconBtn()}><CloseIcon size={10} /></button>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <input value={text} onChange={e => setText(e.target.value)} placeholder="Add a step…"
          onKeyDown={e => { if (e.key === "Enter" && text.trim()) { onChange([...value, { text: text.trim(), done: false }]); setText(""); } }}
          style={{ ...inputStyle(), flex: 1 }} />
        <button onClick={() => { if (text.trim()) { onChange([...value, { text: text.trim(), done: false }]); setText(""); } }} style={btnSecondary()}>+</button>
      </div>
    </Field>
  );
}

/* ════════════════════════════════════════════════════════════════════
   HABIT EDITOR
   ════════════════════════════════════════════════════════════════════ */

function HabitEditor({ initial, onSave, onClose, onDelete }: {
  initial?: Habit; onSave: (h: { id?: string; name: string; cat: string; color: string }) => Promise<void>;
  onClose: () => void; onDelete?: () => Promise<boolean>;
}) {
  const [name, setName]   = useState(initial?.name   ?? "");
  const [cat,  setCat]    = useState(initial?.cat    ?? "Morning");
  const [color, setColor] = useState(initial?.color  ?? "#7DB8E8");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const isNew = !initial;

  return (
    <Modal onClose={onClose} width={420}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--t1)", letterSpacing: "0.02em" }}>{isNew ? "NEW HABIT" : "EDIT HABIT"}</h3>
        <button onClick={onClose} style={iconBtn()}><CloseIcon /></button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Field label="Habit">
          <input autoFocus value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && name.trim()) { void (async () => { setBusy(true); await onSave({ id: initial?.id, name: name.trim(), cat, color }); setBusy(false); onClose(); })(); } }}
            placeholder="e.g. Gym session" style={inputStyle()} />
        </Field>
        <Field label="Category">
          <select value={cat} onChange={e => setCat(e.target.value)} style={{ ...inputStyle(), cursor: "pointer" }}>
            {HABIT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Accent color">
          <div style={{ display: "flex", gap: 8 }}>
            {COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)}
                style={{ width: 24, height: 24, borderRadius: 2, background: c, border: "none", cursor: "pointer",
                  outline: color === c ? `2px solid ${c}` : "2px solid transparent", outlineOffset: 2 }} />
            ))}
          </div>
        </Field>
        {confirming && onDelete && (
          <div style={{ padding: "10px 14px", borderRadius: 3, background: "rgba(200,90,90,0.08)", border: "1px solid rgba(200,90,90,0.3)" }}>
            <p style={{ fontSize: 12, color: "var(--t1)", marginBottom: 8 }}>Delete <strong>{initial?.name}</strong>? All completion history removed.</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setConfirming(false)} disabled={busy} style={{ ...btnSecondary(), flex: 1 }}>Keep</button>
              <button onClick={async () => { setBusy(true); const ok = await onDelete(); setBusy(false); if (ok) onClose(); else setConfirming(false); }} disabled={busy} style={{ ...btnDanger(), flex: 1 }}>{busy ? "Deleting…" : "Delete"}</button>
            </div>
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        {onDelete && !confirming && <button onClick={() => setConfirming(true)} style={btnDanger()}>Delete</button>}
        <button onClick={onClose} style={{ ...btnSecondary(), flex: 1 }}>Cancel</button>
        <button onClick={async () => { if (!name.trim()) return; setBusy(true); await onSave({ id: initial?.id, name: name.trim(), cat, color }); setBusy(false); onClose(); }} disabled={busy || !name.trim()} style={{ ...btnPrimary(), flex: 2, opacity: name.trim() ? 1 : 0.4 }}>
          {busy ? "Saving…" : isNew ? "Create Habit" : "Save"}
        </button>
      </div>
    </Modal>
  );
}

/* ════════════════════════════════════════════════════════════════════
   SHARED STYLES
   ════════════════════════════════════════════════════════════════════ */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--t3)", display: "block", marginBottom: 6, fontFamily: MONO }}>{label}</label>
      {children}
    </div>
  );
}
function inputStyle(): React.CSSProperties {
  return { width: "100%", background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 2, padding: "8px 12px", color: "var(--t1)", fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
}
function btnPrimary(): React.CSSProperties {
  return { padding: "10px 16px", borderRadius: 2, background: "rgba(125,184,232,0.12)", border: "1px solid rgba(125,184,232,0.4)", color: "var(--blue)", fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer", fontFamily: MONO };
}
function btnSecondary(): React.CSSProperties {
  return { padding: "10px 16px", borderRadius: 2, background: "transparent", border: "1px solid var(--border2)", color: "var(--t2)", fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer", fontFamily: MONO };
}
function btnDanger(): React.CSSProperties {
  return { padding: "10px 14px", borderRadius: 2, background: "rgba(200,90,90,0.08)", border: "1px solid rgba(200,90,90,0.3)", color: "var(--red)", fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer", fontFamily: MONO };
}
function iconBtn(): React.CSSProperties {
  return { background: "none", border: "none", cursor: "pointer", color: "var(--t3)", padding: 4, display: "inline-flex", alignItems: "center", justifyContent: "center" };
}
function CloseIcon({ size = 13 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>;
}

/* ════════════════════════════════════════════════════════════════════
   LINK PICKER (link a habit to a goal)
   ════════════════════════════════════════════════════════════════════ */

function LinkHabitPicker({ habits, linkedIds, onLink, onClose }: {
  habits: Habit[]; linkedIds: string[]; onLink: (habitId: string) => void; onClose: () => void;
}) {
  const available = habits.filter(h => !linkedIds.includes(h.id));
  return (
    <Modal onClose={onClose} width={380}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--t1)", letterSpacing: "0.22em", textTransform: "uppercase", fontFamily: MONO }}>LINK A HABIT</h3>
        <button onClick={onClose} style={iconBtn()}><CloseIcon /></button>
      </div>
      {available.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--t4)", padding: "12px 0" }}>All habits are already linked to this goal.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {available.map(h => (
            <button key={h.id} onClick={() => { onLink(h.id); onClose(); }}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "transparent", border: "1px solid var(--border)", borderRadius: 2, cursor: "pointer", textAlign: "left", transition: "background .15s, border-color .15s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(125,184,232,0.04)"; (e.currentTarget as HTMLElement).style.borderColor = `${h.color}55`; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: h.color, flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: "var(--t1)", fontWeight: 500, flex: 1 }}>{h.name}</span>
              <span style={{ fontSize: 10, fontFamily: MONO, color: "var(--t4)", letterSpacing: "0.14em", textTransform: "uppercase" }}>{h.cat}</span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}

/* ════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ════════════════════════════════════════════════════════════════════ */

export default function DisciplinePage() {
  const [goals,     setGoals]     = useState<Goal[]>([]);
  const [habits,    setHabits]    = useState<Habit[]>([]);
  const [logs,      setLogs]      = useState<Map<string, Set<string>>>(new Map());
  const [notes,     setNotes]     = useState<Note[]>([]);
  const [links,     setLinks]     = useState<LinkMap>({});
  const [loading,   setLoading]   = useState(true);

  const [editingGoalId, setEditingGoalId] = useState<string | "new" | null>(null);
  const [editingHabit,  setEditingHabit]  = useState<Habit | "new" | null>(null);
  const [expandedGoal,  setExpandedGoal]  = useState<string | null>(null);
  const [linkingGoalId, setLinkingGoalId] = useState<string | null>(null);
  const [celebration,   setCelebration]   = useState<{ label: string; color: string } | null>(null);

  const today = todayStr();
  const last30 = useMemo(getLast30Days, []);

  /* ─── Load ─── */
  const load = useCallback(async () => {
    const [goalsRes, habitsRes, logsRes, notesRes, settingsRes] = await Promise.allSettled([
      supabase.from("goals").select("id,label,description,current,target,unit,deadline,color,category,milestones,subgoals").order("deadline"),
      supabase.from("habits").select("id,name,cat,color,best").order("cat"),
      supabase.from("habit_logs").select("habit_id,date,completed").eq("completed", true).gte("date", last30[0]),
      supabase.from("goal_notes").select("id,goal_id,text,created_at").order("created_at"),
      supabase.from("settings").select("value").eq("key", "habit_goal_links").single(),
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
        milestones: Array.isArray(r.milestones) ? (r.milestones as { l: string; v: number }[]) : [],
        subgoals:   Array.isArray(r.subgoals)   ? (r.subgoals   as { text: string; done: boolean }[]) : [],
      })));
    }
    if (habitsRes.status === "fulfilled" && habitsRes.value.data) {
      setHabits(habitsRes.value.data.map(r => ({
        id: String(r.id), name: String(r.name ?? ""), cat: String(r.cat ?? "Other"),
        color: String(r.color ?? "#7DB8E8"), best: Number(r.best ?? 0),
      })));
    }
    if (logsRes.status === "fulfilled" && logsRes.value.data) {
      const m = new Map<string, Set<string>>();
      for (const l of logsRes.value.data as { habit_id: string; date: string }[]) {
        if (!m.has(l.habit_id)) m.set(l.habit_id, new Set());
        m.get(l.habit_id)!.add(l.date);
      }
      setLogs(m);
    }
    if (notesRes.status === "fulfilled" && notesRes.value.data) {
      setNotes((notesRes.value.data as { id: string; goal_id: string; text: string; created_at: string }[]).map(r => ({
        id: String(r.id), goal_id: String(r.goal_id), text: String(r.text ?? ""), created_at: String(r.created_at ?? new Date().toISOString()),
      })));
    }
    if (settingsRes.status === "fulfilled" && settingsRes.value.data?.value) {
      setLinks(settingsRes.value.data.value as LinkMap);
    }
    setLoading(false);
  }, [last30]);

  useEffect(() => { load(); }, [load]);

  /* ─── Goal CRUD ─── */
  async function saveGoal(d: GoalDraft) {
    const id = d.id ?? d.label.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") + "-" + Date.now();
    const row = {
      id, label: d.label, description: d.desc, current: d.current, target: d.target,
      unit: d.unit, deadline: d.deadline, color: d.color, category: d.category,
      milestones: d.milestones, subgoals: d.subgoals,
    };
    const { error } = d.id
      ? await supabase.from("goals").update(row).eq("id", id)
      : await supabase.from("goals").insert(row);
    if (error) { alert(`Couldn't save: ${error.message}`); return; }
    await load();
  }

  async function deleteGoal(id: string): Promise<boolean> {
    const prev = goals;
    setGoals(p => p.filter(g => g.id !== id));
    const notesRes = await supabase.from("goal_notes").delete().eq("goal_id", id);
    const goalRes  = await supabase.from("goals").delete().eq("id", id);
    if (notesRes.error || goalRes.error) {
      setGoals(prev);
      alert(`Couldn't delete: ${(goalRes.error ?? notesRes.error)?.message}`);
      return false;
    }
    setNotes(p => p.filter(n => n.goal_id !== id));
    // Unlink all habits from this goal
    const next = { ...links };
    for (const hid of Object.keys(next)) next[hid] = next[hid].filter(gid => gid !== id);
    setLinks(next);
    await supabase.from("settings").upsert({ key: "habit_goal_links", value: next });
    return true;
  }

  async function updateGoalCurrent(id: string, current: number) {
    const existing = goals.find(g => g.id === id);
    if (!existing) return;
    const crossedMilestone = existing.milestones.find(m => existing.current < m.v && current >= m.v);
    setGoals(p => p.map(g => g.id === id ? { ...g, current } : g));
    await supabase.from("goals").update({ current }).eq("id", id);
    if (crossedMilestone) {
      setCelebration({ label: `${crossedMilestone.l} milestone on ${existing.label}`, color: existing.color });
      await supabase.from("activity_log").insert({
        type: "milestone_hit",
        description: `Hit ${crossedMilestone.l} milestone on ${existing.label}.`,
        detail: { goal_id: id, milestone: crossedMilestone },
      }).then(() => {}, () => {});
      setTimeout(() => setCelebration(null), 4000);
    }
  }

  async function toggleSubgoal(goalId: string, idx: number) {
    const g = goals.find(x => x.id === goalId);
    if (!g) return;
    const next = g.subgoals.map((s, i) => i === idx ? { ...s, done: !s.done } : s);
    setGoals(p => p.map(x => x.id === goalId ? { ...x, subgoals: next } : x));
    await supabase.from("goals").update({ subgoals: next }).eq("id", goalId);
  }

  /* ─── Habit CRUD ─── */
  async function saveHabit(h: { id?: string; name: string; cat: string; color: string }) {
    const id = h.id ?? `h${Date.now()}`;
    if (h.id) {
      setHabits(p => p.map(x => x.id === id ? { ...x, name: h.name, cat: h.cat, color: h.color } : x));
      await supabase.from("habits").update({ name: h.name, cat: h.cat, color: h.color }).eq("id", id);
    } else {
      setHabits(p => [...p, { id, name: h.name, cat: h.cat, color: h.color, best: 0 }]);
      await supabase.from("habits").insert({ id, name: h.name, cat: h.cat, color: h.color, completed: false, streak: 0, best: 0, updated_at: new Date().toISOString() });
    }
  }

  async function deleteHabit(id: string): Promise<boolean> {
    const prev = habits;
    setHabits(p => p.filter(h => h.id !== id));
    const logsRes = await supabase.from("habit_logs").delete().eq("habit_id", id);
    const habRes  = await supabase.from("habits").delete().eq("id", id);
    if (logsRes.error || habRes.error) {
      setHabits(prev);
      alert(`Couldn't delete habit: ${(habRes.error ?? logsRes.error)?.message}`);
      return false;
    }
    // Unlink from all goals
    if (links[id]) {
      const next = { ...links }; delete next[id];
      setLinks(next);
      await supabase.from("settings").upsert({ key: "habit_goal_links", value: next });
    }
    return true;
  }

  async function toggleHabit(habitId: string) {
    const wasDone = logs.get(habitId)?.has(today) ?? false;
    setLogs(prev => {
      const next = new Map(prev);
      const set = new Set(next.get(habitId) ?? []);
      if (wasDone) set.delete(today); else set.add(today);
      next.set(habitId, set);
      return next;
    });
    if (wasDone) {
      await supabase.from("habit_logs").update({ completed: false }).eq("habit_id", habitId).eq("date", today);
    } else {
      await supabase.from("habit_logs").upsert({ habit_id: habitId, date: today, completed: true });
    }
  }

  /* ─── Linking ─── */
  async function linkHabitToGoal(habitId: string, goalId: string) {
    const next = { ...links };
    next[habitId] = [...(next[habitId] ?? []), goalId];
    setLinks(next);
    await supabase.from("settings").upsert({ key: "habit_goal_links", value: next });
  }
  async function unlinkHabitFromGoal(habitId: string, goalId: string) {
    const next = { ...links };
    next[habitId] = (next[habitId] ?? []).filter(gid => gid !== goalId);
    if (next[habitId].length === 0) delete next[habitId];
    setLinks(next);
    await supabase.from("settings").upsert({ key: "habit_goal_links", value: next });
  }

  /* ─── Derived ─── */
  const streaks = useMemo(() => {
    const s: Record<string, number> = {};
    for (const h of habits) s[h.id] = computeStreak(logs.get(h.id) ?? new Set());
    return s;
  }, [habits, logs]);

  const doneToday   = habits.filter(h => logs.get(h.id)?.has(today)).length;
  const totalToday  = habits.length;
  const pctToday    = totalToday > 0 ? Math.round((doneToday / totalToday) * 100) : 0;
  const overallBest = Math.max(0, ...habits.map(h => h.best), ...Object.values(streaks));
  const level       = getLevel(overallBest);

  // Momentum: 0-100, weighted 60% today + 40% 7-day-avg, with streak bonus (cap +15)
  const momentum = useMemo(() => {
    if (totalToday === 0) return { score: 0, trend: [] as number[] };
    const daily = last30.slice(-7).map(d => {
      const done = habits.filter(h => logs.get(h.id)?.has(d)).length;
      return totalToday > 0 ? (done / totalToday) * 100 : 0;
    });
    const weekAvg = daily.reduce((s, v) => s + v, 0) / daily.length;
    const streakBonus = Math.min(15, overallBest / 4);
    const base = pctToday * 0.6 + weekAvg * 0.4;
    const score = Math.min(100, Math.round(base + streakBonus));
    const trend = last30.slice(-14).map(d => {
      const done = habits.filter(h => logs.get(h.id)?.has(d)).length;
      return totalToday > 0 ? (done / totalToday) * 100 : 0;
    });
    return { score, trend };
  }, [habits, logs, last30, pctToday, overallBest, totalToday]);

  // Focus goal — most urgent = lowest % complete per remaining time
  const focusGoal = useMemo(() => {
    const candidates = goals
      .filter(g => g.deadline && daysUntil(g.deadline) > 0 && g.current < g.target)
      .map(g => {
        const pct = g.current / g.target;
        const days = daysUntil(g.deadline);
        const urgency = (1 - pct) / Math.max(1, days / 7);
        return { g, urgency };
      })
      .sort((a, b) => b.urgency - a.urgency);
    return candidates[0]?.g ?? null;
  }, [goals]);

  /* ─── Habits for a goal: union of explicit links + semantic matches ─── */
  function habitsForGoal(g: Goal): Habit[] {
    const explicit = new Set(Object.entries(links).filter(([, gids]) => gids.includes(g.id)).map(([hid]) => hid));
    const gcat = g.category.toLowerCase();
    const gl = (g.label + " " + g.category).toLowerCase();
    const out: Habit[] = [];
    for (const h of habits) {
      if (explicit.has(h.id)) { out.push(h); continue; }
      const hcat = h.cat.toLowerCase();
      const hl = (h.name + " " + h.cat).toLowerCase();
      const semanticMatch =
        gcat === hcat ||
        ((gcat === "fitness" || gcat === "health") && (hcat === "health" || hcat === "fitness")) ||
        [["gym","gym"],["workout","workout"],["morning","morning"],["sleep","sleep"],["read","learn"],["learn","learn"],["protein","nutrition"]]
          .some(([gkw, hkw]) => gl.includes(gkw) && hl.includes(hkw));
      if (semanticMatch) out.push(h);
    }
    return out;
  }

  /* ─── Habits grouped by category ─── */
  const groupedHabits = useMemo(() => {
    const g: Record<string, Habit[]> = {};
    for (const h of habits) {
      if (!g[h.cat]) g[h.cat] = [];
      g[h.cat].push(h);
    }
    return g;
  }, [habits]);

  /* ──────────── RENDER ──────────── */

  if (loading) return (
    <div style={{ display: "flex", height: "60vh", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 6 }}>{[0, 1, 2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--blue)", opacity: 0.5, animation: `bounce 0.8s ease-in-out ${i * 0.18}s infinite` }} />)}</div>
      <p style={{ fontSize: 12, color: "var(--t4)" }}>Loading discipline…</p>
    </div>
  );

  const editingGoal = editingGoalId && editingGoalId !== "new" ? goals.find(g => g.id === editingGoalId) : undefined;

  return (
    <div style={{ padding: "32px 44px", background: "var(--bg)", minHeight: "100vh", maxWidth: 1320, margin: "0 auto" }}>

      {/* Modals */}
      {editingGoalId && (
        <GoalEditor
          initial={editingGoal}
          onSave={saveGoal}
          onClose={() => setEditingGoalId(null)}
          onDelete={editingGoal ? () => deleteGoal(editingGoal.id) : undefined}
        />
      )}
      {editingHabit && (
        <HabitEditor
          initial={editingHabit === "new" ? undefined : editingHabit}
          onSave={saveHabit}
          onClose={() => setEditingHabit(null)}
          onDelete={editingHabit !== "new" ? () => deleteHabit((editingHabit as Habit).id) : undefined}
        />
      )}
      {linkingGoalId && (() => {
        const g = goals.find(x => x.id === linkingGoalId);
        if (!g) return null;
        const linkedIds = habits.filter(h => (links[h.id] ?? []).includes(g.id)).map(h => h.id);
        return (
          <LinkHabitPicker
            habits={habits}
            linkedIds={linkedIds}
            onLink={hid => linkHabitToGoal(hid, g.id)}
            onClose={() => setLinkingGoalId(null)}
          />
        );
      })()}

      {/* Milestone celebration */}
      {celebration && <CelebrationOverlay label={celebration.label} color={celebration.color} />}

      {/* ═══ HEADER ═══ */}
      <header style={{ marginBottom: 24, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.32em", textTransform: "uppercase", color: "var(--blue)", opacity: 0.7, marginBottom: 6, fontFamily: MONO }}>Discipline</p>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: "var(--t1)", letterSpacing: "-0.02em" }}>Today's Execution</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setEditingHabit("new")} style={btnSecondary()}>+ Habit</button>
          <button onClick={() => setEditingGoalId("new")} style={btnPrimary()}>+ Goal</button>
        </div>
      </header>

      {/* ═══ STATUS + MOMENTUM STRIP ═══ */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.25fr 1fr", gap: 12, marginBottom: 12 }}>
        <StatTile label="Today"    value={`${doneToday}/${totalToday}`} sub={`${pctToday}% complete`} accent={pctToday === 100 ? "var(--green)" : "var(--blue)"} />
        <MomentumTile score={momentum.score} trend={momentum.trend} />
        <StatTile label="Level"    value={level.name} sub={`best streak ${overallBest}d`} accent={level.color} />
      </div>

      {/* ═══ FOCUS STRIP ═══ */}
      {focusGoal && (
        <div style={{
          marginBottom: 28,
          padding: "14px 18px",
          borderRadius: 3,
          border: `1px solid ${focusGoal.color}35`,
          background: `linear-gradient(90deg, ${focusGoal.color}10, transparent 70%)`,
          display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
        }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.32em", color: focusGoal.color, fontFamily: MONO }}>FOCUS</span>
          <div style={{ flex: 1, minWidth: 240 }}>
            <p style={{ fontSize: 14, color: "var(--t1)", fontWeight: 700, marginBottom: 3 }}>{focusGoal.label}</p>
            <p style={{ fontSize: 11, color: "var(--t3)", fontFamily: MONO }}>
              {formatValue(focusGoal)} · {Math.round((focusGoal.current / focusGoal.target) * 100)}% · {daysUntil(focusGoal.deadline)}d to deadline
            </p>
          </div>
          <button onClick={() => setExpandedGoal(focusGoal.id)} style={btnSecondary()}>Open</button>
        </div>
      )}

      {/* ═══ TWO-COLUMN MAIN ═══ */}
      <div style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: 20 }}>

        {/* ─── GOALS COLUMN ─── */}
        <section>
          <SectionHeader label="Active Goals" count={goals.length} />
          {goals.length === 0 ? (
            <EmptyState text="No goals yet." actionLabel="Add first goal" onAction={() => setEditingGoalId("new")} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {goals.map(g => (
                <GoalCard
                  key={g.id}
                  goal={g}
                  linkedHabits={habitsForGoal(g)}
                  logsForHabits={logs}
                  today={today}
                  notes={notes.filter(n => n.goal_id === g.id)}
                  expanded={expandedGoal === g.id}
                  onToggleExpand={() => setExpandedGoal(expandedGoal === g.id ? null : g.id)}
                  onEdit={() => setEditingGoalId(g.id)}
                  onUpdateCurrent={v => updateGoalCurrent(g.id, v)}
                  onToggleSubgoal={i => toggleSubgoal(g.id, i)}
                  onLinkHabit={() => setLinkingGoalId(g.id)}
                  onUnlinkHabit={hid => unlinkHabitFromGoal(hid, g.id)}
                  onAddNote={async text => {
                    const { data } = await supabase.from("goal_notes").insert({ goal_id: g.id, text, created_at: new Date().toISOString() }).select("id,goal_id,text,created_at").single();
                    if (data) setNotes(p => [...p, { id: String(data.id), goal_id: String(data.goal_id), text: String(data.text), created_at: String(data.created_at) }]);
                  }}
                  onDeleteNote={async nid => {
                    setNotes(p => p.filter(n => n.id !== nid));
                    await supabase.from("goal_notes").delete().eq("id", nid);
                  }}
                />
              ))}
            </div>
          )}
        </section>

        {/* ─── HABITS COLUMN ─── */}
        <section>
          <SectionHeader label="Daily Habits" count={habits.length} rightText={totalToday > 0 ? `${doneToday}/${totalToday} today` : undefined} />
          {habits.length === 0 ? (
            <EmptyState text="No habits yet." actionLabel="Add first habit" onAction={() => setEditingHabit("new")} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {Object.entries(groupedHabits).map(([cat, list]) => (
                <div key={cat}>
                  <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--t4)", marginBottom: 6, fontFamily: MONO }}>{cat}</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {list.map(h => (
                      <HabitRow
                        key={h.id}
                        habit={h}
                        done={logs.get(h.id)?.has(today) ?? false}
                        streak={streaks[h.id] ?? 0}
                        feedingGoals={goals.filter(g => habitsForGoal(g).some(hh => hh.id === h.id)).slice(0, 2)}
                        onToggle={() => toggleHabit(h.id)}
                        onEdit={() => setEditingHabit(h)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ═══ 30-DAY HEATMAP ═══ */}
      {habits.length > 0 && (
        <section style={{ marginTop: 36 }}>
          <SectionHeader label="30-Day Heatmap" count={habits.length} />
          <Heatmap habits={habits} logs={logs} last30={last30} />
        </section>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ════════════════════════════════════════════════════════════════════ */

function SectionHeader({ label, count, rightText }: { label: string; count: number; rightText?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase", color: "var(--t2)", fontFamily: MONO }}>
        {label} <span style={{ color: "var(--t4)", marginLeft: 6 }}>{count}</span>
      </p>
      {rightText && <p style={{ fontSize: 10, color: "var(--t3)", fontFamily: MONO, letterSpacing: "0.1em" }}>{rightText}</p>}
    </div>
  );
}

function EmptyState({ text, actionLabel, onAction }: { text: string; actionLabel: string; onAction: () => void }) {
  return (
    <div style={{ padding: "40px 20px", borderRadius: 3, border: "1px dashed var(--border2)", textAlign: "center" }}>
      <p style={{ fontSize: 13, color: "var(--t3)", marginBottom: 12 }}>{text}</p>
      <button onClick={onAction} style={btnPrimary()}>{actionLabel}</button>
    </div>
  );
}

function StatTile({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: string }) {
  return (
    <div style={{
      padding: "16px 18px",
      background: "linear-gradient(160deg, #0f141d 0%, #080b11 100%)",
      border: "1px solid var(--border)",
      borderRadius: 3,
      boxShadow: "inset 0 1px 0 rgba(125,184,232,0.04)",
    }}>
      <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase", color: "var(--t3)", marginBottom: 6, fontFamily: MONO }}>{label}</p>
      <p style={{ fontSize: 24, fontWeight: 800, color: accent, fontFamily: MONO, letterSpacing: "-0.01em", marginBottom: 2 }}>{value}</p>
      <p style={{ fontSize: 10, color: "var(--t4)", fontFamily: MONO, letterSpacing: "0.08em" }}>{sub}</p>
    </div>
  );
}

function MomentumTile({ score, trend }: { score: number; trend: number[] }) {
  const last = trend[trend.length - 1] ?? 0;
  const prev = trend[trend.length - 2] ?? last;
  const dir = last > prev + 2 ? "up" : last < prev - 2 ? "down" : "flat";
  const w = 200, h = 42;
  const max = Math.max(...trend, 100);
  const pts = trend.map((v, i) => `${(i / Math.max(1, trend.length - 1)) * w},${h - (v / max) * h}`).join(" ");
  const dirColor = dir === "up" ? "var(--green)" : dir === "down" ? "var(--red)" : "var(--t3)";

  return (
    <div style={{
      padding: "16px 18px",
      background: "linear-gradient(160deg, #0f141d 0%, #080b11 100%)",
      border: "1px solid rgba(125,184,232,0.18)",
      borderRadius: 3,
      boxShadow: "inset 0 1px 0 rgba(125,184,232,0.06)",
      position: "relative",
    }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase", color: "var(--t3)", fontFamily: MONO }}>Momentum</p>
        <span style={{ fontSize: 10, fontFamily: MONO, color: dirColor, letterSpacing: "0.08em" }}>
          {dir === "up" ? "▲" : dir === "down" ? "▼" : "—"} {Math.abs(last - prev).toFixed(0)}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 14 }}>
        <div>
          <p style={{ fontSize: 28, fontWeight: 800, color: "var(--t1)", fontFamily: MONO, letterSpacing: "-0.02em", lineHeight: 1 }}>
            {score}
            <span style={{ fontSize: 13, color: "var(--t3)", marginLeft: 3 }}>/100</span>
          </p>
          <p style={{ fontSize: 10, color: "var(--t4)", fontFamily: MONO, letterSpacing: "0.08em", marginTop: 3 }}>14-day trend</p>
        </div>
        <svg width={w} height={h} style={{ flex: 1 }}>
          <defs>
            <linearGradient id="momGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#7DB8E8" stopOpacity="0.6" />
              <stop offset="1" stopColor="#7DB8E8" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={`0,${h} ${pts} ${w},${h}`} fill="url(#momGrad)" />
          <polyline points={pts} fill="none" stroke="#7DB8E8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

function HabitRow({ habit, done, streak, feedingGoals, onToggle, onEdit }: {
  habit: Habit; done: boolean; streak: number;
  feedingGoals: Goal[]; onToggle: () => void; onEdit: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "8px 12px",
        borderRadius: 2,
        background: done ? `${habit.color}0D` : "transparent",
        border: `1px solid ${done ? `${habit.color}33` : "var(--border)"}`,
        transition: "background .12s, border-color .12s",
      }}
    >
      <button onClick={onToggle} style={{
        width: 16, height: 16, borderRadius: 2, flexShrink: 0,
        background: done ? habit.color : "transparent",
        border: `1.5px solid ${done ? habit.color : "var(--border2)"}`,
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {done && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--bg)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
      </button>
      <span style={{ flex: 1, fontSize: 13, color: done ? "var(--t1)" : "var(--t1b)", fontWeight: 500 }}>{habit.name}</span>
      {feedingGoals.length > 0 && (
        <span style={{ fontSize: 9, color: "var(--t4)", fontFamily: MONO, letterSpacing: "0.1em" }}>
          FEEDS {feedingGoals.map(g => g.label.split(" ").slice(0, 2).join(" ")).join(" · ")}
        </span>
      )}
      {streak > 0 && (
        <span style={{ fontSize: 10, fontFamily: MONO, color: done ? habit.color : "var(--t4)", fontWeight: 700, letterSpacing: "0.05em" }}>
          {streak}d
        </span>
      )}
      <button onClick={onEdit} style={{
        background: "none", border: "none", cursor: "pointer", padding: 2,
        color: hovered ? "var(--t2)" : "transparent",
        transition: "color .12s",
      }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      </button>
    </div>
  );
}

function GoalCard({
  goal, linkedHabits, logsForHabits, today, notes, expanded,
  onToggleExpand, onEdit, onUpdateCurrent, onToggleSubgoal,
  onLinkHabit, onUnlinkHabit, onAddNote, onDeleteNote,
}: {
  goal: Goal;
  linkedHabits: Habit[];
  logsForHabits: Map<string, Set<string>>;
  today: string;
  notes: Note[];
  expanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onUpdateCurrent: (v: number) => void;
  onToggleSubgoal: (i: number) => void;
  onLinkHabit: () => void;
  onUnlinkHabit: (habitId: string) => void;
  onAddNote: (text: string) => Promise<void>;
  onDeleteNote: (id: string) => Promise<void>;
}) {
  const [editingCurrent, setEditingCurrent] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pct = Math.min(100, Math.round((goal.current / Math.max(1, goal.target)) * 100));
  const status = getStatus(goal);
  const daysLeft = daysUntil(goal.deadline);
  const linkedDoneToday = linkedHabits.filter(h => logsForHabits.get(h.id)?.has(today)).length;

  return (
    <div style={{
      background: "linear-gradient(160deg, #0f141d 0%, #080b11 100%)",
      border: `1px solid ${goal.color}2A`,
      borderRadius: 3,
      boxShadow: "inset 0 1px 0 rgba(125,184,232,0.04), 0 6px 24px rgba(0,0,0,0.35)",
      overflow: "hidden",
      transition: "border-color .15s",
    }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = `${goal.color}55`)}
      onMouseLeave={e => (e.currentTarget.style.borderColor = `${goal.color}2A`)}
    >
      <div style={{ height: 2, background: `linear-gradient(90deg, ${goal.color}, ${goal.color}44)` }} />
      <div style={{ padding: "16px 18px" }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: goal.color, padding: "2px 7px", borderRadius: 2, background: `${goal.color}10`, border: `1px solid ${goal.color}2A`, fontFamily: MONO }}>{goal.category}</span>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.22em", color: status.color, fontFamily: MONO }}>{status.label}</span>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 10, color: "var(--t4)", fontFamily: MONO, letterSpacing: "0.1em" }}>
            {daysLeft > 0 ? `${daysLeft}d LEFT` : "OVERDUE"}
          </span>
          <button onClick={onEdit} title="Edit" style={iconBtn()}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        </div>

        <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.01em", marginBottom: 4 }}>{goal.label}</h3>
        {goal.desc && <p style={{ fontSize: 12, color: "var(--t3)", lineHeight: 1.5, marginBottom: 10 }}>{goal.desc}</p>}

        {/* Progress bar + editable current */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ height: 4, borderRadius: 2, background: "var(--surface2)", overflow: "hidden", marginBottom: 6 }}>
            <div style={{ height: "100%", width: `${Math.max(pct, 0.5)}%`, background: `linear-gradient(90deg, ${goal.color}, ${goal.color}99)`, transition: "width .8s ease" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {editingCurrent !== null ? (
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {goal.unit === "$" && <span style={{ fontSize: 11, color: "var(--t3)", fontFamily: MONO }}>$</span>}
                <input
                  ref={inputRef}
                  type="number"
                  value={editingCurrent}
                  onChange={e => setEditingCurrent(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") { onUpdateCurrent(parseFloat(editingCurrent) || 0); setEditingCurrent(null); }
                    if (e.key === "Escape") setEditingCurrent(null);
                  }}
                  onBlur={() => { onUpdateCurrent(parseFloat(editingCurrent) || 0); setEditingCurrent(null); }}
                  autoFocus
                  style={{ width: 100, background: "var(--surface2)", border: `1px solid ${goal.color}55`, borderRadius: 2, padding: "3px 8px", color: "var(--t1)", fontSize: 12, fontFamily: MONO, outline: "none" }}
                />
                <span style={{ fontSize: 11, color: "var(--t3)", fontFamily: MONO }}>/ {goal.unit === "$" ? `$${Math.round(goal.target).toLocaleString()}` : `${goal.target} ${goal.unit}`}</span>
              </span>
            ) : (
              <button
                onClick={() => { setEditingCurrent(String(goal.current)); setTimeout(() => inputRef.current?.select(), 20); }}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 12, fontFamily: MONO, color: "var(--t2)", letterSpacing: "0.04em" }}
                title="Click to update"
              >
                {formatValue(goal)}
              </button>
            )}
            <span style={{ fontSize: 13, fontWeight: 700, color: goal.color, fontFamily: MONO }}>{pct}%</span>
          </div>
        </div>

        {/* Milestones strip */}
        {goal.milestones.length > 0 && (
          <div style={{ display: "flex", gap: 4, marginBottom: 12, flexWrap: "wrap" }}>
            {goal.milestones.map((m, i) => {
              const reached = m.v <= goal.current;
              return (
                <span key={i} style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                  padding: "3px 8px", borderRadius: 2,
                  background: reached ? `${goal.color}12` : "transparent",
                  border: `1px solid ${reached ? `${goal.color}40` : "var(--border)"}`,
                  color: reached ? goal.color : "var(--t4)",
                  fontFamily: MONO,
                  display: "inline-flex", alignItems: "center", gap: 4,
                }}>
                  {reached && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"><polyline points="20 6 9 17 4 12" /></svg>}
                  {m.l}
                </span>
              );
            })}
          </div>
        )}

        {/* Feeding habits — with link/unlink */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--t4)", fontFamily: MONO }}>
              Feeding Habits {linkedHabits.length > 0 && <span style={{ color: "var(--t3)" }}>· {linkedDoneToday}/{linkedHabits.length} TODAY</span>}
            </p>
            <button onClick={onLinkHabit} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--blue)", fontSize: 10, fontFamily: MONO, letterSpacing: "0.14em" }}>+ LINK</button>
          </div>
          {linkedHabits.length === 0 ? (
            <p style={{ fontSize: 11, color: "var(--t4)", fontStyle: "italic" }}>No habits linked yet.</p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {linkedHabits.map(h => {
                const done = logsForHabits.get(h.id)?.has(today) ?? false;
                return (
                  <span key={h.id} style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "3px 7px", borderRadius: 2,
                    fontSize: 10, fontWeight: 600,
                    color: done ? h.color : "var(--t3)",
                    background: done ? `${h.color}10` : "transparent",
                    border: `1px solid ${done ? `${h.color}35` : "var(--border)"}`,
                  }}>
                    <span style={{ width: 4, height: 4, borderRadius: "50%", background: done ? h.color : "var(--t4)" }} />
                    {h.name}
                    <button onClick={() => onUnlinkHabit(h.id)} title="Unlink" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t4)", padding: 0, marginLeft: 2 }}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* Expand toggle */}
        {(goal.subgoals.length > 0 || notes.length >= 0) && (
          <button onClick={onToggleExpand}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 600, letterSpacing: "0.14em", color: "var(--t3)", fontFamily: MONO, textTransform: "uppercase" }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .2s" }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
            {expanded ? "Hide" : `Details · ${goal.subgoals.length} subgoals · ${notes.length} notes`}
          </button>
        )}

        {expanded && (
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Subgoals */}
            {goal.subgoals.length > 0 && (
              <div>
                <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--t4)", marginBottom: 6, fontFamily: MONO }}>Sub-goals</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {goal.subgoals.map((s, i) => (
                    <button key={i} onClick={() => onToggleSubgoal(i)}
                      style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 10px", background: s.done ? `${goal.color}06` : "transparent", border: `1px solid ${s.done ? `${goal.color}20` : "var(--border)"}`, borderRadius: 2, cursor: "pointer", textAlign: "left" }}>
                      <span style={{ width: 12, height: 12, borderRadius: 2, flexShrink: 0, marginTop: 1, background: s.done ? `${goal.color}30` : "transparent", border: `1.5px solid ${s.done ? goal.color : "var(--border2)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {s.done && <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke={goal.color} strokeWidth="3.5"><polyline points="20 6 9 17 4 12" /></svg>}
                      </span>
                      <span style={{ fontSize: 12, color: s.done ? "var(--t3)" : "var(--t1b)", textDecoration: s.done ? "line-through" : "none" }}>{s.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Notes / journal */}
            <div>
              <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--t4)", marginBottom: 6, fontFamily: MONO }}>Journal · {notes.length}</p>
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                <input value={noteInput} onChange={e => setNoteInput(e.target.value)}
                  onKeyDown={async e => {
                    if (e.key === "Enter" && noteInput.trim() && !savingNote) {
                      setSavingNote(true); await onAddNote(noteInput.trim()); setNoteInput(""); setSavingNote(false);
                    }
                  }}
                  placeholder="Add a note…"
                  style={{ flex: 1, background: "var(--surface2)", border: `1px solid ${goal.color}25`, borderRadius: 2, padding: "6px 10px", fontSize: 12, color: "var(--t1)", outline: "none" }} />
                <button onClick={async () => { if (noteInput.trim() && !savingNote) { setSavingNote(true); await onAddNote(noteInput.trim()); setNoteInput(""); setSavingNote(false); } }} disabled={!noteInput.trim() || savingNote}
                  style={{ ...btnSecondary(), padding: "6px 12px", opacity: noteInput.trim() ? 1 : 0.4 }}>+</button>
              </div>
              {notes.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 200, overflowY: "auto" }}>
                  {[...notes].reverse().map(n => (
                    <div key={n.id} style={{ padding: "7px 10px", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 2, display: "flex", gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 12, color: "var(--t1b)", lineHeight: 1.5, marginBottom: 2 }}>{n.text}</p>
                        <p style={{ fontSize: 9, color: "var(--t4)", fontFamily: MONO, letterSpacing: "0.08em" }}>
                          {new Date(n.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {new Date(n.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <button onClick={() => onDeleteNote(n.id)} style={iconBtn()} title="Delete note">
                        <CloseIcon size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Heatmap({ habits, logs, last30 }: { habits: Habit[]; logs: Map<string, Set<string>>; last30: string[] }) {
  const cellSize = 10; const gap = 2;
  const w = last30.length * (cellSize + gap);
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", fontFamily: MONO }}>
        <tbody>
          {habits.map(h => {
            const set = logs.get(h.id) ?? new Set();
            return (
              <tr key={h.id}>
                <td style={{ paddingRight: 12, fontSize: 11, color: "var(--t2)", whiteSpace: "nowrap", textAlign: "right", verticalAlign: "middle" }}>{h.name}</td>
                <td>
                  <svg width={w} height={cellSize}>
                    {last30.map((d, i) => {
                      const on = set.has(d);
                      return <rect key={d} x={i * (cellSize + gap)} y={0} width={cellSize} height={cellSize} rx={1.5} fill={on ? h.color : "var(--surface)"} stroke={on ? "transparent" : "var(--border)"} strokeWidth="1" />;
                    })}
                  </svg>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CelebrationOverlay({ label, color }: { label: string; color: string }) {
  return (
    <>
      <style>{`
        @keyframes celebrate-in { 0% { opacity: 0; transform: translate(-50%, -40%) scale(.92);} 60% { opacity: 1; transform: translate(-50%, -50%) scale(1.02);} 100% { opacity: 1; transform: translate(-50%, -50%) scale(1);} }
        @keyframes celebrate-glow { 0%,100% { box-shadow: 0 0 0 1px ${color}55, 0 0 40px ${color}30; } 50% { box-shadow: 0 0 0 1px ${color}90, 0 0 70px ${color}60; } }
      `}</style>
      <div style={{
        position: "fixed", top: "50%", left: "50%", zIndex: 200,
        padding: "22px 32px",
        background: "linear-gradient(160deg, #0e1320 0%, #060911 100%)",
        border: `1px solid ${color}`,
        borderRadius: 3,
        animation: "celebrate-in .4s cubic-bezier(.2,.6,.2,1) both, celebrate-glow 1.8s ease-in-out infinite",
        pointerEvents: "none",
      }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.32em", textTransform: "uppercase", color, marginBottom: 6, fontFamily: MONO }}>MILESTONE</p>
        <p style={{ fontSize: 16, fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.01em" }}>{label}</p>
      </div>
    </>
  );
}
