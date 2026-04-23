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
type CalView = "day"|"week"|"month";

/* ── Constants ── */
const DAYS_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const DAYS_FULL  = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const MONTHS     = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const HOURS      = Array.from({ length: 24 }, (_, i) => i);
const PRIO_COLOR: Record<string,string> = { high:"var(--red)", medium:"var(--amber)", low:"var(--blue)" };
const GCAL_COLORS: Record<string,string> = { "1":"#ac725e","2":"#d06b64","3":"#f83a22","4":"#fa573c","5":"#ff7537","6":"#ffad46","7":"#42d692","8":"#16a765","9":"#7bd148","10":"#b3dc6c","11":"#fbe983","default":"#4589ff" };
const LIST_PALETTE = ["#4589ff","#10b981","#8b5cf6","#f59e0b","#ef4444","#06b6d4","#ec4899","#f97316"];
const DEFAULT_LISTS = [
  { name:"Personal", color:"#4589ff" },
  { name:"Work",     color:"#10b981" },
  { name:"M.A.X.",   color:"#8b5cf6" },
];

/* ── Helpers ── */
function fmtHour(h: number) { if(h===0)return"12 AM"; if(h===12)return"12 PM"; return h<12?`${h} AM`:`${h-12} PM`; }
function isSameDay(a: Date, b: Date) { return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate(); }
function startOfWeek(d: Date) { const s=new Date(d); s.setDate(d.getDate()-d.getDay()); s.setHours(0,0,0,0); return s; }
function fmtTime(s: string) { return new Date(s).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",hour12:true}); }
function uid() { return Math.random().toString(36).slice(2,10); }
function daysUntil(dateStr: string) {
  const today = new Date(); today.setHours(0,0,0,0);
  const due   = new Date(dateStr+"T00:00:00");
  return Math.round((due.getTime()-today.getTime())/86400000);
}

/* ── New Event Modal ── */
function EventModal({ defaultDate, onSave, onClose }: {
  defaultDate: Date;
  onSave: (e:{title:string;start:string;end:string;description:string;location:string})=>Promise<void>;
  onClose: ()=>void;
}) {
  const fmt = (d: Date) => d.toISOString().slice(0,16);
  const ds = new Date(defaultDate); ds.setHours(9,0,0,0);
  const de = new Date(defaultDate); de.setHours(10,0,0,0);
  const [title,setTitle]=useState(""); const [start,setStart]=useState(fmt(ds)); const [end,setEnd]=useState(fmt(de));
  const [desc,setDesc]=useState(""); const [loc,setLoc]=useState(""); const [saving,setSaving]=useState(false);
  async function save() { if(!title.trim())return; setSaving(true); await onSave({title:title.trim(),start,end,description:desc,location:loc}); onClose(); }
  return (
    <div style={{position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center"}} onClick={onClose}>
      <div style={{background:"var(--surface)",border:"1px solid var(--border2)",borderRadius:12,padding:24,width:420,boxShadow:"0 24px 80px rgba(0,0,0,0.6)"}} onClick={e=>e.stopPropagation()}>
        <p style={{fontSize:11,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:"var(--t3)",marginBottom:16}}>New Calendar Event</p>
        <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Event title…" autoFocus style={{width:"100%",background:"var(--surface2)",border:"1px solid var(--border2)",borderRadius:6,padding:"10px 12px",fontSize:14,color:"var(--t1)",outline:"none",marginBottom:10}}/>
        <div style={{display:"flex",gap:10,marginBottom:10}}>
          <div style={{flex:1}}><p style={{fontSize:10,fontWeight:600,color:"var(--t3)",marginBottom:5}}>Start</p><input type="datetime-local" value={start} onChange={e=>setStart(e.target.value)} style={{width:"100%",background:"var(--surface2)",border:"1px solid var(--border2)",borderRadius:6,padding:"8px 10px",fontSize:12,color:"var(--t1)",outline:"none",colorScheme:"dark"}}/></div>
          <div style={{flex:1}}><p style={{fontSize:10,fontWeight:600,color:"var(--t3)",marginBottom:5}}>End</p><input type="datetime-local" value={end} onChange={e=>setEnd(e.target.value)} style={{width:"100%",background:"var(--surface2)",border:"1px solid var(--border2)",borderRadius:6,padding:"8px 10px",fontSize:12,color:"var(--t1)",outline:"none",colorScheme:"dark"}}/></div>
        </div>
        <input value={loc} onChange={e=>setLoc(e.target.value)} placeholder="Location (optional)…" style={{width:"100%",background:"var(--surface2)",border:"1px solid var(--border2)",borderRadius:6,padding:"8px 12px",fontSize:12,color:"var(--t1)",outline:"none",marginBottom:10}}/>
        <textarea value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Description (optional)…" rows={2} style={{width:"100%",background:"var(--surface2)",border:"1px solid var(--border2)",borderRadius:6,padding:"8px 12px",fontSize:12,color:"var(--t1)",outline:"none",resize:"none",marginBottom:14,fontFamily:"inherit"}}/>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button onClick={onClose} style={{padding:"8px 14px",borderRadius:6,cursor:"pointer",fontSize:12,background:"transparent",border:"1px solid var(--border2)",color:"var(--t3)"}}>Cancel</button>
          <button onClick={save} disabled={saving||!title.trim()} style={{padding:"8px 16px",borderRadius:6,cursor:"pointer",fontSize:12,fontWeight:700,background:"rgba(69,137,255,0.15)",border:"1px solid rgba(69,137,255,0.3)",color:"var(--blue)",opacity:saving?0.6:1}}>{saving?"Saving…":"Add to Calendar"}</button>
        </div>
      </div>
    </div>
  );
}

/* ── Task Detail Panel ── */
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

  useEffect(() => { setText(task.text); setDesc(task.description??""); setSubs(task.subtasks??[]); }, [task.id, task.text, task.description, task.subtasks]);

  function save(fields: Partial<Task>) { onUpdate(task.id, fields); }

  function toggleSub(id: string) {
    const next = subs.map(s => s.id===id ? {...s, completed:!s.completed} : s);
    setSubs(next); save({ subtasks: next });
  }
  function addSub() {
    if (!newSub.trim()) return;
    const next = [...subs, { id:uid(), text:newSub.trim(), completed:false }];
    setSubs(next); setNewSub(""); save({ subtasks: next }); subRef.current?.focus();
  }
  function deleteSub(id: string) {
    const next = subs.filter(s => s.id!==id);
    setSubs(next); save({ subtasks: next });
  }

  const due     = task.due_date ? daysUntil(task.due_date) : null;
  const dueColor= due===null?"var(--t4)":due<0?"var(--red)":due<=3?"var(--amber)":"var(--t4)";

  return (
    <div style={{display:"flex",flexDirection:"column",gap:0,height:"100%"}}>
      {/* Back */}
      <button onClick={onBack} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",cursor:"pointer",color:"var(--t4)",fontSize:11,fontWeight:600,padding:"0 0 14px",transition:"color .15s"}}
        onMouseEnter={e=>(e.currentTarget as HTMLElement).style.color="var(--t2)"}
        onMouseLeave={e=>(e.currentTarget as HTMLElement).style.color="var(--t4)"}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        All Tasks
      </button>

      {/* Title */}
      <input value={text} onChange={e=>setText(e.target.value)} onBlur={()=>text.trim()&&save({text:text.trim()})}
        style={{fontSize:16,fontWeight:700,color:"var(--t1)",background:"none",border:"none",outline:"none",padding:"0 0 10px",borderBottom:"1px solid var(--border)",marginBottom:14,width:"100%"}}
      />

      {/* Priority */}
      <div style={{marginBottom:12}}>
        <p style={{fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"var(--t4)",marginBottom:6}}>Priority</p>
        <div style={{display:"flex",gap:5}}>
          {(["high","medium","low"] as const).map(p=>(
            <button key={p} onClick={()=>save({priority:p})} style={{flex:1,padding:"7px 4px",borderRadius:6,cursor:"pointer",fontSize:11,fontWeight:600,background:task.priority===p?`${PRIO_COLOR[p]}20`:"var(--surface2)",border:`1px solid ${task.priority===p?PRIO_COLOR[p]:"var(--border2)"}`,color:task.priority===p?PRIO_COLOR[p]:"var(--t3)",transition:"all .15s",textTransform:"capitalize"}}>{p}</button>
          ))}
        </div>
      </div>

      {/* Due date */}
      <div style={{marginBottom:12}}>
        <p style={{fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"var(--t4)",marginBottom:6}}>Due Date</p>
        <input type="date" defaultValue={task.due_date??""} onChange={e=>save({due_date:e.target.value||null})}
          style={{width:"100%",background:"var(--surface2)",border:"1px solid var(--border2)",borderRadius:6,padding:"8px 10px",fontSize:12,color:dueColor,outline:"none",colorScheme:"dark"}}
        />
        {due!==null&&<p style={{fontSize:10,color:dueColor,marginTop:4}}>{due<0?`${Math.abs(due)}d overdue`:due===0?"Due today":`${due}d remaining`}</p>}
      </div>

      {/* List */}
      <div style={{marginBottom:12}}>
        <p style={{fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"var(--t4)",marginBottom:6}}>List</p>
        <select defaultValue={task.list_id??""} onChange={e=>save({list_id:e.target.value||null})}
          style={{width:"100%",background:"var(--surface2)",border:"1px solid var(--border2)",borderRadius:6,padding:"8px 10px",fontSize:12,color:"var(--t1)",outline:"none",cursor:"pointer"}}>
          <option value="">No list</option>
          {lists.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>

      {/* Description */}
      <div style={{marginBottom:14}}>
        <p style={{fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"var(--t4)",marginBottom:6}}>Notes</p>
        <textarea value={desc} onChange={e=>setDesc(e.target.value)} onBlur={()=>save({description:desc||null})}
          placeholder="Add notes…" rows={3}
          style={{width:"100%",background:"var(--surface2)",border:"1px solid var(--border2)",borderRadius:6,padding:"8px 10px",fontSize:12,color:"var(--t1)",outline:"none",resize:"none",fontFamily:"inherit",lineHeight:1.5}}
        />
      </div>

      {/* Subtasks */}
      <div style={{marginBottom:14,flex:1}}>
        <p style={{fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"var(--t4)",marginBottom:8}}>Subtasks {subs.length>0&&<span style={{color:"var(--t4)",fontWeight:400}}>({subs.filter(s=>s.completed).length}/{subs.length})</span>}</p>
        <div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:8,maxHeight:120,overflowY:"auto"}}>
          {subs.map(s=>(
            <div key={s.id} style={{display:"flex",alignItems:"center",gap:7}}>
              <button onClick={()=>toggleSub(s.id)} style={{width:13,height:13,borderRadius:3,flexShrink:0,cursor:"pointer",background:s.completed?"rgba(34,197,94,0.15)":"transparent",border:`1px solid ${s.completed?"rgba(34,197,94,0.4)":"var(--border2)"}`,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s"}}>
                {s.completed&&<svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
              </button>
              <span style={{flex:1,fontSize:12,color:s.completed?"var(--t4)":"var(--t2)",textDecoration:s.completed?"line-through":"none"}}>{s.text}</span>
              <button onClick={()=>deleteSub(s.id)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--t4)",padding:2,transition:"color .15s"}}
                onMouseEnter={e=>(e.currentTarget as HTMLElement).style.color="var(--red)"}
                onMouseLeave={e=>(e.currentTarget as HTMLElement).style.color="var(--t4)"}
              ><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
            </div>
          ))}
        </div>
        <div style={{display:"flex",gap:5}}>
          <input ref={subRef} value={newSub} onChange={e=>setNewSub(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addSub()}
            placeholder="Add subtask…"
            style={{flex:1,background:"var(--surface2)",border:"1px solid var(--border2)",borderRadius:5,padding:"6px 8px",fontSize:11,color:"var(--t1)",outline:"none"}}
          />
          <button onClick={addSub} style={{padding:"6px 10px",borderRadius:5,background:"rgba(69,137,255,0.1)",border:"1px solid rgba(69,137,255,0.2)",color:"var(--blue)",fontSize:11,fontWeight:700,cursor:"pointer"}}>+</button>
        </div>
      </div>

      {/* Delete */}
      <button onClick={()=>{onDelete(task.id);onBack();}} style={{padding:"9px",borderRadius:6,cursor:"pointer",fontSize:12,fontWeight:600,background:"rgba(239,68,68,0.06)",border:"1px solid rgba(239,68,68,0.15)",color:"var(--red)",transition:"all .15s",width:"100%"}}
        onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="rgba(239,68,68,0.12)";}}
        onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="rgba(239,68,68,0.06)";}}
      >Delete Task</button>
    </div>
  );
}

/* ── Main Page ── */
export default function CalendarPage() {
  const [view,         setView]        = useState<CalView>("week");
  const [cursor,       setCursor]      = useState(new Date());
  const [tasks,        setTasks]       = useState<Task[]>([]);
  const [lists,        setLists]       = useState<TaskList[]>([]);
  const [gcalEvents,   setGcalEvents]  = useState<GCalEvent[]>([]);
  const [gcalConnected,setGcalConn]    = useState(false);
  const [loadingCal,   setLoadingCal]  = useState(true);
  const [selectedTask, setSelectedTask]= useState<Task|null>(null);
  const [activeListId, setActiveListId]= useState<string|null>(null);
  const [eventModal,   setEventModal]  = useState(false);
  const [newTaskText,  setNewTaskText] = useState("");
  const [addingTask,   setAddingTask]  = useState(false);
  const [newListMode,  setNewListMode] = useState(false);
  const [newListName,  setNewListName] = useState("");
  const today = new Date();

  /* ── Data loading ── */
  useEffect(() => {
    supabase.from("tasks").select("*").order("created_at").then(({ data }) => { if (data) setTasks(data as Task[]); });
    supabase.from("task_lists").select("*").order("position").then(async ({ data }) => {
      if (data && data.length > 0) { setLists(data as TaskList[]); return; }
      // Seed defaults if empty
      const rows = DEFAULT_LISTS.map((l,i)=>({...l,position:i}));
      const { data: seeded } = await supabase.from("task_lists").insert(rows).select();
      if (seeded) setLists(seeded as TaskList[]);
    });
  }, []);

  useEffect(() => {
    setLoadingCal(true);
    const start = new Date(); start.setMonth(start.getMonth()-1);
    const end   = new Date(); end.setMonth(end.getMonth()+3);
    fetch(`/api/google/calendar?timeMin=${start.toISOString()}&timeMax=${end.toISOString()}`)
      .then(r=>r.json()).then(d=>{ setGcalConn(d.connected??false); setGcalEvents(d.events??[]); })
      .catch(()=>setGcalConn(false)).finally(()=>setLoadingCal(false));
  }, []);

  /* ── Task operations ── */
  async function addTask() {
    const text = newTaskText.trim(); if (!text) return;
    setNewTaskText(""); setAddingTask(false);
    const { data } = await supabase.from("tasks").insert({ text, completed:false, priority:"medium", list_id:activeListId, subtasks:[] }).select().single();
    if (data) setTasks(prev=>[...prev, data as Task]);
  }

  const updateTask = useCallback(async (id: string, fields: Partial<Task>) => {
    setTasks(prev => prev.map(t => t.id===id ? {...t,...fields} : t));
    if (selectedTask?.id===id) setSelectedTask(prev => prev ? {...prev,...fields} : prev);
    await supabase.from("tasks").update(fields).eq("id", id);
  }, [selectedTask?.id]);

  async function toggleTask(id: string, completed: boolean) { await updateTask(id, { completed: !completed }); }

  async function deleteTask(id: string) {
    setTasks(prev=>prev.filter(t=>t.id!==id));
    if (selectedTask?.id===id) setSelectedTask(null);
    await supabase.from("tasks").delete().eq("id", id);
  }

  async function createList() {
    const name = newListName.trim(); if (!name) return;
    const color = LIST_PALETTE[lists.length % LIST_PALETTE.length];
    const pos   = lists.length;
    const { data } = await supabase.from("task_lists").insert({ name, color, position:pos }).select().single();
    if (data) { setLists(prev=>[...prev, data as TaskList]); setActiveListId(data.id); }
    setNewListMode(false); setNewListName("");
  }

  async function deleteList(id: string) {
    await supabase.from("task_lists").delete().eq("id", id);
    await supabase.from("tasks").update({ list_id:null }).eq("list_id", id);
    setLists(prev=>prev.filter(l=>l.id!==id));
    if (activeListId===id) setActiveListId(null);
    setTasks(prev=>prev.map(t=>t.list_id===id?{...t,list_id:null}:t));
  }

  /* ── Google Calendar ── */
  async function createGcalEvent(fields: {title:string;start:string;end:string;description:string;location:string}) {
    const res  = await fetch("/api/google/calendar",{ method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({...fields,timeZone:"America/New_York"}) });
    const data = await res.json();
    if (data.success && data.event) {
      const e = data.event;
      setGcalEvents(prev=>[...prev,{ id:e.id, title:e.summary??fields.title, description:e.description??"", location:e.location??"", start:e.start?.dateTime??e.start?.date??fields.start, end:e.end?.dateTime??e.end?.date??fields.end, allDay:!e.start?.dateTime, color:null, htmlLink:e.htmlLink??"", status:"confirmed" }]);
    }
  }

  /* ── Navigation ── */
  function nav(dir: -1|1) {
    const d = new Date(cursor);
    if (view==="day")   d.setDate(d.getDate()+dir);
    if (view==="week")  d.setDate(d.getDate()+dir*7);
    if (view==="month") d.setMonth(d.getMonth()+dir);
    setCursor(d);
  }
  function navLabel() {
    if (view==="day") return cursor.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"});
    if (view==="week") { const ws=startOfWeek(cursor); const we=new Date(ws); we.setDate(ws.getDate()+6); return `${ws.toLocaleDateString("en-US",{month:"short",day:"numeric"})} – ${we.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}`; }
    return `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
  }

  /* ── Calendar helpers ── */
  const weekDays = Array.from({length:7},(_,i)=>{ const d=new Date(startOfWeek(cursor)); d.setDate(d.getDate()+i); return d; });
  function monthGrid() {
    const first=new Date(cursor.getFullYear(),cursor.getMonth(),1);
    const last =new Date(cursor.getFullYear(),cursor.getMonth()+1,0);
    const cells:(Date|null)[]=[]; for(let i=0;i<first.getDay();i++)cells.push(null); for(let d=1;d<=last.getDate();d++)cells.push(new Date(cursor.getFullYear(),cursor.getMonth(),d)); while(cells.length%7!==0)cells.push(null); return cells;
  }
  function tasksForDay(d: Date)  { return tasks.filter(t=>t.due_date&&isSameDay(new Date(t.due_date+"T00:00:00"),d)); }
  function eventsForDay(d: Date) { return gcalEvents.filter(e=>{ const s=new Date(e.allDay?e.start+"T00:00:00":e.start); return isSameDay(s,d); }); }
  function eventsForHour(d: Date, h: number) { return gcalEvents.filter(e=>{ if(e.allDay)return false; const s=new Date(e.start); return isSameDay(s,d)&&s.getHours()===h; }); }
  const gcalColor=(e:GCalEvent)=>e.color?(GCAL_COLORS[e.color]??GCAL_COLORS.default):GCAL_COLORS.default;

  /* ── Filtered tasks ── */
  const filteredTasks = tasks.filter(t => activeListId ? t.list_id===activeListId : true);
  const openTasks  = filteredTasks.filter(t=>!t.completed);
  const doneTasks  = filteredTasks.filter(t=>t.completed);

  /* ── Active list color ── */
  const activeList = lists.find(l=>l.id===activeListId);

  return (
    <div style={{padding:"28px 36px",background:"var(--bg)",minHeight:"100vh"}}>

      {/* Google banner */}
      {!loadingCal&&!gcalConnected&&(
        <div style={{marginBottom:20,padding:"12px 18px",borderRadius:10,background:"rgba(69,137,255,0.06)",border:"1px solid rgba(69,137,255,0.18)",display:"flex",alignItems:"center",gap:14}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <p style={{fontSize:12,color:"var(--t2)",flex:1}}>Connect Google Calendar to sync your events.</p>
          <a href="/api/auth/google" style={{padding:"7px 16px",borderRadius:7,background:"rgba(69,137,255,0.12)",border:"1px solid rgba(69,137,255,0.3)",color:"var(--blue)",fontSize:12,fontWeight:700,textDecoration:"none"}}>Connect Google</a>
        </div>
      )}
      {gcalConnected&&(
        <div style={{marginBottom:20,padding:"10px 16px",borderRadius:10,background:"rgba(34,197,94,0.05)",border:"1px solid rgba(34,197,94,0.18)",display:"flex",alignItems:"center",gap:10}}>
          <span style={{width:6,height:6,borderRadius:"50%",background:"var(--green)",display:"inline-block"}}/>
          <p style={{fontSize:11,color:"var(--green)",fontWeight:600}}>Google Calendar connected · {gcalEvents.length} events synced</p>
        </div>
      )}

      {/* Header */}
      <div className="afu" style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:24}}>
        <div>
          <p style={{fontSize:11,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:"var(--t3)",marginBottom:6}}>Schedule & Tasks</p>
          <h1 style={{fontSize:28,fontWeight:800,color:"var(--t1)",letterSpacing:"-0.02em"}}>{navLabel()}</h1>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{display:"flex",background:"var(--surface)",border:"1px solid var(--border)",borderRadius:8,padding:3,gap:2}}>
            {(["day","week","month"] as CalView[]).map(v=>(
              <button key={v} onClick={()=>setView(v)} style={{padding:"6px 14px",borderRadius:6,cursor:"pointer",fontSize:12,fontWeight:600,background:view===v?"rgba(69,137,255,0.15)":"transparent",border:`1px solid ${view===v?"rgba(69,137,255,0.3)":"transparent"}`,color:view===v?"var(--blue)":"var(--t3)",transition:"all .15s",textTransform:"capitalize"}}>{v}</button>
            ))}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:4}}>
            {[-1,1].map(dir=>(
              <button key={dir} onClick={()=>nav(dir as -1|1)} style={{width:32,height:32,borderRadius:6,cursor:"pointer",background:"var(--surface)",border:"1px solid var(--border)",color:"var(--t2)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d={dir===-1?"M15 18l-6-6 6-6":"M9 18l6-6-6-6"}/></svg>
              </button>
            ))}
            <button onClick={()=>setCursor(new Date())} style={{padding:"6px 12px",borderRadius:6,cursor:"pointer",fontSize:11,fontWeight:700,background:"var(--surface)",border:"1px solid var(--border)",color:"var(--t3)"}}>Today</button>
          </div>
          {gcalConnected&&(
            <button onClick={()=>setEventModal(true)} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 14px",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:700,background:"rgba(34,197,94,0.08)",border:"1px solid rgba(34,197,94,0.2)",color:"var(--green)"}}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>Add Event
            </button>
          )}
          <button onClick={()=>{setSelectedTask(null);setAddingTask(true);}} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 14px",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:700,background:"rgba(69,137,255,0.1)",border:"1px solid rgba(69,137,255,0.25)",color:"var(--blue)"}}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>Add Task
          </button>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 320px",gap:16}}>

        {/* ── Calendar Panel ── */}
        <div>
          {view==="day"&&(
            <HudCard style={{padding:0,overflow:"hidden"}}>
              <div style={{display:"grid",gridTemplateColumns:"56px 1fr"}}>
                <div style={{borderRight:"1px solid var(--border)"}}/>
                <div style={{padding:"12px 16px",borderBottom:"1px solid var(--border)"}}>
                  <p style={{fontSize:13,fontWeight:700,color:isSameDay(cursor,today)?"var(--blue)":"var(--t1)"}}>{DAYS_FULL[cursor.getDay()]}</p>
                  <p style={{fontSize:28,fontWeight:900,color:"var(--t1)",lineHeight:1}}>{cursor.getDate()}</p>
                </div>
              </div>
              <div style={{maxHeight:520,overflowY:"auto"}}>
                {HOURS.map(h=>(
                  <div key={h} style={{display:"grid",gridTemplateColumns:"56px 1fr",minHeight:52}}>
                    <div style={{padding:"6px 10px 0",borderRight:"1px solid var(--border)"}}><span style={{fontSize:10,color:"var(--t4)",fontFamily:"monospace"}}>{fmtHour(h)}</span></div>
                    <div style={{borderBottom:"1px solid var(--border)",padding:"4px 8px",display:"flex",flexWrap:"wrap",gap:3}}>
                      {eventsForHour(cursor,h).map(e=>(
                        <a key={e.id} href={e.htmlLink} target="_blank" rel="noreferrer" style={{display:"block",padding:"3px 8px",borderRadius:4,fontSize:11,fontWeight:600,textDecoration:"none",background:`${gcalColor(e)}20`,border:`1px solid ${gcalColor(e)}40`,color:gcalColor(e)}}>{fmtTime(e.start)} {e.title}</a>
                      ))}
                      {tasksForDay(cursor).map(t=>(
                        <button key={t.id} onClick={()=>{setSelectedTask(t);setAddingTask(false);}} style={{padding:"3px 8px",borderRadius:4,fontSize:11,fontWeight:600,cursor:"pointer",background:`${PRIO_COLOR[t.priority??"medium"]}15`,border:`1px solid ${PRIO_COLOR[t.priority??"medium"]}30`,color:PRIO_COLOR[t.priority??"medium"]}}>{t.text}</button>
                      ))}
                      {h===today.getHours()&&isSameDay(cursor,today)&&<div style={{height:1,background:"var(--red)",width:"100%",opacity:0.6}}/>}
                    </div>
                  </div>
                ))}
              </div>
            </HudCard>
          )}

          {view==="week"&&(
            <HudCard style={{padding:0,overflow:"hidden"}}>
              <div style={{display:"grid",gridTemplateColumns:"48px repeat(7,1fr)",borderBottom:"1px solid var(--border)"}}>
                <div/>
                {weekDays.map((d,i)=>(
                  <div key={i} style={{padding:"12px 8px",textAlign:"center",borderLeft:i>0?"1px solid var(--border)":undefined,background:isSameDay(d,today)?"rgba(69,137,255,0.04)":undefined}}>
                    <p style={{fontSize:10,fontWeight:600,color:"var(--t3)",marginBottom:4}}>{DAYS_SHORT[d.getDay()]}</p>
                    <div style={{width:28,height:28,borderRadius:"50%",margin:"0 auto",background:isSameDay(d,today)?"var(--blue)":"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>
                      <p style={{fontSize:13,fontWeight:700,color:isSameDay(d,today)?"#fff":"var(--t1)"}}>{d.getDate()}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{maxHeight:480,overflowY:"auto"}}>
                {HOURS.map(h=>(
                  <div key={h} style={{display:"grid",gridTemplateColumns:"48px repeat(7,1fr)",minHeight:44}}>
                    <div style={{padding:"4px 6px 0",borderRight:"1px solid var(--border)",borderBottom:"1px solid rgba(30,37,48,0.5)"}}><span style={{fontSize:9,color:"var(--t4)",fontFamily:"monospace"}}>{fmtHour(h)}</span></div>
                    {weekDays.map((d,i)=>(
                      <div key={i} style={{borderLeft:"1px solid var(--border)",borderBottom:"1px solid rgba(30,37,48,0.5)",padding:"2px 3px",background:isSameDay(d,today)?"rgba(69,137,255,0.02)":undefined}}>
                        {eventsForHour(d,h).map(e=>(<a key={e.id} href={e.htmlLink} target="_blank" rel="noreferrer" style={{display:"block",width:"100%",padding:"2px 5px",borderRadius:3,fontSize:9,fontWeight:600,marginBottom:2,textDecoration:"none",background:`${gcalColor(e)}15`,border:`1px solid ${gcalColor(e)}25`,color:gcalColor(e),whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{e.title}</a>))}
                        {tasksForDay(d).map(t=>(<button key={t.id} onClick={()=>{setSelectedTask(t);setAddingTask(false);}} style={{display:"block",width:"100%",textAlign:"left",padding:"2px 5px",borderRadius:3,fontSize:10,fontWeight:600,cursor:"pointer",marginBottom:2,background:`${PRIO_COLOR[t.priority??"medium"]}15`,border:`1px solid ${PRIO_COLOR[t.priority??"medium"]}25`,color:PRIO_COLOR[t.priority??"medium"],whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{t.text}</button>))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </HudCard>
          )}

          {view==="month"&&(
            <HudCard style={{padding:16}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:1,marginBottom:4}}>
                {DAYS_SHORT.map(d=>(<div key={d} style={{padding:"6px 0",textAlign:"center",fontSize:10,fontWeight:700,color:"var(--t3)",letterSpacing:"0.08em"}}>{d}</div>))}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
                {monthGrid().map((d,i)=>{
                  if(!d)return<div key={i}/>;
                  const dt=tasksForDay(d); const de=eventsForDay(d); const isT=isSameDay(d,today);
                  return(
                    <div key={i} style={{minHeight:76,padding:"6px 8px",borderRadius:6,background:isT?"rgba(69,137,255,0.07)":"var(--surface)",border:`1px solid ${isT?"rgba(69,137,255,0.25)":"var(--border)"}`,cursor:"pointer"}}>
                      <div style={{width:22,height:22,borderRadius:"50%",marginBottom:4,background:isT?"var(--blue)":"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>
                        <span style={{fontSize:11,fontWeight:isT?800:500,color:isT?"#fff":"var(--t2)"}}>{d.getDate()}</span>
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:2}}>
                        {de.slice(0,2).map(e=>(<a key={e.id} href={e.htmlLink} target="_blank" rel="noreferrer" onClick={ev=>ev.stopPropagation()} style={{display:"block",padding:"2px 4px",borderRadius:3,fontSize:9,fontWeight:600,textDecoration:"none",background:`${gcalColor(e)}15`,color:gcalColor(e),whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{e.title}</a>))}
                        {dt.slice(0,2).map(t=>(<button key={t.id} onClick={()=>{setSelectedTask(t);setAddingTask(false);}} style={{display:"block",width:"100%",textAlign:"left",padding:"2px 4px",borderRadius:3,fontSize:9,fontWeight:600,cursor:"pointer",background:`${PRIO_COLOR[t.priority??"medium"]}15`,color:PRIO_COLOR[t.priority??"medium"],whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",border:"none"}}>{t.text}</button>))}
                        {(de.length+dt.length)>4&&<span style={{fontSize:9,color:"var(--t4)"}}>+{de.length+dt.length-4} more</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </HudCard>
          )}
        </div>

        {/* ── Task Panel ── */}
        <div style={{display:"flex",flexDirection:"column",gap:12}}>

          {/* Stats row */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {[
              {label:"Open",  value:tasks.filter(t=>!t.completed).length, color:"var(--blue)"},
              {label:"Done",  value:tasks.filter(t=>t.completed).length,  color:"var(--green)"},
              {label:"High",  value:tasks.filter(t=>!t.completed&&t.priority==="high").length, color:"var(--red)"},
              {label:"Due Soon",value:tasks.filter(t=>!t.completed&&t.due_date&&daysUntil(t.due_date)<=3&&daysUntil(t.due_date)>=0).length, color:"var(--amber)"},
            ].map(s=>(
              <HudCard key={s.label} style={{padding:"12px 14px"}}>
                <p style={{fontSize:20,fontWeight:800,color:s.color,fontFamily:"monospace"}}>{s.value}</p>
                <p style={{fontSize:10,color:"var(--t3)",fontWeight:600,marginTop:2}}>{s.label}</p>
              </HudCard>
            ))}
          </div>

          {/* Main task card */}
          <HudCard style={{padding:"16px",flex:1,minHeight:0}}>

            {selectedTask ? (
              <TaskDetail
                task={selectedTask}
                lists={lists}
                onUpdate={updateTask}
                onDelete={deleteTask}
                onBack={()=>setSelectedTask(null)}
              />
            ) : (
              <>
                {/* List tabs */}
                <div style={{marginBottom:12}}>
                  <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:8}}>
                    <button onClick={()=>setActiveListId(null)} style={{padding:"5px 11px",borderRadius:20,fontSize:11,fontWeight:600,cursor:"pointer",background:activeListId===null?"rgba(69,137,255,0.15)":"transparent",border:`1px solid ${activeListId===null?"rgba(69,137,255,0.35)":"var(--border2)"}`,color:activeListId===null?"var(--blue)":"var(--t3)",transition:"all .15s"}}>All</button>
                    {lists.map(l=>(
                      <button key={l.id} onClick={()=>setActiveListId(l.id)} style={{padding:"5px 11px",borderRadius:20,fontSize:11,fontWeight:600,cursor:"pointer",background:activeListId===l.id?`${l.color}20`:"transparent",border:`1px solid ${activeListId===l.id?l.color:"var(--border2)"}`,color:activeListId===l.id?l.color:"var(--t3)",transition:"all .15s"}}>{l.name}</button>
                    ))}
                    <button onClick={()=>setNewListMode(true)} style={{padding:"5px 9px",borderRadius:20,fontSize:11,cursor:"pointer",background:"transparent",border:"1px dashed var(--border2)",color:"var(--t4)",transition:"all .15s"}}
                      onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.color="var(--t2)";(e.currentTarget as HTMLElement).style.borderColor="var(--border)";}}
                      onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.color="var(--t4)";(e.currentTarget as HTMLElement).style.borderColor="var(--border2)";}}
                    >+</button>
                  </div>

                  {/* New list input */}
                  {newListMode&&(
                    <div style={{display:"flex",gap:5,marginBottom:8}}>
                      <input autoFocus value={newListName} onChange={e=>setNewListName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")createList();if(e.key==="Escape"){setNewListMode(false);setNewListName("");}}} placeholder="List name…" style={{flex:1,background:"var(--surface2)",border:"1px solid var(--border2)",borderRadius:6,padding:"6px 10px",fontSize:12,color:"var(--t1)",outline:"none"}}/>
                      <button onClick={createList} style={{padding:"6px 12px",borderRadius:6,background:"rgba(69,137,255,0.1)",border:"1px solid rgba(69,137,255,0.2)",color:"var(--blue)",fontSize:12,fontWeight:700,cursor:"pointer"}}>Add</button>
                      <button onClick={()=>{setNewListMode(false);setNewListName("");}} style={{padding:"6px 10px",borderRadius:6,background:"transparent",border:"1px solid var(--border2)",color:"var(--t3)",fontSize:12,cursor:"pointer"}}>✕</button>
                    </div>
                  )}

                  {/* Delete list button */}
                  {activeListId&&activeList&&(
                    <button onClick={()=>deleteList(activeListId)} style={{fontSize:10,color:"var(--t4)",background:"none",border:"none",cursor:"pointer",padding:"0 0 4px",transition:"color .15s"}}
                      onMouseEnter={e=>(e.currentTarget as HTMLElement).style.color="var(--red)"}
                      onMouseLeave={e=>(e.currentTarget as HTMLElement).style.color="var(--t4)"}
                    >Delete &ldquo;{activeList.name}&rdquo; list</button>
                  )}
                </div>

                {/* Add task input */}
                {addingTask ? (
                  <div style={{display:"flex",gap:5,marginBottom:10}}>
                    <input autoFocus value={newTaskText} onChange={e=>setNewTaskText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")addTask();if(e.key==="Escape"){setAddingTask(false);setNewTaskText("");}}} placeholder="Task name…" style={{flex:1,background:"var(--surface2)",border:"1px solid rgba(69,137,255,0.35)",borderRadius:6,padding:"8px 10px",fontSize:13,color:"var(--t1)",outline:"none"}}/>
                    <button onClick={addTask} style={{padding:"8px 14px",borderRadius:6,background:"rgba(69,137,255,0.15)",border:"1px solid rgba(69,137,255,0.3)",color:"var(--blue)",fontSize:12,fontWeight:700,cursor:"pointer"}}>Add</button>
                    <button onClick={()=>{setAddingTask(false);setNewTaskText("");}} style={{padding:"8px 10px",borderRadius:6,background:"transparent",border:"1px solid var(--border2)",color:"var(--t3)",fontSize:12,cursor:"pointer"}}>✕</button>
                  </div>
                ) : (
                  <button onClick={()=>setAddingTask(true)} style={{width:"100%",padding:"8px",borderRadius:6,marginBottom:10,background:"transparent",border:"1px dashed var(--border2)",color:"var(--t4)",fontSize:12,cursor:"pointer",textAlign:"left",transition:"all .15s"}}
                    onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor=activeList?.color??"var(--blue)";(e.currentTarget as HTMLElement).style.color="var(--t2)";}}
                    onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor="var(--border2)";(e.currentTarget as HTMLElement).style.color="var(--t4)";}}
                  >+ Add task{activeList?` to ${activeList.name}`:""}…</button>
                )}

                {/* Open tasks */}
                <div style={{display:"flex",flexDirection:"column",gap:3,maxHeight:280,overflowY:"auto",marginBottom:8}}>
                  {openTasks.length===0&&<p style={{fontSize:12,color:"var(--t4)",textAlign:"center",padding:"20px 0"}}>All clear{activeList?` in ${activeList.name}`:""}.</p>}
                  {openTasks.map(t=>{
                    const listColor = lists.find(l=>l.id===t.list_id)?.color ?? "var(--border2)";
                    const due = t.due_date ? daysUntil(t.due_date) : null;
                    const dueColor = due===null?"var(--t4)":due<0?"var(--red)":due<=3?"var(--amber)":"var(--t4)";
                    const subsDone = (t.subtasks??[]).filter(s=>s.completed).length;
                    const subTotal = (t.subtasks??[]).length;
                    return (
                      <div key={t.id} style={{display:"flex",alignItems:"flex-start",gap:8,padding:"8px 10px",borderRadius:6,background:"var(--surface2)",borderLeft:`2px solid ${PRIO_COLOR[t.priority??"medium"]}`,cursor:"pointer",transition:"background .12s"}}
                        onClick={()=>setSelectedTask(t)}
                        onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background="rgba(255,255,255,0.05)"}
                        onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background="var(--surface2)"}
                      >
                        <button onClick={ev=>{ev.stopPropagation();toggleTask(t.id,t.completed);}} style={{width:14,height:14,borderRadius:3,flexShrink:0,marginTop:1,background:"transparent",border:"1px solid var(--border2)",cursor:"pointer",transition:"all .15s"}}
                          onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor="var(--green)";}}
                          onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor="var(--border2)";}}
                        />
                        <div style={{flex:1,minWidth:0}}>
                          <p style={{fontSize:12,color:"var(--t1)",fontWeight:500,lineHeight:1.4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.text}</p>
                          <div style={{display:"flex",alignItems:"center",gap:8,marginTop:2,flexWrap:"wrap"}}>
                            {t.due_date&&<span style={{fontSize:10,color:dueColor}}>{due===0?"Today":due===1?"Tomorrow":due!==null&&due<0?`${Math.abs(due)}d late`:t.due_date?new Date(t.due_date+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"}):""}</span>}
                            {subTotal>0&&<span style={{fontSize:10,color:"var(--t4)"}}>◎ {subsDone}/{subTotal}</span>}
                            {t.list_id&&activeListId===null&&<span style={{width:6,height:6,borderRadius:"50%",background:listColor,display:"inline-block"}}/>}
                          </div>
                        </div>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--t4)" strokeWidth="2.5" strokeLinecap="round" style={{flexShrink:0,marginTop:2}}><path d="M9 18l6-6-6-6"/></svg>
                      </div>
                    );
                  })}
                </div>

                {/* Done tasks */}
                {doneTasks.length>0&&(
                  <div>
                    <p style={{fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"var(--t4)",marginBottom:6}}>Completed · {doneTasks.length}</p>
                    <div style={{display:"flex",flexDirection:"column",gap:3,maxHeight:120,overflowY:"auto"}}>
                      {doneTasks.map(t=>(
                        <div key={t.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",borderRadius:4,background:"var(--surface2)",opacity:0.5}}>
                          <button onClick={()=>toggleTask(t.id,t.completed)} style={{width:14,height:14,borderRadius:3,background:"rgba(34,197,94,0.15)",border:"1px solid rgba(34,197,94,0.3)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,cursor:"pointer"}}>
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                          </button>
                          <span style={{fontSize:11,color:"var(--t3)",textDecoration:"line-through",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.text}</span>
                          <button onClick={()=>deleteTask(t.id)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--t4)",padding:2}}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
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

      {eventModal&&<EventModal defaultDate={cursor} onSave={createGcalEvent} onClose={()=>setEventModal(false)}/>}
    </div>
  );
}
