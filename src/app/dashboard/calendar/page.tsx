"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { HudCard } from "@/components/ui/HudCard";
import { supabase } from "@/lib/supabase";

/* ── Types ── */
interface TaskList { id: string; name: string; color: string; position: number }
interface Subtask  { id: string; text: string; completed: boolean }
interface Task {
  id: string; text: string; description?: string | null; completed: boolean;
  due_date?: string | null; priority?: "high"|"medium"|"low";
  list_id?: string | null; subtasks?: Subtask[]; created_at: string;
}
interface GCalEvent {
  id: string; title: string; description: string; location: string;
  start: string; end: string; allDay: boolean; color: string | null;
  htmlLink: string; status: string;
}
interface NLPreview {
  title: string; start: string; end: string;
  location?: string | null; description?: string | null;
}
interface ModalState { date: Date; hour: number }
type CalView = "day" | "week" | "month";

/* ── Constants ── */
const DAYS_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const DAYS_FULL  = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const MONTHS     = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const HOURS      = Array.from({ length: 24 }, (_,i) => i);
const HOUR_PX    = 64;
const TIME_W     = 52;
const PRIO_COLOR: Record<string,string> = { high:"var(--red)", medium:"var(--amber)", low:"var(--blue)" };
const GCAL_COLORS: Record<string,string> = {
  "1":"#ac725e","2":"#d06b64","3":"#f83a22","4":"#fa573c","5":"#ff7537",
  "6":"#ffad46","7":"#42d692","8":"#16a765","9":"#7bd148","10":"#b3dc6c",
  "11":"#fbe983","default":"#7DB8E8",
};
const LIST_PALETTE = ["#7DB8E8","#10b981","#8b5cf6","#f59e0b","#ef4444","#06b6d4","#ec4899","#f97316"];
const DEFAULT_LISTS = [
  { name:"Personal", color:"#7DB8E8" },
  { name:"Work",     color:"#10b981" },
  { name:"M.A.X.",   color:"#8b5cf6" },
];

/* ── Helpers ── */
function fmtHour(h: number) {
  if (h === 0)  return "12 AM";
  if (h === 12) return "12 PM";
  return h < 12 ? `${h} AM` : `${h-12} PM`;
}
function isSameDay(a: Date, b: Date) {
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}
function startOfWeek(d: Date) {
  const s = new Date(d); s.setDate(d.getDate()-d.getDay()); s.setHours(0,0,0,0); return s;
}
function fmtTime(s: string) {
  return new Date(s).toLocaleTimeString("en-US", { hour:"numeric", minute:"2-digit", hour12:true });
}
function uid() { return Math.random().toString(36).slice(2, 10); }
function daysUntil(dateStr: string) {
  const today = new Date(); today.setHours(0,0,0,0);
  return Math.round((new Date(dateStr+"T00:00:00").getTime()-today.getTime())/86400000);
}
function minuteOf(dateStr: string) {
  const d = new Date(dateStr); return d.getHours()*60+d.getMinutes();
}
function topPx(dateStr: string) { return minuteOf(dateStr)*HOUR_PX/60; }
function heightPx(start: string, end: string) {
  const h = (minuteOf(end)-minuteOf(start))*HOUR_PX/60;
  return Math.max(h>0?h:HOUR_PX, 22);
}
function gcalColor(e: GCalEvent) {
  return e.color ? (GCAL_COLORS[e.color]??GCAL_COLORS.default) : GCAL_COLORS.default;
}
function fmtEventTime(e: GCalEvent) {
  if (e.allDay) {
    return new Date(e.start+"T00:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"});
  }
  const day = new Date(e.start).toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"});
  return `${day} · ${fmtTime(e.start)}${e.end?` – ${fmtTime(e.end)}`:""}`;
}
function dtLocal(d: Date) { return d.toISOString().slice(0,16); }

interface PositionedEvent { event: GCalEvent; col: number; numCols: number; }
function positionEvents(events: GCalEvent[]): PositionedEvent[] {
  const timed = events.filter(e => !e.allDay);
  if (!timed.length) return [];
  const sorted = [...timed].sort((a,b) => new Date(a.start).getTime()-new Date(b.start).getTime());
  const colEnds: number[] = [];
  const assigned: number[] = [];
  for (const ev of sorted) {
    const s = minuteOf(ev.start);
    const e = ev.end ? minuteOf(ev.end) : s+60;
    let col = colEnds.findIndex(end => end <= s);
    if (col === -1) col = colEnds.length;
    colEnds[col] = Math.max(e, s+15);
    assigned.push(col);
  }
  const numCols = colEnds.length || 1;
  return sorted.map((ev,i) => ({ event:ev, col:assigned[i], numCols }));
}

/* ── Event Detail ── */
function EventDetail({ event, onClose }: { event: GCalEvent; onClose: ()=>void }) {
  const color = gcalColor(event);
  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      <button onClick={onClose} style={{ display:"flex",alignItems:"center",gap:6,background:"none",border:"none",cursor:"pointer",color:"var(--t4)",fontSize:11,fontWeight:600,padding:"0 0 14px",transition:"color .15s" }}
        onMouseEnter={e=>(e.currentTarget as HTMLElement).style.color="var(--t2)"}
        onMouseLeave={e=>(e.currentTarget as HTMLElement).style.color="var(--t4)"}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        Schedule
      </button>
      <div style={{ height:3, borderRadius:2, background:color, marginBottom:16 }} />
      <h2 style={{ fontSize:17,fontWeight:800,color:"var(--t1)",lineHeight:1.3,marginBottom:14 }}>{event.title}</h2>
      <div style={{ display:"flex",alignItems:"flex-start",gap:8,marginBottom:10 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--t4)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink:0,marginTop:2 }}>
          <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
        </svg>
        <p style={{ fontSize:12,color:"var(--t2)",lineHeight:1.5 }}>{fmtEventTime(event)}</p>
      </div>
      {event.location&&(
        <div style={{ display:"flex",alignItems:"flex-start",gap:8,marginBottom:10 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--t4)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink:0,marginTop:2 }}>
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
          </svg>
          <p style={{ fontSize:12,color:"var(--t2)" }}>{event.location}</p>
        </div>
      )}
      {event.description&&(
        <div style={{ marginTop:8,marginBottom:16 }}>
          <p style={{ fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"var(--t4)",marginBottom:6 }}>Notes</p>
          <p style={{ fontSize:12,color:"var(--t3)",lineHeight:1.7,whiteSpace:"pre-wrap",maxHeight:140,overflowY:"auto" }}>{event.description}</p>
        </div>
      )}
      <div style={{ flex:1 }} />
      {event.htmlLink&&(
        <a href={event.htmlLink} target="_blank" rel="noreferrer" style={{ display:"block",padding:"10px 14px",borderRadius:8,background:"rgba(125,184,232,0.08)",border:"1px solid rgba(125,184,232,0.2)",color:"var(--blue)",fontSize:12,fontWeight:700,textDecoration:"none",textAlign:"center" }}
          onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background="rgba(125,184,232,0.15)"}
          onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background="rgba(125,184,232,0.08)"}
        >Open in Google Calendar →</a>
      )}
    </div>
  );
}

/* ── Task Detail ── */
function TaskDetail({ task, lists, onUpdate, onDelete, onBack }: {
  task: Task; lists: TaskList[];
  onUpdate: (id:string, fields:Partial<Task>)=>void;
  onDelete: (id:string)=>void;
  onBack: ()=>void;
}) {
  const [text,  setText]  = useState(task.text);
  const [desc,  setDesc]  = useState(task.description ?? "");
  const [subs,  setSubs]  = useState<Subtask[]>(task.subtasks ?? []);
  const [newSub,setNewSub]= useState("");
  const subRef = useRef<HTMLInputElement>(null);

  useEffect(()=>{ setText(task.text); setDesc(task.description??""); setSubs(task.subtasks??[]); },[task.id,task.text,task.description,task.subtasks]);

  function save(fields: Partial<Task>) { onUpdate(task.id, fields); }
  function toggleSub(id: string) { const n=subs.map(s=>s.id===id?{...s,completed:!s.completed}:s); setSubs(n); save({subtasks:n}); }
  function addSub() {
    if (!newSub.trim()) return;
    const n=[...subs,{id:uid(),text:newSub.trim(),completed:false}];
    setSubs(n); setNewSub(""); save({subtasks:n}); subRef.current?.focus();
  }
  function deleteSub(id: string) { const n=subs.filter(s=>s.id!==id); setSubs(n); save({subtasks:n}); }

  const due=task.due_date?daysUntil(task.due_date):null;
  const dueColor=due===null?"var(--t4)":due<0?"var(--red)":due<=3?"var(--amber)":"var(--t4)";

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:0,height:"100%" }}>
      <button onClick={onBack} style={{ display:"flex",alignItems:"center",gap:6,background:"none",border:"none",cursor:"pointer",color:"var(--t4)",fontSize:11,fontWeight:600,padding:"0 0 14px",transition:"color .15s" }}
        onMouseEnter={e=>(e.currentTarget as HTMLElement).style.color="var(--t2)"}
        onMouseLeave={e=>(e.currentTarget as HTMLElement).style.color="var(--t4)"}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        All Tasks
      </button>
      <input value={text} onChange={e=>setText(e.target.value)} onBlur={()=>text.trim()&&save({text:text.trim()})}
        style={{ fontSize:16,fontWeight:700,color:"var(--t1)",background:"none",border:"none",outline:"none",padding:"0 0 10px",borderBottom:"1px solid var(--border)",marginBottom:14,width:"100%" }}
      />
      <div style={{ marginBottom:12 }}>
        <p style={{ fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"var(--t4)",marginBottom:6 }}>Priority</p>
        <div style={{ display:"flex",gap:5 }}>
          {(["high","medium","low"] as const).map(p=>(
            <button key={p} onClick={()=>save({priority:p})} style={{ flex:1,padding:"7px 4px",borderRadius:6,cursor:"pointer",fontSize:11,fontWeight:600,background:task.priority===p?`${PRIO_COLOR[p]}20`:"var(--surface2)",border:`1px solid ${task.priority===p?PRIO_COLOR[p]:"var(--border2)"}`,color:task.priority===p?PRIO_COLOR[p]:"var(--t3)",textTransform:"capitalize" }}>{p}</button>
          ))}
        </div>
      </div>
      <div style={{ marginBottom:12 }}>
        <p style={{ fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"var(--t4)",marginBottom:6 }}>Due Date</p>
        <input type="date" defaultValue={task.due_date??""} onChange={e=>save({due_date:e.target.value||null})}
          style={{ width:"100%",background:"var(--surface2)",border:"1px solid var(--border2)",borderRadius:6,padding:"8px 10px",fontSize:12,color:dueColor,outline:"none",colorScheme:"dark" }}
        />
        {due!==null&&<p style={{ fontSize:10,color:dueColor,marginTop:4 }}>{due<0?`${Math.abs(due)}d overdue`:due===0?"Due today":`${due}d remaining`}</p>}
      </div>
      <div style={{ marginBottom:12 }}>
        <p style={{ fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"var(--t4)",marginBottom:6 }}>List</p>
        <select defaultValue={task.list_id??""} onChange={e=>save({list_id:e.target.value||null})}
          style={{ width:"100%",background:"var(--surface2)",border:"1px solid var(--border2)",borderRadius:6,padding:"8px 10px",fontSize:12,color:"var(--t1)",outline:"none",cursor:"pointer" }}>
          <option value="">No list</option>
          {lists.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>
      <div style={{ marginBottom:14 }}>
        <p style={{ fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"var(--t4)",marginBottom:6 }}>Notes</p>
        <textarea value={desc} onChange={e=>setDesc(e.target.value)} onBlur={()=>save({description:desc||null})}
          placeholder="Add notes…" rows={3}
          style={{ width:"100%",background:"var(--surface2)",border:"1px solid var(--border2)",borderRadius:6,padding:"8px 10px",fontSize:12,color:"var(--t1)",outline:"none",resize:"none",fontFamily:"inherit",lineHeight:1.5 }}
        />
      </div>
      <div style={{ marginBottom:14,flex:1 }}>
        <p style={{ fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"var(--t4)",marginBottom:8 }}>
          Subtasks {subs.length>0&&<span style={{ fontWeight:400 }}>({subs.filter(s=>s.completed).length}/{subs.length})</span>}
        </p>
        <div style={{ display:"flex",flexDirection:"column",gap:4,marginBottom:8,maxHeight:120,overflowY:"auto" }}>
          {subs.map(s=>(
            <div key={s.id} style={{ display:"flex",alignItems:"center",gap:7 }}>
              <button onClick={()=>toggleSub(s.id)} style={{ width:13,height:13,borderRadius:3,flexShrink:0,cursor:"pointer",background:s.completed?"rgba(34,197,94,0.15)":"transparent",border:`1px solid ${s.completed?"rgba(34,197,94,0.4)":"var(--border2)"}`,display:"flex",alignItems:"center",justifyContent:"center" }}>
                {s.completed&&<svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
              </button>
              <span style={{ flex:1,fontSize:12,color:s.completed?"var(--t4)":"var(--t2)",textDecoration:s.completed?"line-through":"none" }}>{s.text}</span>
              <button onClick={()=>deleteSub(s.id)} style={{ background:"none",border:"none",cursor:"pointer",color:"var(--t4)",padding:2 }}
                onMouseEnter={e=>(e.currentTarget as HTMLElement).style.color="var(--red)"}
                onMouseLeave={e=>(e.currentTarget as HTMLElement).style.color="var(--t4)"}
              ><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
            </div>
          ))}
        </div>
        <div style={{ display:"flex",gap:5 }}>
          <input ref={subRef} value={newSub} onChange={e=>setNewSub(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addSub()}
            placeholder="Add subtask…"
            style={{ flex:1,background:"var(--surface2)",border:"1px solid var(--border2)",borderRadius:5,padding:"6px 8px",fontSize:11,color:"var(--t1)",outline:"none" }}
          />
          <button onClick={addSub} style={{ padding:"6px 10px",borderRadius:5,background:"rgba(125,184,232,0.1)",border:"1px solid rgba(125,184,232,0.2)",color:"var(--blue)",fontSize:11,fontWeight:700,cursor:"pointer" }}>+</button>
        </div>
      </div>
      <button onClick={()=>{onDelete(task.id);onBack();}} style={{ padding:"9px",borderRadius:6,cursor:"pointer",fontSize:12,fontWeight:600,background:"rgba(239,68,68,0.06)",border:"1px solid rgba(239,68,68,0.15)",color:"var(--red)",width:"100%" }}
        onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background="rgba(239,68,68,0.12)"}
        onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background="rgba(239,68,68,0.06)"}
      >Delete Task</button>
    </div>
  );
}

/* ── Event Modal ── */
function EventModal({ state, onSave, onClose }: {
  state: ModalState;
  onSave: (e:{title:string;start:string;end:string;description:string;location:string})=>Promise<void>;
  onClose: ()=>void;
}) {
  const ds=new Date(state.date); ds.setHours(state.hour,0,0,0);
  const de=new Date(state.date); de.setHours(state.hour+1,0,0,0);
  const [title,setTitle]=useState("");
  const [start,setStart]=useState(dtLocal(ds));
  const [end,  setEnd]  =useState(dtLocal(de));
  const [desc, setDesc] =useState("");
  const [loc,  setLoc]  =useState("");
  const [saving,setSaving]=useState(false);
  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    await onSave({title:title.trim(),start,end,description:desc,location:loc});
    onClose();
  }
  return (
    <div style={{ position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center" }} onClick={onClose}>
      <div style={{ background:"var(--surface)",border:"1px solid var(--border2)",borderRadius:12,padding:24,width:420,boxShadow:"0 24px 80px rgba(0,0,0,0.6)" }} onClick={e=>e.stopPropagation()}>
        <p style={{ fontSize:11,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:"var(--t3)",marginBottom:16 }}>New Calendar Event</p>
        <input value={title} onChange={e=>setTitle(e.target.value)} onKeyDown={e=>e.key==="Enter"&&save()} placeholder="Event title…" autoFocus
          style={{ width:"100%",background:"var(--surface2)",border:"1px solid var(--border2)",borderRadius:6,padding:"10px 12px",fontSize:14,color:"var(--t1)",outline:"none",marginBottom:10 }}/>
        <div style={{ display:"flex",gap:10,marginBottom:10 }}>
          <div style={{ flex:1 }}><p style={{ fontSize:10,fontWeight:600,color:"var(--t3)",marginBottom:5 }}>Start</p><input type="datetime-local" value={start} onChange={e=>setStart(e.target.value)} style={{ width:"100%",background:"var(--surface2)",border:"1px solid var(--border2)",borderRadius:6,padding:"8px 10px",fontSize:12,color:"var(--t1)",outline:"none",colorScheme:"dark" }}/></div>
          <div style={{ flex:1 }}><p style={{ fontSize:10,fontWeight:600,color:"var(--t3)",marginBottom:5 }}>End</p><input type="datetime-local" value={end} onChange={e=>setEnd(e.target.value)} style={{ width:"100%",background:"var(--surface2)",border:"1px solid var(--border2)",borderRadius:6,padding:"8px 10px",fontSize:12,color:"var(--t1)",outline:"none",colorScheme:"dark" }}/></div>
        </div>
        <input value={loc} onChange={e=>setLoc(e.target.value)} placeholder="Location (optional)…" style={{ width:"100%",background:"var(--surface2)",border:"1px solid var(--border2)",borderRadius:6,padding:"8px 12px",fontSize:12,color:"var(--t1)",outline:"none",marginBottom:10 }}/>
        <textarea value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Description (optional)…" rows={2} style={{ width:"100%",background:"var(--surface2)",border:"1px solid var(--border2)",borderRadius:6,padding:"8px 12px",fontSize:12,color:"var(--t1)",outline:"none",resize:"none",marginBottom:14,fontFamily:"inherit" }}/>
        <div style={{ display:"flex",gap:8,justifyContent:"flex-end" }}>
          <button onClick={onClose} style={{ padding:"8px 14px",borderRadius:6,cursor:"pointer",fontSize:12,background:"transparent",border:"1px solid var(--border2)",color:"var(--t3)" }}>Cancel</button>
          <button onClick={save} disabled={saving||!title.trim()} style={{ padding:"8px 16px",borderRadius:6,cursor:"pointer",fontSize:12,fontWeight:700,background:"rgba(34,197,94,0.1)",border:"1px solid rgba(34,197,94,0.25)",color:"var(--green)",opacity:saving?0.6:1 }}>{saving?"Saving…":"Add to Calendar"}</button>
        </div>
      </div>
    </div>
  );
}

/* ── NL Preview Modal ── */
function NLConfirm({ preview, onConfirm, onCancel }: {
  preview: NLPreview;
  onConfirm: ()=>void;
  onCancel: ()=>void;
}) {
  const start = new Date(preview.start);
  const end   = new Date(preview.end);
  const dayStr = start.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"});
  const timeStr = `${fmtTime(preview.start)} – ${fmtTime(preview.end)}`;
  return (
    <div style={{ marginTop:8,background:"var(--surface2)",border:"1px solid rgba(125,184,232,0.3)",borderRadius:10,padding:14 }}>
      <p style={{ fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"var(--blue)",marginBottom:8 }}>Preview</p>
      <p style={{ fontSize:14,fontWeight:700,color:"var(--t1)",marginBottom:4 }}>{preview.title}</p>
      <p style={{ fontSize:12,color:"var(--t2)",marginBottom:2 }}>{dayStr}</p>
      <p style={{ fontSize:12,color:"var(--t3)",marginBottom:preview.location?4:0 }}>{timeStr}</p>
      {preview.location&&<p style={{ fontSize:11,color:"var(--t3)" }}>📍 {preview.location}</p>}
      <div style={{ display:"flex",gap:8,marginTop:12 }}>
        <button onClick={onConfirm} style={{ flex:1,padding:"8px",borderRadius:7,cursor:"pointer",fontSize:12,fontWeight:700,background:"rgba(34,197,94,0.12)",border:"1px solid rgba(34,197,94,0.3)",color:"var(--green)" }}>Create Event</button>
        <button onClick={onCancel} style={{ padding:"8px 14px",borderRadius:7,cursor:"pointer",fontSize:12,background:"transparent",border:"1px solid var(--border2)",color:"var(--t3)" }}>Cancel</button>
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function CalendarPage() {
  const [view,          setView]         = useState<CalView>("week");
  const [cursor,        setCursor]       = useState(new Date());
  const [tasks,         setTasks]        = useState<Task[]>([]);
  const [lists,         setLists]        = useState<TaskList[]>([]);
  const [gcalEvents,    setGcalEvents]   = useState<GCalEvent[]>([]);
  const [gcalConnected, setGcalConn]     = useState(false);
  const [loadingCal,    setLoadingCal]   = useState(true);
  const [selectedTask,  setSelectedTask] = useState<Task|null>(null);
  const [selectedEvent, setSelectedEvent]= useState<GCalEvent|null>(null);
  const [activeListId,  setActiveListId] = useState<string|null>(null);
  const [modalState,    setModalState]   = useState<ModalState|null>(null);
  const [newTaskText,   setNewTaskText]  = useState("");
  const [addingTask,    setAddingTask]   = useState(false);
  const [newListMode,   setNewListMode]  = useState(false);
  const [newListName,   setNewListName]  = useState("");
  const [nlInput,       setNlInput]      = useState("");
  const [nlLoading,     setNlLoading]    = useState(false);
  const [nlPreview,     setNlPreview]    = useState<NLPreview|null>(null);
  const [nlError,       setNlError]      = useState("");
  const [showTasks,     setShowTasks]    = useState(true);

  const gridRef = useRef<HTMLDivElement>(null);
  const today   = new Date();

  /* ── Data loading ── */
  useEffect(() => {
    supabase.from("settings").select("value").eq("key","preferences").single().then(({data})=>{
      if (data?.value) {
        const prefs = data.value as { calendar_default_view?: string; tasks_in_calendar?: boolean };
        const v = prefs.calendar_default_view;
        if (v === "day" || v === "week" || v === "month") setView(v);
        if (prefs.tasks_in_calendar === false) setShowTasks(false);
      }
    });
    supabase.from("tasks").select("*").order("created_at").then(({data})=>{ if(data) setTasks(data as Task[]); });
    supabase.from("task_lists").select("*").order("position").then(async ({data})=>{
      if (data && data.length>0) { setLists(data as TaskList[]); return; }
      const rows = DEFAULT_LISTS.map((l,i)=>({...l,position:i}));
      const {data:seeded} = await supabase.from("task_lists").insert(rows).select();
      if (seeded) setLists(seeded as TaskList[]);
    });
  }, []);

  useEffect(()=>{
    setLoadingCal(true);
    const start=new Date(); start.setMonth(start.getMonth()-1);
    const end=new Date();   end.setMonth(end.getMonth()+3);
    fetch(`/api/google/calendar?timeMin=${start.toISOString()}&timeMax=${end.toISOString()}`)
      .then(r=>r.json()).then(d=>{ setGcalConn(d.connected??false); setGcalEvents(d.events??[]); })
      .catch(()=>setGcalConn(false)).finally(()=>setLoadingCal(false));
  }, []);

  /* Auto-scroll to current hour */
  useEffect(()=>{
    if (!gridRef.current) return;
    const h = Math.max(today.getHours()-1, 7);
    gridRef.current.scrollTop = h*HOUR_PX;
  }, [view]);

  /* ── Task ops ── */
  async function addTask() {
    const text=newTaskText.trim(); if (!text) return;
    setNewTaskText(""); setAddingTask(false);
    const {data}=await supabase.from("tasks").insert({text,completed:false,priority:"medium",list_id:activeListId,subtasks:[]}).select().single();
    if (data) setTasks(prev=>[...prev, data as Task]);
  }
  const updateTask = useCallback(async (id: string, fields: Partial<Task>)=>{
    setTasks(prev=>prev.map(t=>t.id===id?{...t,...fields}:t));
    if (selectedTask?.id===id) setSelectedTask(prev=>prev?{...prev,...fields}:prev);
    await supabase.from("tasks").update(fields).eq("id",id);
  },[selectedTask?.id]);
  async function toggleTask(id: string, completed: boolean) { await updateTask(id,{completed:!completed}); }
  async function deleteTask(id: string) {
    setTasks(prev=>prev.filter(t=>t.id!==id));
    if (selectedTask?.id===id) setSelectedTask(null);
    await supabase.from("tasks").delete().eq("id",id);
  }
  async function createList() {
    const name=newListName.trim(); if (!name) return;
    const color=LIST_PALETTE[lists.length%LIST_PALETTE.length];
    const {data}=await supabase.from("task_lists").insert({name,color,position:lists.length}).select().single();
    if (data) { setLists(prev=>[...prev,data as TaskList]); setActiveListId(data.id); }
    setNewListMode(false); setNewListName("");
  }
  async function deleteList(id: string) {
    await supabase.from("task_lists").delete().eq("id",id);
    await supabase.from("tasks").update({list_id:null}).eq("list_id",id);
    setLists(prev=>prev.filter(l=>l.id!==id));
    if (activeListId===id) setActiveListId(null);
    setTasks(prev=>prev.map(t=>t.list_id===id?{...t,list_id:null}:t));
  }

  /* ── Google Calendar ── */
  async function createGcalEvent(fields:{title:string;start:string;end:string;description:string;location:string}) {
    const res  = await fetch("/api/google/calendar",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...fields,timeZone:"America/New_York"})});
    const data = await res.json();
    if (data.success&&data.event) {
      const e=data.event;
      setGcalEvents(prev=>[...prev,{id:e.id,title:e.summary??fields.title,description:e.description??"",location:e.location??"",start:e.start?.dateTime??e.start?.date??fields.start,end:e.end?.dateTime??e.end?.date??fields.end,allDay:!e.start?.dateTime,color:null,htmlLink:e.htmlLink??"",status:"confirmed"}]);
    }
  }

  /* ── NL event parsing ── */
  async function parseNL() {
    if (!nlInput.trim()) return;
    setNlLoading(true); setNlPreview(null); setNlError("");
    try {
      const now = new Date().toLocaleString("en-US",{timeZone:"America/New_York",weekday:"long",year:"numeric",month:"long",day:"numeric",hour:"numeric",minute:"2-digit"});
      const res = await fetch("/api/calendar/nl",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:nlInput,now})});
      const data = await res.json();
      if (data.error) { setNlError("Couldn't parse — try being more specific."); }
      else { setNlPreview(data as NLPreview); }
    } catch { setNlError("Request failed."); }
    finally { setNlLoading(false); }
  }
  async function confirmNL() {
    if (!nlPreview) return;
    await createGcalEvent({title:nlPreview.title,start:nlPreview.start,end:nlPreview.end,description:nlPreview.description??"",location:nlPreview.location??""});
    setNlInput(""); setNlPreview(null); setNlError("");
  }

  /* ── Navigation ── */
  function nav(dir: -1|1) {
    const d=new Date(cursor);
    if (view==="day")   d.setDate(d.getDate()+dir);
    if (view==="week")  d.setDate(d.getDate()+dir*7);
    if (view==="month") d.setMonth(d.getMonth()+dir);
    setCursor(d);
  }
  function navLabel() {
    if (view==="day") return cursor.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"});
    if (view==="week") {
      const ws=startOfWeek(cursor); const we=new Date(ws); we.setDate(ws.getDate()+6);
      return `${ws.toLocaleDateString("en-US",{month:"short",day:"numeric"})} – ${we.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}`;
    }
    return `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
  }

  /* ── Calendar data helpers ── */
  const weekDays = Array.from({length:7},(_,i)=>{ const d=new Date(startOfWeek(cursor)); d.setDate(d.getDate()+i); return d; });
  function monthGrid() {
    const first=new Date(cursor.getFullYear(),cursor.getMonth(),1);
    const last =new Date(cursor.getFullYear(),cursor.getMonth()+1,0);
    const cells:(Date|null)[]=[]; for(let i=0;i<first.getDay();i++)cells.push(null); for(let d=1;d<=last.getDate();d++)cells.push(new Date(cursor.getFullYear(),cursor.getMonth(),d)); while(cells.length%7!==0)cells.push(null); return cells;
  }
  function tasksForDay(d: Date)  { return showTasks ? tasks.filter(t=>t.due_date&&isSameDay(new Date(t.due_date+"T00:00:00"),d)&&!t.completed) : []; }
  function eventsForDay(d: Date) { return gcalEvents.filter(e=>{ const s=new Date(e.allDay?e.start+"T00:00:00":e.start); return isSameDay(s,d); }); }
  function allDayForDay(d: Date) { return gcalEvents.filter(e=>e.allDay&&isSameDay(new Date(e.start+"T00:00:00"),d)); }

  /* ── Filtered tasks ── */
  const filteredTasks = tasks.filter(t=>activeListId?t.list_id===activeListId:true);
  const openTasks  = filteredTasks.filter(t=>!t.completed);
  const doneTasks  = filteredTasks.filter(t=>t.completed);
  const activeList = lists.find(l=>l.id===activeListId);

  /* ── Click on time slot ── */
  function handleTimeClick(date: Date, hour: number) {
    if (!gcalConnected) return;
    setCursor(date);
    setModalState({date,hour});
  }

  const currentMinutes = today.getHours()*60+today.getMinutes();

  /* ── Render ── */
  return (
    <div style={{ padding:"28px 36px", background:"var(--bg)", minHeight:"100vh" }}>

      {/* Google banner */}
      {!loadingCal&&!gcalConnected&&(
        <div style={{ marginBottom:20,padding:"12px 18px",borderRadius:10,background:"rgba(125,184,232,0.06)",border:"1px solid rgba(125,184,232,0.18)",display:"flex",alignItems:"center",gap:14 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <p style={{ fontSize:12,color:"var(--t2)",flex:1 }}>Connect Google Calendar to sync events and create directly from M.A.X.</p>
          <a href="/api/auth/google" style={{ padding:"7px 16px",borderRadius:7,background:"rgba(125,184,232,0.12)",border:"1px solid rgba(125,184,232,0.3)",color:"var(--blue)",fontSize:12,fontWeight:700,textDecoration:"none" }}>Connect Google</a>
        </div>
      )}
      {gcalConnected&&(
        <div style={{ marginBottom:16,padding:"8px 14px",borderRadius:8,background:"rgba(34,197,94,0.04)",border:"1px solid rgba(34,197,94,0.15)",display:"flex",alignItems:"center",gap:8 }}>
          <span style={{ width:5,height:5,borderRadius:"50%",background:"var(--green)",display:"inline-block" }}/>
          <p style={{ fontSize:11,color:"var(--green)",fontWeight:600 }}>Google Calendar · {gcalEvents.length} events synced</p>
        </div>
      )}

      {/* Header */}
      <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:16 }}>
        <div>
          <p style={{ fontSize:11,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:"var(--t3)",marginBottom:6 }}>Schedule & Tasks</p>
          <h1 style={{ fontSize:26,fontWeight:800,color:"var(--t1)",letterSpacing:"-0.02em" }}>{navLabel()}</h1>
        </div>
        <div style={{ display:"flex",alignItems:"center",gap:8 }}>
          <div style={{ display:"flex",background:"var(--surface)",border:"1px solid var(--border)",borderRadius:8,padding:3,gap:2 }}>
            {(["day","week","month"] as CalView[]).map(v=>(
              <button key={v} onClick={()=>setView(v)} style={{ padding:"6px 14px",borderRadius:6,cursor:"pointer",fontSize:12,fontWeight:600,background:view===v?"rgba(125,184,232,0.15)":"transparent",border:`1px solid ${view===v?"rgba(125,184,232,0.3)":"transparent"}`,color:view===v?"var(--blue)":"var(--t3)",transition:"all .15s",textTransform:"capitalize" }}>{v}</button>
            ))}
          </div>
          <div style={{ display:"flex",gap:4 }}>
            {([-1,1] as const).map(dir=>(
              <button key={dir} onClick={()=>nav(dir)} style={{ width:32,height:32,borderRadius:6,cursor:"pointer",background:"var(--surface)",border:"1px solid var(--border)",color:"var(--t2)",display:"flex",alignItems:"center",justifyContent:"center" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d={dir===-1?"M15 18l-6-6 6-6":"M9 18l6-6-6-6"}/></svg>
              </button>
            ))}
            <button onClick={()=>setCursor(new Date())} style={{ padding:"6px 12px",borderRadius:6,cursor:"pointer",fontSize:11,fontWeight:700,background:"var(--surface)",border:"1px solid var(--border)",color:"var(--t3)" }}>Today</button>
          </div>
          {gcalConnected&&(
            <button onClick={()=>setModalState({date:cursor,hour:9})} style={{ display:"flex",alignItems:"center",gap:6,padding:"8px 14px",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:700,background:"rgba(34,197,94,0.08)",border:"1px solid rgba(34,197,94,0.2)",color:"var(--green)" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>Event
            </button>
          )}
          <button onClick={()=>{setSelectedTask(null);setSelectedEvent(null);setAddingTask(true);}} style={{ display:"flex",alignItems:"center",gap:6,padding:"8px 14px",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:700,background:"rgba(125,184,232,0.1)",border:"1px solid rgba(125,184,232,0.25)",color:"var(--blue)" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>Task
          </button>
        </div>
      </div>

      {/* NL Bar */}
      {gcalConnected&&(
        <div style={{ marginBottom:16 }}>
          <div style={{ display:"flex",gap:8 }}>
            <div style={{ flex:1,position:"relative" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--t4)" strokeWidth="2" strokeLinecap="round" style={{ position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",pointerEvents:"none" }}>
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              <input value={nlInput} onChange={e=>setNlInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&parseNL()}
                placeholder={`Add event in plain English — "team standup tomorrow 9am" or "dinner Friday 7pm"`}
                style={{ width:"100%",background:"var(--surface)",border:"1px solid var(--border)",borderRadius:8,padding:"10px 12px 10px 36px",fontSize:12,color:"var(--t1)",outline:"none" }}
              />
            </div>
            <button onClick={parseNL} disabled={nlLoading||!nlInput.trim()} style={{ padding:"10px 18px",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:700,background:"rgba(125,184,232,0.1)",border:"1px solid rgba(125,184,232,0.25)",color:"var(--blue)",opacity:nlLoading?0.5:1 }}>
              {nlLoading?"…":"Parse"}
            </button>
          </div>
          {nlError&&<p style={{ fontSize:11,color:"var(--red)",marginTop:6 }}>{nlError}</p>}
          {nlPreview&&<NLConfirm preview={nlPreview} onConfirm={confirmNL} onCancel={()=>{setNlPreview(null);setNlInput("");}}/>}
        </div>
      )}

      <div style={{ display:"grid",gridTemplateColumns:"1fr 316px",gap:16,alignItems:"start" }}>

        {/* ── Calendar Panel ── */}
        <div>

          {/* ── DAY VIEW ── */}
          {view==="day"&&(
            <HudCard style={{ padding:0,overflow:"hidden" }}>
              {/* Day header */}
              <div style={{ display:"flex",alignItems:"center",padding:"14px 20px",borderBottom:"1px solid var(--border)" }}>
                <div style={{ width:TIME_W,flexShrink:0 }}/>
                <div style={{ flex:1 }}>
                  <p style={{ fontSize:13,fontWeight:700,color:isSameDay(cursor,today)?"var(--blue)":"var(--t1)" }}>{DAYS_FULL[cursor.getDay()]}</p>
                  <p style={{ fontSize:28,fontWeight:900,color:"var(--t1)",lineHeight:1 }}>{cursor.getDate()}</p>
                </div>
              </div>
              {/* All-day / tasks row */}
              {(allDayForDay(cursor).length>0||tasksForDay(cursor).length>0)&&(
                <div style={{ display:"flex",borderBottom:"1px solid var(--border)",padding:"6px 0" }}>
                  <div style={{ width:TIME_W,flexShrink:0,padding:"4px 8px 0",textAlign:"right" }}>
                    <span style={{ fontSize:9,color:"var(--t4)" }}>Tasks</span>
                  </div>
                  <div style={{ flex:1,display:"flex",flexWrap:"wrap",gap:3,padding:"4px 8px" }}>
                    {allDayForDay(cursor).map(e=>{
                      const c=gcalColor(e);
                      return <span key={e.id} onClick={()=>{setSelectedEvent(e);setSelectedTask(null);}} style={{ padding:"2px 8px",borderRadius:3,fontSize:10,fontWeight:600,cursor:"pointer",background:`${c}20`,border:`1px solid ${c}40`,color:c }}>{e.title}</span>;
                    })}
                    {tasksForDay(cursor).map(t=>(
                      <span key={t.id} onClick={()=>{setSelectedTask(t);setSelectedEvent(null);}} style={{ padding:"2px 8px",borderRadius:3,fontSize:10,fontWeight:600,cursor:"pointer",background:`${PRIO_COLOR[t.priority??"medium"]}15`,border:`1px solid ${PRIO_COLOR[t.priority??"medium"]}30`,color:PRIO_COLOR[t.priority??"medium"] }}>
                        ◎ {t.text}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {/* Time grid */}
              <div ref={gridRef} style={{ maxHeight:560,overflowY:"auto" }}>
                <div style={{ display:"flex",position:"relative",height:24*HOUR_PX }}>
                  {/* Hour labels */}
                  <div style={{ width:TIME_W,flexShrink:0 }}>
                    {HOURS.map(h=>(
                      <div key={h} style={{ height:HOUR_PX,borderTop:h>0?"1px solid var(--border)":undefined,padding:"4px 8px 0",display:"flex",justifyContent:"flex-end",alignItems:"flex-start" }}>
                        {h>0&&<span style={{ fontSize:9,color:"var(--t4)",fontFamily:"monospace" }}>{fmtHour(h)}</span>}
                      </div>
                    ))}
                  </div>
                  {/* Events area */}
                  <div style={{ flex:1,position:"relative",borderLeft:"1px solid var(--border)" }}>
                    {/* Click targets */}
                    {HOURS.map(h=>(
                      <div key={h} style={{ height:HOUR_PX,borderTop:h>0?"1px solid var(--border)":undefined,cursor:gcalConnected?"pointer":"default" }}
                        onClick={()=>handleTimeClick(cursor,h)}
                      />
                    ))}
                    {/* Events */}
                    {positionEvents(eventsForDay(cursor)).map(({event,col,numCols})=>{
                      const color=gcalColor(event);
                      const pct=100/numCols;
                      const h=heightPx(event.start,event.end);
                      return (
                        <div key={event.id} onClick={()=>{setSelectedEvent(event);setSelectedTask(null);}} style={{
                          position:"absolute",top:topPx(event.start),height:h,
                          left:`calc(${col*pct}% + 2px)`,width:`calc(${pct}% - 4px)`,
                          background:`${color}20`,borderLeft:`2px solid ${color}`,borderRadius:4,
                          padding:"3px 6px",cursor:"pointer",overflow:"hidden",zIndex:2,
                        }}>
                          <p style={{ fontSize:10,fontWeight:700,color,lineHeight:1.3,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:h>35?2:1,WebkitBoxOrient:"vertical" as const }}>{event.title}</p>
                          {h>42&&<p style={{ fontSize:9,color:`${color}b0`,marginTop:1 }}>{fmtTime(event.start)} – {fmtTime(event.end)}</p>}
                        </div>
                      );
                    })}
                    {/* Current time */}
                    {isSameDay(cursor,today)&&(
                      <div style={{ position:"absolute",top:currentMinutes*HOUR_PX/60,left:0,right:0,height:2,background:"var(--red)",zIndex:5,boxShadow:"0 0 6px rgba(239,68,68,0.5)" }}>
                        <div style={{ position:"absolute",width:8,height:8,borderRadius:"50%",background:"var(--red)",top:-3,left:-4 }}/>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </HudCard>
          )}

          {/* ── WEEK VIEW ── */}
          {view==="week"&&(
            <HudCard style={{ padding:0,overflow:"hidden" }}>
              {/* Day headers */}
              <div style={{ display:"grid",gridTemplateColumns:`${TIME_W}px repeat(7,1fr)`,borderBottom:"1px solid var(--border)" }}>
                <div/>
                {weekDays.map((d,i)=>(
                  <div key={i} style={{ padding:"10px 4px",textAlign:"center",borderLeft:"1px solid var(--border)",background:isSameDay(d,today)?"rgba(125,184,232,0.04)":undefined }}>
                    <p style={{ fontSize:10,fontWeight:600,color:"var(--t3)",marginBottom:3 }}>{DAYS_SHORT[d.getDay()]}</p>
                    <div style={{ width:26,height:26,borderRadius:"50%",margin:"0 auto",background:isSameDay(d,today)?"var(--blue)":"transparent",display:"flex",alignItems:"center",justifyContent:"center" }}>
                      <p style={{ fontSize:12,fontWeight:700,color:isSameDay(d,today)?"#fff":"var(--t1)" }}>{d.getDate()}</p>
                    </div>
                  </div>
                ))}
              </div>
              {/* All-day / tasks row */}
              <div style={{ display:"grid",gridTemplateColumns:`${TIME_W}px repeat(7,1fr)`,borderBottom:"1px solid var(--border)",minHeight:24 }}>
                <div style={{ padding:"4px 4px 0",textAlign:"right" }}><span style={{ fontSize:9,color:"var(--t4)" }}>Tasks</span></div>
                {weekDays.map((d,i)=>{
                  const dt=tasksForDay(d); const de=allDayForDay(d);
                  return (
                    <div key={i} style={{ borderLeft:"1px solid var(--border)",padding:"2px 2px",minHeight:24,display:"flex",flexWrap:"wrap",gap:2,alignContent:"flex-start" }}>
                      {de.map(e=>{const c=gcalColor(e);return<span key={e.id} onClick={()=>{setSelectedEvent(e);setSelectedTask(null);}} style={{ display:"block",width:"100%",padding:"1px 4px",borderRadius:2,fontSize:8,fontWeight:600,cursor:"pointer",background:`${c}20`,color:c,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{e.title}</span>;})}
                      {dt.slice(0,2).map(t=><span key={t.id} onClick={()=>{setSelectedTask(t);setSelectedEvent(null);}} style={{ display:"block",width:"100%",padding:"1px 4px",borderRadius:2,fontSize:8,fontWeight:600,cursor:"pointer",background:`${PRIO_COLOR[t.priority??"medium"]}15`,color:PRIO_COLOR[t.priority??"medium"],overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>◎ {t.text}</span>)}
                      {dt.length>2&&<span style={{ fontSize:7,color:"var(--t4)",padding:"0 2px" }}>+{dt.length-2}</span>}
                    </div>
                  );
                })}
              </div>
              {/* Time grid */}
              <div ref={gridRef} style={{ maxHeight:520,overflowY:"auto" }}>
                <div style={{ display:"grid",gridTemplateColumns:`${TIME_W}px repeat(7,1fr)`,height:24*HOUR_PX }}>
                  {/* Hour labels */}
                  <div>
                    {HOURS.map(h=>(
                      <div key={h} style={{ height:HOUR_PX,borderTop:h>0?"1px solid var(--border)":undefined,padding:"4px 6px 0",display:"flex",justifyContent:"flex-end",alignItems:"flex-start" }}>
                        {h>0&&<span style={{ fontSize:9,color:"var(--t4)",fontFamily:"monospace" }}>{fmtHour(h)}</span>}
                      </div>
                    ))}
                  </div>
                  {/* Day columns */}
                  {weekDays.map((day,dayIdx)=>{
                    const positioned=positionEvents(eventsForDay(day));
                    const isToday=isSameDay(day,today);
                    return (
                      <div key={dayIdx} style={{ position:"relative",borderLeft:"1px solid var(--border)",background:isToday?"rgba(125,184,232,0.02)":undefined }}>
                        {/* Hour click targets */}
                        {HOURS.map(h=>(
                          <div key={h} style={{ height:HOUR_PX,borderTop:h>0?"1px solid rgba(30,37,48,0.7)":undefined,cursor:gcalConnected?"pointer":"default" }}
                            onClick={()=>handleTimeClick(day,h)}
                          />
                        ))}
                        {/* Events */}
                        {positioned.map(({event,col,numCols})=>{
                          const color=gcalColor(event);
                          const pct=100/numCols;
                          const h=heightPx(event.start,event.end);
                          return (
                            <div key={event.id} onClick={(e)=>{e.stopPropagation();setSelectedEvent(event);setSelectedTask(null);}} style={{
                              position:"absolute",top:topPx(event.start),height:h,
                              left:`calc(${col*pct}% + 1px)`,width:`calc(${pct}% - 2px)`,
                              background:`${color}20`,borderLeft:`2px solid ${color}`,borderRadius:3,
                              padding:"2px 4px",cursor:"pointer",overflow:"hidden",zIndex:2,
                            }}>
                              <p style={{ fontSize:9,fontWeight:700,color,lineHeight:1.2,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:h>28?2:1,WebkitBoxOrient:"vertical" as const }}>{event.title}</p>
                            </div>
                          );
                        })}
                        {/* Current time line */}
                        {isToday&&(
                          <div style={{ position:"absolute",top:currentMinutes*HOUR_PX/60,left:0,right:0,height:2,background:"var(--red)",zIndex:5,boxShadow:"0 0 4px rgba(239,68,68,0.4)" }}>
                            <div style={{ position:"absolute",width:7,height:7,borderRadius:"50%",background:"var(--red)",top:-2.5,left:-3.5 }}/>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </HudCard>
          )}

          {/* ── MONTH VIEW ── */}
          {view==="month"&&(
            <HudCard style={{ padding:16 }}>
              {/* Day labels */}
              <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",marginBottom:4 }}>
                {DAYS_SHORT.map(d=><div key={d} style={{ padding:"4px 0",textAlign:"center",fontSize:10,fontWeight:700,color:"var(--t3)",letterSpacing:"0.08em" }}>{d}</div>)}
              </div>
              {/* Month grid */}
              <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2 }}>
                {monthGrid().map((d,i)=>{
                  if (!d) return <div key={i}/>;
                  const isT=isSameDay(d,today);
                  const de=eventsForDay(d).filter(e=>!e.allDay);
                  const da=allDayForDay(d);
                  const dt=tasksForDay(d);
                  const all=[...da,...de];
                  const showItems=all.slice(0,2);
                  const overflow=all.length+dt.length-2;
                  return (
                    <div key={i} onClick={()=>{setCursor(d);setView("day");}} style={{ minHeight:88,padding:"6px 6px",borderRadius:6,background:isT?"rgba(125,184,232,0.07)":"var(--surface)",border:`1px solid ${isT?"rgba(125,184,232,0.25)":"var(--border)"}`,cursor:"pointer",transition:"border-color .12s" }}
                      onMouseEnter={e=>!isT&&((e.currentTarget as HTMLElement).style.borderColor="rgba(255,255,255,0.1)")}
                      onMouseLeave={e=>!isT&&((e.currentTarget as HTMLElement).style.borderColor="var(--border)")}
                    >
                      <div style={{ width:22,height:22,borderRadius:"50%",marginBottom:4,background:isT?"var(--blue)":"transparent",display:"flex",alignItems:"center",justifyContent:"center" }}>
                        <span style={{ fontSize:11,fontWeight:isT?800:500,color:isT?"#fff":"var(--t2)" }}>{d.getDate()}</span>
                      </div>
                      <div style={{ display:"flex",flexDirection:"column",gap:2 }}>
                        {showItems.map(e=>{
                          const isAllDay=(e as GCalEvent).allDay!==undefined;
                          if (!isAllDay) return null;
                          const gcal=e as GCalEvent;
                          const color=gcalColor(gcal);
                          return <a key={gcal.id} href={gcal.htmlLink} target="_blank" rel="noreferrer" onClick={ev=>{ev.stopPropagation();setSelectedEvent(gcal);setSelectedTask(null);}} style={{ display:"block",padding:"2px 4px",borderRadius:3,fontSize:8,fontWeight:600,textDecoration:"none",background:`${color}15`,color,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{gcal.title}</a>;
                        })}
                        {de.slice(0,2).map(e=>{const color=gcalColor(e);return<div key={e.id} onClick={ev=>{ev.stopPropagation();setSelectedEvent(e);setSelectedTask(null);}} style={{ padding:"2px 4px",borderRadius:3,fontSize:8,fontWeight:600,cursor:"pointer",background:`${color}15`,color,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{e.title}</div>;})}
                        {dt.slice(0,1).map(t=><div key={t.id} onClick={ev=>{ev.stopPropagation();setSelectedTask(t);setSelectedEvent(null);}} style={{ padding:"2px 4px",borderRadius:3,fontSize:8,fontWeight:600,cursor:"pointer",background:`${PRIO_COLOR[t.priority??"medium"]}15`,color:PRIO_COLOR[t.priority??"medium"],overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>◎ {t.text}</div>)}
                        {overflow>0&&<span style={{ fontSize:8,color:"var(--t4)",paddingLeft:2 }}>+{overflow} more</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </HudCard>
          )}
        </div>

        {/* ── Right Panel ── */}
        <div style={{ display:"flex",flexDirection:"column",gap:12 }}>

          {/* Stats */}
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
            {[
              {label:"Open",     value:tasks.filter(t=>!t.completed).length,                                                   color:"var(--blue)"},
              {label:"Done",     value:tasks.filter(t=>t.completed).length,                                                    color:"var(--green)"},
              {label:"High",     value:tasks.filter(t=>!t.completed&&t.priority==="high").length,                              color:"var(--red)"},
              {label:"Due Soon", value:tasks.filter(t=>!t.completed&&t.due_date&&daysUntil(t.due_date)<=3&&daysUntil(t.due_date)>=0).length, color:"var(--amber)"},
            ].map(s=>(
              <HudCard key={s.label} style={{ padding:"12px 14px" }}>
                <p style={{ fontSize:20,fontWeight:800,color:s.color,fontFamily:"monospace" }}>{s.value}</p>
                <p style={{ fontSize:10,color:"var(--t3)",fontWeight:600,marginTop:2 }}>{s.label}</p>
              </HudCard>
            ))}
          </div>

          {/* Main card */}
          <HudCard style={{ padding:"16px",flex:1 }}>
            {selectedEvent ? (
              <EventDetail event={selectedEvent} onClose={()=>setSelectedEvent(null)} />
            ) : selectedTask ? (
              <TaskDetail task={selectedTask} lists={lists} onUpdate={updateTask} onDelete={deleteTask} onBack={()=>setSelectedTask(null)} />
            ) : (
              <>
                {/* List tabs */}
                <div style={{ marginBottom:12 }}>
                  <div style={{ display:"flex",flexWrap:"wrap",gap:5,marginBottom:8 }}>
                    <button onClick={()=>setActiveListId(null)} style={{ padding:"5px 11px",borderRadius:20,fontSize:11,fontWeight:600,cursor:"pointer",background:activeListId===null?"rgba(125,184,232,0.15)":"transparent",border:`1px solid ${activeListId===null?"rgba(125,184,232,0.35)":"var(--border2)"}`,color:activeListId===null?"var(--blue)":"var(--t3)" }}>All</button>
                    {lists.map(l=>(
                      <button key={l.id} onClick={()=>setActiveListId(l.id)} style={{ padding:"5px 11px",borderRadius:20,fontSize:11,fontWeight:600,cursor:"pointer",background:activeListId===l.id?`${l.color}20`:"transparent",border:`1px solid ${activeListId===l.id?l.color:"var(--border2)"}`,color:activeListId===l.id?l.color:"var(--t3)" }}>{l.name}</button>
                    ))}
                    <button onClick={()=>setNewListMode(true)} style={{ padding:"5px 9px",borderRadius:20,fontSize:11,cursor:"pointer",background:"transparent",border:"1px dashed var(--border2)",color:"var(--t4)" }}
                      onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.color="var(--t2)";}}
                      onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.color="var(--t4)";}}
                    >+</button>
                  </div>
                  {newListMode&&(
                    <div style={{ display:"flex",gap:5,marginBottom:8 }}>
                      <input autoFocus value={newListName} onChange={e=>setNewListName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")createList();if(e.key==="Escape"){setNewListMode(false);setNewListName("");}}} placeholder="List name…" style={{ flex:1,background:"var(--surface2)",border:"1px solid var(--border2)",borderRadius:6,padding:"6px 10px",fontSize:12,color:"var(--t1)",outline:"none" }}/>
                      <button onClick={createList} style={{ padding:"6px 12px",borderRadius:6,background:"rgba(125,184,232,0.1)",border:"1px solid rgba(125,184,232,0.2)",color:"var(--blue)",fontSize:12,fontWeight:700,cursor:"pointer" }}>Add</button>
                      <button onClick={()=>{setNewListMode(false);setNewListName("");}} style={{ padding:"6px 10px",borderRadius:6,background:"transparent",border:"1px solid var(--border2)",color:"var(--t3)",fontSize:12,cursor:"pointer" }}>✕</button>
                    </div>
                  )}
                  {activeListId&&activeList&&(
                    <button onClick={()=>deleteList(activeListId)} style={{ fontSize:10,color:"var(--t4)",background:"none",border:"none",cursor:"pointer",padding:"0 0 4px" }}
                      onMouseEnter={e=>(e.currentTarget as HTMLElement).style.color="var(--red)"}
                      onMouseLeave={e=>(e.currentTarget as HTMLElement).style.color="var(--t4)"}
                    >Delete &ldquo;{activeList.name}&rdquo;</button>
                  )}
                </div>

                {/* Add task */}
                {addingTask ? (
                  <div style={{ display:"flex",gap:5,marginBottom:10 }}>
                    <input autoFocus value={newTaskText} onChange={e=>setNewTaskText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")addTask();if(e.key==="Escape"){setAddingTask(false);setNewTaskText("");}}} placeholder="Task name…" style={{ flex:1,background:"var(--surface2)",border:"1px solid rgba(125,184,232,0.35)",borderRadius:6,padding:"8px 10px",fontSize:13,color:"var(--t1)",outline:"none" }}/>
                    <button onClick={addTask} style={{ padding:"8px 14px",borderRadius:6,background:"rgba(125,184,232,0.15)",border:"1px solid rgba(125,184,232,0.3)",color:"var(--blue)",fontSize:12,fontWeight:700,cursor:"pointer" }}>Add</button>
                    <button onClick={()=>{setAddingTask(false);setNewTaskText("");}} style={{ padding:"8px 10px",borderRadius:6,background:"transparent",border:"1px solid var(--border2)",color:"var(--t3)",fontSize:12,cursor:"pointer" }}>✕</button>
                  </div>
                ) : (
                  <button onClick={()=>setAddingTask(true)} style={{ width:"100%",padding:"8px",borderRadius:6,marginBottom:10,background:"transparent",border:"1px dashed var(--border2)",color:"var(--t4)",fontSize:12,cursor:"pointer",textAlign:"left" }}
                    onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor=activeList?.color??"var(--blue)";(e.currentTarget as HTMLElement).style.color="var(--t2)";}}
                    onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor="var(--border2)";(e.currentTarget as HTMLElement).style.color="var(--t4)";}}
                  >+ Add task{activeList?` to ${activeList.name}`:""}…</button>
                )}

                {/* Open tasks */}
                <div style={{ display:"flex",flexDirection:"column",gap:3,maxHeight:280,overflowY:"auto",marginBottom:8 }}>
                  {openTasks.length===0&&<p style={{ fontSize:12,color:"var(--t4)",textAlign:"center",padding:"20px 0" }}>All clear{activeList?` in ${activeList.name}`:""}.</p>}
                  {openTasks.map(t=>{
                    const listColor=lists.find(l=>l.id===t.list_id)?.color??"var(--border2)";
                    const due=t.due_date?daysUntil(t.due_date):null;
                    const dueColor=due===null?"var(--t4)":due<0?"var(--red)":due<=3?"var(--amber)":"var(--t4)";
                    const subsDone=(t.subtasks??[]).filter(s=>s.completed).length;
                    const subTotal=(t.subtasks??[]).length;
                    return (
                      <div key={t.id} onClick={()=>{setSelectedTask(t);setSelectedEvent(null);}} style={{ display:"flex",alignItems:"flex-start",gap:8,padding:"8px 10px",borderRadius:6,background:"var(--surface2)",borderLeft:`2px solid ${PRIO_COLOR[t.priority??"medium"]}`,cursor:"pointer" }}
                        onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background="rgba(255,255,255,0.05)"}
                        onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background="var(--surface2)"}
                      >
                        <button onClick={ev=>{ev.stopPropagation();toggleTask(t.id,t.completed);}} style={{ width:14,height:14,borderRadius:3,flexShrink:0,marginTop:1,background:"transparent",border:"1px solid var(--border2)",cursor:"pointer" }}
                          onMouseEnter={e=>(e.currentTarget as HTMLElement).style.borderColor="var(--green)"}
                          onMouseLeave={e=>(e.currentTarget as HTMLElement).style.borderColor="var(--border2)"}
                        />
                        <div style={{ flex:1,minWidth:0 }}>
                          <p style={{ fontSize:12,color:"var(--t1)",fontWeight:500,lineHeight:1.4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{t.text}</p>
                          <div style={{ display:"flex",alignItems:"center",gap:8,marginTop:2,flexWrap:"wrap" }}>
                            {t.due_date&&<span style={{ fontSize:10,color:dueColor }}>{due===0?"Today":due===1?"Tomorrow":due!==null&&due<0?`${Math.abs(due)}d late`:new Date(t.due_date+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span>}
                            {subTotal>0&&<span style={{ fontSize:10,color:"var(--t4)" }}>◎ {subsDone}/{subTotal}</span>}
                            {t.list_id&&activeListId===null&&<span style={{ width:5,height:5,borderRadius:"50%",background:listColor,display:"inline-block" }}/>}
                          </div>
                        </div>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--t4)" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink:0,marginTop:2 }}><path d="M9 18l6-6-6-6"/></svg>
                      </div>
                    );
                  })}
                </div>

                {/* Done tasks */}
                {doneTasks.length>0&&(
                  <div>
                    <p style={{ fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"var(--t4)",marginBottom:6 }}>Completed · {doneTasks.length}</p>
                    <div style={{ display:"flex",flexDirection:"column",gap:3,maxHeight:100,overflowY:"auto" }}>
                      {doneTasks.map(t=>(
                        <div key={t.id} style={{ display:"flex",alignItems:"center",gap:8,padding:"6px 10px",borderRadius:4,background:"var(--surface2)",opacity:0.5 }}>
                          <button onClick={()=>toggleTask(t.id,t.completed)} style={{ width:14,height:14,borderRadius:3,background:"rgba(34,197,94,0.15)",border:"1px solid rgba(34,197,94,0.3)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,cursor:"pointer" }}>
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                          </button>
                          <span style={{ fontSize:11,color:"var(--t3)",textDecoration:"line-through",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{t.text}</span>
                          <button onClick={()=>deleteTask(t.id)} style={{ background:"none",border:"none",cursor:"pointer",color:"var(--t4)",padding:2 }}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </HudCard>
        </div>
      </div>

      {modalState&&<EventModal state={modalState} onSave={createGcalEvent} onClose={()=>setModalState(null)}/>}
    </div>
  );
}
