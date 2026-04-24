"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

/* ── Types ── */
interface Goal {
  id: string; category: string; label: string; desc: string;
  current: number; target: number; unit: string; deadline: string;
  colorHex: string; milestones: { l: string; v: number }[];
  subgoals: { text: string; done: boolean }[];
}
interface Habit { id: string; name: string; cat: string; streak: number; color: string }
interface Note  { id: string; goal_id: string; text: string; created_at: string }

/* ── Seed data (populates empty DB on first load) ── */
const GOALS_SEED: Goal[] = [
  { id:"income-100k", category:"Income", label:"$100K First Year", desc:"Hit $100K total compensation in your first full year as an Account Manager.", current:0, target:100000, unit:"$", deadline:"2027-07-01", colorHex:"#5FB07D",
    milestones:[{l:"$25K",v:25000},{l:"$50K",v:50000},{l:"$75K",v:75000},{l:"$100K",v:100000}],
    subgoals:[{text:"Start job at staffing firm (July 2026)",done:false},{text:"Hit first $10K in commissions",done:false},{text:"Close 5 placements in first quarter",done:false},{text:"Establish top-performer reputation",done:false}] },
  { id:"emergency-fund", category:"Finance", label:"Emergency Fund — $10K", desc:"Build a 3-month cash cushion before allocating aggressively to investments.", current:2800, target:10000, unit:"$", deadline:"2026-12-01", colorHex:"#9B8AFB",
    milestones:[{l:"$2.5K",v:2500},{l:"$5K",v:5000},{l:"$7.5K",v:7500},{l:"$10K",v:10000}],
    subgoals:[{text:"Reach $2,500 (checkpoint)",done:true},{text:"Reach $5,000 (halfway)",done:false},{text:"Reach $7,500",done:false},{text:"Hit $10,000 target",done:false}] },
  { id:"gym-52weeks", category:"Fitness", label:"Gym 4×/Week — Full Year", desc:"Maintain 4+ gym sessions per week for 52 straight weeks. Push/Pull/Legs every cycle.", current:12, target:52, unit:"weeks", deadline:"2027-04-01", colorHex:"#7DB8E8",
    milestones:[{l:"1 month",v:4},{l:"3 months",v:13},{l:"6 months",v:26},{l:"1 year",v:52}],
    subgoals:[{text:"Complete first 4 weeks consistently",done:true},{text:"Build morning gym habit",done:false},{text:"Track workouts in app",done:false},{text:"Hit 26-week (6-month) milestone",done:false}] },
  { id:"ai-learning", category:"Learning", label:"Master AI + Vibe Coding", desc:"Build real competency in Claude Code, Python basics, and AI-assisted workflows.", current:8, target:30, unit:"sessions", deadline:"2026-09-01", colorHex:"#C85A5A",
    milestones:[{l:"5 sessions",v:5},{l:"10",v:10},{l:"20",v:20},{l:"30",v:30}],
    subgoals:[{text:"Build M.A.X. dashboard (v1)",done:true},{text:"Learn Python basics (loops, functions, data)",done:false},{text:"Build a second project from scratch",done:false},{text:"Integrate AI into daily work workflow",done:false}] },
  { id:"morning-routine", category:"Morning", label:"Morning Routine — 30 Days", desc:"Wake up by 7:30 AM and complete a consistent morning routine for 30 consecutive days.", current:0, target:30, unit:"days", deadline:"2026-06-01", colorHex:"#9B8AFB",
    milestones:[{l:"7 days",v:7},{l:"14 days",v:14},{l:"21 days",v:21},{l:"30 days",v:30}],
    subgoals:[{text:"Wake up before 7:30 AM for 7 days straight",done:false},{text:"Build consistent bedtime (before 12 AM)",done:false},{text:"Complete morning routine checklist daily",done:false},{text:"Hit 30-day streak",done:false}] },
];

const CATEGORIES = ["Income","Finance","Fitness","Learning","Morning","Health","Business","Personal"];
const COLORS = ["#5FB07D","#9B8AFB","#7DB8E8","#C85A5A","#9B8AFB","#7DB8E8","#C85A5A","#C85A5A"];

const inp: React.CSSProperties = { width:"100%", background:"var(--surface2)", border:"1px solid var(--border2)", borderRadius:6, padding:"9px 12px", color:"var(--t1)", fontSize:13, fontWeight:500, outline:"none", boxSizing:"border-box" };
const lbl: React.CSSProperties = { fontSize:10, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"var(--t3)", display:"block", marginBottom:6 };

/* ── Helpers ── */
function getStatus(g: Goal) {
  const now = new Date(), deadline = new Date(g.deadline);
  const daysLeft = Math.max(0, Math.floor((deadline.getTime() - now.getTime()) / 86400000));
  const pct = Math.min(100, (g.current / g.target) * 100);
  const startDate = new Date(now.getFullYear()-1, now.getMonth(), now.getDate());
  const expectedPct = Math.min(100, (now.getTime() - startDate.getTime()) / (deadline.getTime() - startDate.getTime()) * 100);
  if (g.current >= g.target) return { label:"COMPLETE",    color:"#5FB07D", bg:"rgba(95,176,125,0.1)"  };
  if (daysLeft <= 0)         return { label:"OVERDUE",     color:"#C85A5A", bg:"rgba(200,90,90,0.1)"  };
  if (pct >= expectedPct*1.1) return { label:"CRUSHING IT", color:"#5FB07D", bg:"rgba(95,176,125,0.1)"  };
  if (pct >= expectedPct*0.9) return { label:"ON TRACK",    color:"#7DB8E8", bg:"rgba(125,184,232,0.1)"  };
  if (pct >= expectedPct*0.6) return { label:"BEHIND",      color:"#C85A5A", bg:"rgba(200,90,90,0.1)" };
  return                       { label:"STALLED",       color:"#C85A5A", bg:"rgba(200,90,90,0.1)"  };
}

function projectedDate(g: Goal): string | null {
  if (g.current <= 0) return null;
  const now = new Date();
  const startDate = new Date(now.getFullYear()-1, now.getMonth(), now.getDate());
  const rate = g.current / Math.max(1, (now.getTime() - startDate.getTime()) / 86400000);
  if (rate <= 0) return null;
  return new Date(now.getTime() + ((g.target - g.current) / rate) * 86400000)
    .toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" });
}

function generateInsight(g: Goal): string {
  const now = new Date(), deadline = new Date(g.deadline);
  const daysLeft = Math.max(0, Math.floor((deadline.getTime() - now.getTime()) / 86400000));
  const monthsLeft = Math.max(0, Math.round(daysLeft / 30.5));
  const remaining = g.target - g.current;
  const pct = Math.round((g.current / g.target) * 100);
  if (g.current >= g.target) return `Done. ${g.label} — closed out. Set a new target.`;
  if (daysLeft <= 0) return `Deadline passed. ${remaining > 0 ? (g.unit==="$" ? `$${remaining.toLocaleString()} short.` : `${remaining} ${g.unit} short.`) : "Goal achieved."} Reset the deadline.`;
  if (g.unit === "$") {
    if (g.current === 0) return `Not started. Need $${remaining.toLocaleString()} by ${deadline.toLocaleDateString("en-US",{month:"short",year:"numeric"})} — $${Math.ceil(remaining/Math.max(1,monthsLeft)).toLocaleString()}/mo.`;
    return `$${remaining.toLocaleString()} left over ${monthsLeft} months. Need $${Math.ceil(remaining/Math.max(1,monthsLeft)).toLocaleString()}/mo to close on time.`;
  }
  if (g.unit === "weeks") return `${g.current}/${g.target} weeks (${pct}%). ${Math.floor(daysLeft/7)} weeks to deadline — ${Math.floor(daysLeft/7) >= remaining ? "achievable" : "timeline tight"}.`;
  if (g.unit === "sessions") return `${g.current}/${g.target} sessions (${pct}%). ${monthsLeft>0?Math.ceil(remaining/monthsLeft):remaining}/mo keeps you on track.`;
  if (g.unit === "days") return `${g.current}/${g.target} days (${pct}%). ${remaining} left — ${daysLeft} days until deadline.`;
  return `${pct}% complete. ${remaining} ${g.unit} left with ${monthsLeft} months to go.`;
}

function getLinkedHabits(goal: Goal, habits: Habit[]): Habit[] {
  const gl  = (goal.label + " " + goal.category).toLowerCase();
  const gcat = goal.category.toLowerCase();
  return habits.filter(h => {
    const hl   = (h.name + " " + h.cat).toLowerCase();
    const hcat = h.cat.toLowerCase();
    if (gcat === hcat) return true;
    if ((gcat === "fitness" || gcat === "health") && (hcat === "health" || hcat === "fitness")) return true;
    const pairs = [["gym","gym"],["workout","workout"],["morning","morning"],["sleep","sleep"],["read","learn"],["learn","learn"],["protein","nutrition"]];
    return pairs.some(([gkw,hkw]) => gl.includes(gkw) && hl.includes(hkw));
  });
}

/* ── Goal Edit Modal ── */
function GoalEditModal({ goal, onSave, onClose, onDelete }: {
  goal:Goal; onSave:(u:Partial<Goal>)=>void; onClose:()=>void; onDelete?:()=>Promise<boolean>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const [label,s1]=useState(goal.label); const [desc,s2]=useState(goal.desc);
  const [current,s3]=useState(String(goal.current)); const [target,s4]=useState(String(goal.target));
  const [unit,s5]=useState(goal.unit); const [deadline,s6]=useState(goal.deadline);
  const [category,s7]=useState(goal.category); const [color,s8]=useState(goal.colorHex);
  return (
    <div style={{position:"fixed",inset:0,zIndex:100,background:"rgba(0,0,0,0.75)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center"}} onClick={onClose}>
      <div style={{background:"var(--surface)",border:"1px solid var(--border2)",borderRadius:12,padding:"28px 32px",width:480,maxWidth:"92vw",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 24px 80px rgba(0,0,0,0.5)"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24}}>
          <h3 style={{fontSize:16,fontWeight:700,color:"var(--t1)"}}>Edit Goal</h3>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:"var(--t3)",padding:4}}>✕</button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:16,marginBottom:24}}>
          <div><label style={lbl}>Goal Name</label><input value={label} onChange={e=>s1(e.target.value)} style={inp}/></div>
          <div><label style={lbl}>Description</label><textarea value={desc} onChange={e=>s2(e.target.value)} rows={2} style={{...inp,resize:"vertical",fontFamily:"inherit"}}/></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><label style={lbl}>Current Progress</label><input type="number" value={current} onChange={e=>s3(e.target.value)} style={inp}/></div>
            <div><label style={lbl}>Target</label><input type="number" value={target} onChange={e=>s4(e.target.value)} style={inp}/></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><label style={lbl}>Unit</label><input value={unit} onChange={e=>s5(e.target.value)} placeholder="$, weeks, days…" style={inp}/></div>
            <div><label style={lbl}>Deadline</label><input type="date" value={deadline} onChange={e=>s6(e.target.value)} style={{...inp,colorScheme:"dark"}}/></div>
          </div>
          <div><label style={lbl}>Category</label>
            <select value={category} onChange={e=>s7(e.target.value)} style={{...inp,cursor:"pointer"}}>
              {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div><label style={lbl}>Color</label>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {COLORS.map(c=><button key={c} onClick={()=>s8(c)} style={{width:28,height:28,borderRadius:"50%",background:c,border:"none",cursor:"pointer",outline:color===c?`3px solid ${c}`:"none",outlineOffset:2,transition:"all .15s"}}/>)}
            </div>
          </div>
        </div>
        {confirming && onDelete ? (
          <div style={{padding:"14px 16px",borderRadius:6,background:"rgba(200,90,90,0.08)",border:"1px solid rgba(200,90,90,0.3)",marginBottom:12}}>
            <p style={{fontSize:12,color:"var(--t1)",marginBottom:10,lineHeight:1.5}}>Delete <strong>{goal.label}</strong>? This removes the goal and all its notes. This can&apos;t be undone.</p>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setConfirming(false)} disabled={deleting} style={{flex:1,padding:"9px 0",borderRadius:6,fontSize:12,fontWeight:600,cursor:"pointer",background:"transparent",border:"1px solid var(--border2)",color:"var(--t3)"}}>Keep</button>
              <button onClick={async()=>{
                setDeleting(true);
                const ok = await onDelete();
                setDeleting(false);
                if (ok) onClose();
                else setConfirming(false);
              }} disabled={deleting} style={{flex:1,padding:"9px 0",borderRadius:6,fontSize:12,fontWeight:700,cursor:deleting?"default":"pointer",background:"rgba(200,90,90,0.15)",border:"1px solid rgba(200,90,90,0.5)",color:"var(--red)",opacity:deleting?0.6:1}}>
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        ) : null}
        <div style={{display:"flex",gap:10}}>
          {onDelete&&!confirming&&<button onClick={()=>setConfirming(true)} style={{padding:"11px 16px",borderRadius:6,fontSize:13,fontWeight:600,cursor:"pointer",background:"rgba(200,90,90,0.06)",border:"1px solid rgba(200,90,90,0.2)",color:"var(--red)"}}>Delete</button>}
          <button onClick={onClose} style={{flex:1,padding:"11px 0",borderRadius:6,fontSize:13,fontWeight:600,cursor:"pointer",background:"transparent",border:"1px solid var(--border2)",color:"var(--t3)"}}>Cancel</button>
          <button onClick={()=>{onSave({label,desc,category,unit,deadline,colorHex:color,current:parseFloat(current)||0,target:parseFloat(target)||goal.target});onClose();}} style={{flex:2,padding:"11px 0",borderRadius:6,fontSize:13,fontWeight:700,cursor:"pointer",background:"rgba(125,184,232,0.15)",border:"1px solid rgba(125,184,232,0.4)",color:"var(--blue)"}}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}

/* ── Add Goal Modal ── */
function AddGoalModal({ onAdd, onClose }: { onAdd:(g:Goal)=>void; onClose:()=>void }) {
  const [draft, setDraft] = useState<Goal>({id:"",category:"Finance",label:"",desc:"",current:0,target:100,unit:"$",deadline:"2027-01-01",colorHex:"#7DB8E8",milestones:[],subgoals:[]});
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div style={{position:"fixed",inset:0,zIndex:100,background:"rgba(0,0,0,0.75)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center"}} onClick={onClose}>
      <div style={{background:"var(--surface)",border:"1px solid var(--border2)",borderRadius:12,padding:"28px 32px",width:480,maxWidth:"92vw",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 24px 80px rgba(0,0,0,0.5)"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24}}>
          <h3 style={{fontSize:16,fontWeight:700,color:"var(--t1)"}}>New Goal</h3>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:"var(--t3)",padding:4}}>✕</button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:16,marginBottom:24}}>
          <div><label style={lbl}>Goal Name</label><input autoFocus value={draft.label} onChange={e=>setDraft(p=>({...p,label:e.target.value}))} placeholder="e.g. Save $5K for vacation" style={inp}/></div>
          <div><label style={lbl}>Description</label><textarea value={draft.desc} onChange={e=>setDraft(p=>({...p,desc:e.target.value}))} rows={2} placeholder="What this goal means to you…" style={{...inp,resize:"vertical",fontFamily:"inherit"}}/></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><label style={lbl}>Target</label><input type="number" value={draft.target} onChange={e=>setDraft(p=>({...p,target:parseFloat(e.target.value)||0}))} style={inp}/></div>
            <div><label style={lbl}>Unit</label><input value={draft.unit} onChange={e=>setDraft(p=>({...p,unit:e.target.value}))} placeholder="$, weeks, days…" style={inp}/></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><label style={lbl}>Category</label>
              <select value={draft.category} onChange={e=>setDraft(p=>({...p,category:e.target.value}))} style={{...inp,cursor:"pointer"}}>
                {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Deadline</label><input type="date" value={draft.deadline} onChange={e=>setDraft(p=>({...p,deadline:e.target.value}))} style={{...inp,colorScheme:"dark"}}/></div>
          </div>
          <div><label style={lbl}>Color</label>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {COLORS.map(c=><button key={c} onClick={()=>setDraft(p=>({...p,colorHex:c}))} style={{width:28,height:28,borderRadius:"50%",background:c,border:"none",cursor:"pointer",outline:draft.colorHex===c?`3px solid ${c}`:"none",outlineOffset:2,transition:"all .15s"}}/>)}
            </div>
          </div>
        </div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={onClose} style={{flex:1,padding:"11px 0",borderRadius:6,fontSize:13,fontWeight:600,cursor:"pointer",background:"transparent",border:"1px solid var(--border2)",color:"var(--t3)"}}>Cancel</button>
          <button onClick={()=>{
            if(!draft.label.trim()) return;
            const id=draft.label.toLowerCase().replace(/\s+/g,"-").replace(/[^a-z0-9-]/g,"")+"-"+Date.now();
            onAdd({...draft,id}); onClose();
          }} disabled={!draft.label.trim()} style={{flex:2,padding:"11px 0",borderRadius:6,fontSize:13,fontWeight:700,cursor:"pointer",background:"rgba(125,184,232,0.15)",border:"1px solid rgba(125,184,232,0.4)",color:"var(--blue)",opacity:draft.label.trim()?1:0.4}}>Add Goal</button>
        </div>
      </div>
    </div>
  );
}

/* ── Goal Card ── */
function GoalCard({ g, habits, notes, onEdit, onDelete, onNoteAdd, onNoteDelete, onSubgoalToggle }: {
  g: Goal; habits: Habit[]; notes: Note[]; onEdit: ()=>void; onDelete: ()=>Promise<boolean>;
  onNoteAdd: (text:string)=>Promise<void>; onNoteDelete: (id:string)=>Promise<void>; onSubgoalToggle: (idx:number)=>Promise<void>;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [expanded,    setExpanded]    = useState(false);
  const [showJournal, setShowJournal] = useState(false);
  const [noteInput,   setNoteInput]   = useState("");
  const [saving,      setSaving]      = useState(false);

  const pct      = Math.min(100, Math.round((g.current / g.target) * 100));
  const C        = 2 * Math.PI * 28;
  const dash     = C - (pct / 100) * C;
  const status   = getStatus(g);
  const insight  = generateInsight(g);
  const projected = projectedDate(g);
  const deadline = new Date(g.deadline);
  const daysLeft = Math.max(0, Math.floor((deadline.getTime() - Date.now()) / 86400000));
  const linked   = getLinkedHabits(g, habits);
  const subDone  = g.subgoals.filter(s=>s.done).length;
  const dispVal  = g.unit==="$" ? `$${g.current.toLocaleString()} / $${g.target.toLocaleString()}` : `${g.current} / ${g.target} ${g.unit}`;

  async function handleNoteAdd() {
    const t = noteInput.trim();
    if (!t || saving) return;
    setSaving(true);
    await onNoteAdd(t);
    setNoteInput("");
    setSaving(false);
  }

  return (
    <div style={{borderRadius:12,overflow:"hidden",border:`1px solid ${g.colorHex}22`,background:"linear-gradient(180deg, var(--surface) 0%, rgba(5,10,20,0.9) 100%)",boxShadow:`0 4px 40px ${g.colorHex}08`,transition:"box-shadow .2s"}}
      onMouseEnter={e=>(e.currentTarget.style.boxShadow=`0 8px 50px ${g.colorHex}14`)}
      onMouseLeave={e=>(e.currentTarget.style.boxShadow=`0 4px 40px ${g.colorHex}08`)}
    >
      <div style={{height:4,background:`linear-gradient(90deg, ${g.colorHex}, ${g.colorHex}60)`}}/>
      <div style={{padding:"24px 28px"}}>

        {/* Header */}
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
          <span style={{fontSize:10,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:g.colorHex,padding:"3px 8px",borderRadius:4,background:`${g.colorHex}12`,border:`1px solid ${g.colorHex}25`}}>{g.category}</span>
          <span style={{fontSize:10,fontWeight:800,letterSpacing:"0.1em",color:status.color,background:status.bg,padding:"3px 8px",borderRadius:4,border:`1px solid ${status.color}30`}}>{status.label}</span>
          <div style={{flex:1}}/>
          <span style={{fontSize:11,color:"var(--t3)",fontFamily:"monospace"}}>{daysLeft>0?`${daysLeft}d left`:"Overdue"}</span>
          <button onClick={onEdit} style={{background:"transparent",border:"1px solid var(--border)",borderRadius:5,padding:"4px 10px",cursor:"pointer",fontSize:11,color:"var(--t3)",display:"flex",alignItems:"center",gap:5,transition:"all .15s"}}
            onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor=g.colorHex;(e.currentTarget as HTMLElement).style.color=g.colorHex;}}
            onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor="var(--border)";(e.currentTarget as HTMLElement).style.color="var(--t3)";}}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit
          </button>
          <button onClick={()=>setConfirmingDelete(true)} title="Delete goal" style={{background:"transparent",border:"1px solid var(--border)",borderRadius:5,padding:"4px 8px",cursor:"pointer",color:"var(--t3)",display:"flex",alignItems:"center",transition:"all .15s"}}
            onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor="rgba(200,90,90,0.5)";(e.currentTarget as HTMLElement).style.color="var(--red)";}}
            onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor="var(--border)";(e.currentTarget as HTMLElement).style.color="var(--t3)";}}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>

        {/* Inline delete confirmation */}
        {confirmingDelete && (
          <div style={{padding:"10px 14px",borderRadius:6,background:"rgba(200,90,90,0.08)",border:"1px solid rgba(200,90,90,0.3)",marginBottom:12,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
            <span style={{fontSize:12,color:"var(--t1)",flex:1,minWidth:180}}>Delete <strong>{g.label}</strong>? Notes will also be removed.</span>
            <button onClick={()=>setConfirmingDelete(false)} disabled={deleting} style={{padding:"5px 12px",borderRadius:4,fontSize:11,fontWeight:600,cursor:"pointer",background:"transparent",border:"1px solid var(--border2)",color:"var(--t3)"}}>Keep</button>
            <button onClick={async()=>{
              setDeleting(true);
              const ok = await onDelete();
              setDeleting(false);
              if (!ok) setConfirmingDelete(false);
            }} disabled={deleting} style={{padding:"5px 14px",borderRadius:4,fontSize:11,fontWeight:700,cursor:deleting?"default":"pointer",background:"rgba(200,90,90,0.15)",border:"1px solid rgba(200,90,90,0.5)",color:"var(--red)",opacity:deleting?0.6:1}}>
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        )}

        {/* Progress */}
        <div style={{display:"flex",gap:20,alignItems:"flex-start"}}>
          <div style={{flexShrink:0}}>
            <svg width="72" height="72" viewBox="0 0 72 72">
              <circle cx="36" cy="36" r="28" fill="none" stroke={`${g.colorHex}15`} strokeWidth="5"/>
              <circle cx="36" cy="36" r="28" fill="none" stroke={g.colorHex} strokeWidth="5"
                strokeDasharray={C} strokeDashoffset={dash} strokeLinecap="round" transform="rotate(-90 36 36)"
                style={{transition:"stroke-dashoffset 1.2s ease",filter:`drop-shadow(0 0 6px ${g.colorHex}60)`}}/>
              <text x="36" y="40" textAnchor="middle" fontSize="14" fontWeight="900" fill="var(--t1)">{pct}%</text>
            </svg>
          </div>
          <div style={{flex:1,minWidth:0}}>
            <h3 style={{fontSize:20,fontWeight:800,color:"var(--t1)",marginBottom:5,letterSpacing:"-0.01em"}}>{g.label}</h3>
            <p style={{fontSize:13,color:"var(--t3)",lineHeight:1.5,marginBottom:14}}>{g.desc}</p>
            <div style={{height:5,borderRadius:3,background:"var(--border2)",marginBottom:6,overflow:"hidden"}}>
              <div style={{height:"100%",borderRadius:3,width:`${pct||0.5}%`,background:`linear-gradient(90deg,${g.colorHex},${g.colorHex}99)`,transition:"width 1.2s ease",boxShadow:`0 0 8px ${g.colorHex}50`}}/>
            </div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
              <span style={{fontSize:12,fontFamily:"monospace",color:"var(--t2)",fontWeight:600}}>{dispVal}</span>
              {projected&&<span style={{fontSize:11,color:"var(--t3)"}}>Proj: <span style={{color:status.color,fontWeight:600}}>{projected}</span></span>}
            </div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
              {g.milestones.map((m,mi)=>{
                const reached = m.v <= g.current;
                return (
                  <div key={mi} style={{display:"flex",alignItems:"center",gap:5,padding:"4px 10px",borderRadius:20,fontSize:11,fontWeight:600,background:reached?`${g.colorHex}15`:"var(--surface2)",border:`1px solid ${reached?g.colorHex+"40":"var(--border)"}`,color:reached?g.colorHex:"var(--t4)",transition:"all .2s"}}>
                    {reached&&<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg>}
                    {m.l}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* M.A.X. insight */}
        <div style={{padding:"10px 14px",borderRadius:8,background:`${g.colorHex}07`,border:`1px solid ${g.colorHex}15`,marginBottom:14}}>
          <span style={{color:g.colorHex,fontWeight:700,fontSize:11,letterSpacing:"0.05em"}}>M.A.X. · </span>
          <span style={{color:"var(--t2)",fontSize:12,lineHeight:1.6}}>{insight}</span>
        </div>

        {/* Linked habits */}
        {linked.length > 0 && (
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14,flexWrap:"wrap"}}>
            <span style={{fontSize:10,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:"var(--t4)"}}>Linked</span>
            {linked.map(h=>(
              <span key={h.id} style={{display:"flex",alignItems:"center",gap:5,padding:"3px 9px",borderRadius:20,background:`${h.color}10`,border:`1px solid ${h.color}25`,fontSize:11,fontWeight:600,color:h.color}}>
                <span style={{width:5,height:5,borderRadius:"50%",background:h.color,flexShrink:0}}/>
                {h.name}
                {h.streak>0&&<span style={{fontSize:10,color:"var(--t4)"}}>· {h.streak}d</span>}
              </span>
            ))}
          </div>
        )}

        {/* Expand */}
        <button onClick={()=>setExpanded(e=>!e)} style={{display:"flex",alignItems:"center",gap:6,fontSize:12,fontWeight:600,color:"var(--t3)",background:"none",border:"none",cursor:"pointer",padding:0,marginBottom:expanded?16:0,transition:"color .15s"}}
          onMouseEnter={e=>(e.currentTarget.style.color=g.colorHex)}
          onMouseLeave={e=>(e.currentTarget.style.color="var(--t3)")}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{transform:expanded?"rotate(180deg)":"rotate(0deg)",transition:"transform .2s"}}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
          {expanded ? "Hide details" : `Sub-goals (${subDone}/${g.subgoals.length}) · Journal (${notes.length})`}
        </button>

        {expanded && (
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            {/* Sub-goals */}
            {g.subgoals.length > 0 && (
              <div>
                <p style={{fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"var(--t3)",marginBottom:10}}>Sub-goals</p>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {g.subgoals.map((sg,si)=>(
                    <button key={si} onClick={()=>onSubgoalToggle(si)} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"8px 12px",borderRadius:6,background:sg.done?`${g.colorHex}08`:"var(--surface2)",border:`1px solid ${sg.done?g.colorHex+"25":"var(--border)"}`,cursor:"pointer",textAlign:"left",transition:"all .15s"}}>
                      <div style={{width:16,height:16,borderRadius:4,flexShrink:0,marginTop:1,background:sg.done?`${g.colorHex}20`:"transparent",border:`1.5px solid ${sg.done?g.colorHex:"var(--border2)"}`,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s"}}>
                        {sg.done&&<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={g.colorHex} strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg>}
                      </div>
                      <span style={{fontSize:13,color:sg.done?"var(--t1)":"var(--t2)",textDecoration:sg.done?"line-through":"none",opacity:sg.done?0.7:1}}>{sg.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Journal */}
            <div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                <p style={{fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"var(--t3)"}}>Notes / Journal</p>
                <button onClick={()=>setShowJournal(v=>!v)} style={{fontSize:11,color:g.colorHex,background:"none",border:"none",cursor:"pointer",fontWeight:600}}>
                  {showJournal ? "Close" : "+ Add note"}
                </button>
              </div>
              {showJournal && (
                <div style={{display:"flex",gap:8,marginBottom:10}}>
                  <input value={noteInput} onChange={e=>setNoteInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")handleNoteAdd();}}
                    placeholder="Add a note or update…"
                    style={{flex:1,background:"var(--surface2)",border:`1px solid ${g.colorHex}30`,borderRadius:6,padding:"8px 12px",fontSize:13,color:"var(--t1)",outline:"none"}}/>
                  <button onClick={handleNoteAdd} disabled={saving} style={{padding:"8px 16px",borderRadius:6,fontSize:12,fontWeight:700,cursor:"pointer",background:`${g.colorHex}15`,border:`1px solid ${g.colorHex}40`,color:g.colorHex,opacity:saving?0.5:1}}>
                    {saving ? "…" : "Add"}
                  </button>
                </div>
              )}
              {notes.length > 0 ? (
                <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:200,overflowY:"auto"}}>
                  {[...notes].reverse().map(n=>(
                    <div key={n.id} style={{padding:"10px 12px",borderRadius:6,background:"var(--surface2)",border:"1px solid var(--border)",display:"flex",alignItems:"flex-start",gap:8}}>
                      <div style={{flex:1}}>
                        <p style={{fontSize:13,color:"var(--t1)",lineHeight:1.5,marginBottom:4}}>{n.text}</p>
                        <p style={{fontSize:10,color:"var(--t4)",fontFamily:"monospace"}}>
                          {new Date(n.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})} · {new Date(n.created_at).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"})}
                        </p>
                      </div>
                      <button onClick={()=>onNoteDelete(n.id)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--t4)",padding:"2px 4px",fontSize:14,lineHeight:1}}
                        onMouseEnter={e=>(e.currentTarget.style.color="var(--red)")}
                        onMouseLeave={e=>(e.currentTarget.style.color="var(--t4)")}
                      >×</button>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{fontSize:12,color:"var(--t4)",padding:"8px 0"}}>No notes yet.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function GoalsPage() {
  const [goals,     setGoals]     = useState<Goal[]>([]);
  const [habits,    setHabits]    = useState<Habit[]>([]);
  const [notes,     setNotes]     = useState<Note[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [editingId, setEditingId] = useState<string|null>(null);
  const [addModal,  setAddModal]  = useState(false);

  useEffect(()=>{ load(); },[]);

  async function load() {
    const [goalsRes, habitsRes, notesRes] = await Promise.allSettled([
      supabase.from("goals").select("id,label,description,current,target,unit,deadline,color,category,milestones,subgoals").order("category"),
      supabase.from("habits").select("id,name,cat,streak,color"),
      supabase.from("goal_notes").select("id,goal_id,text,created_at").order("created_at"),
    ]);

    const hasFullData = goalsRes.status==="fulfilled" && goalsRes.value.data?.some(r => r.label);

    if (!hasFullData) {
      // Seed defaults (handles both empty DB and old partial rows with no label)
      await supabase.from("goals").upsert(GOALS_SEED.map(g=>({
        id:g.id, label:g.label, description:g.desc, current:g.current, target:g.target,
        unit:g.unit, deadline:g.deadline, color:g.colorHex, category:g.category,
        milestones:g.milestones, subgoals:g.subgoals,
      })));
    }

    // Always reload fresh after potential seed
    const { data: freshGoals } = await supabase
      .from("goals")
      .select("id,label,description,current,target,unit,deadline,color,category,milestones,subgoals")
      .order("category");

    setGoals((freshGoals ?? []).map(r=>({
      id:       String(r.id),
      label:    String(r.label ?? ""),
      desc:     String(r.description ?? ""),
      current:  Number(r.current ?? 0),
      target:   Number(r.target ?? 100),
      unit:     String(r.unit ?? "$"),
      deadline: String(r.deadline ?? "2027-01-01"),
      colorHex: String(r.color ?? "#7DB8E8"),
      category: String(r.category ?? "Personal"),
      milestones: Array.isArray(r.milestones) ? (r.milestones as {l:string;v:number}[]) : [],
      subgoals:   Array.isArray(r.subgoals)   ? (r.subgoals   as {text:string;done:boolean}[]) : [],
    })));

    if (habitsRes.status==="fulfilled" && habitsRes.value.data) {
      setHabits(habitsRes.value.data.map(r=>({
        id:     String(r.id),
        name:   String(r.name ?? ""),
        cat:    String(r.cat  ?? ""),
        streak: Number(r.streak ?? 0),
        color:  String(r.color ?? "#7DB8E8"),
      })));
    }

    if (notesRes.status==="fulfilled" && notesRes.value.data) {
      setNotes(notesRes.value.data.map(r=>({
        id:         String(r.id),
        goal_id:    String(r.goal_id),
        text:       String(r.text ?? ""),
        created_at: String(r.created_at ?? new Date().toISOString()),
      })));
    }

    setLoading(false);
  }

  async function addGoal(g: Goal) {
    setGoals(p=>[...p,g]);
    await supabase.from("goals").insert({
      id:g.id, label:g.label, description:g.desc, current:g.current, target:g.target,
      unit:g.unit, deadline:g.deadline, color:g.colorHex, category:g.category,
      milestones:g.milestones, subgoals:g.subgoals,
    });
  }

  async function saveGoal(id: string, updates: Partial<Goal>) {
    setGoals(p=>p.map(g=>g.id===id?{...g,...updates}:g));
    await supabase.from("goals").update({
      label:updates.label, description:updates.desc, current:updates.current,
      target:updates.target, unit:updates.unit, deadline:updates.deadline,
      color:updates.colorHex, category:updates.category,
    }).eq("id",id);
  }

  async function deleteGoal(id: string) {
    // Snapshot for rollback on failure
    const prevGoals = goals;
    const prevNotes = notes;
    // Optimistic UI
    setGoals(p=>p.filter(g=>g.id!==id));
    setNotes(p=>p.filter(n=>n.goal_id!==id));
    // Delete notes first (FK-safe order), then goal
    const notesRes = await supabase.from("goal_notes").delete().eq("goal_id",id);
    const goalRes  = await supabase.from("goals").delete().eq("id",id);
    if (notesRes.error || goalRes.error) {
      // Rollback — show the user their goal is still there
      setGoals(prevGoals);
      setNotes(prevNotes);
      alert(`Couldn't delete goal: ${(goalRes.error ?? notesRes.error)?.message ?? "unknown error"}`);
      return false;
    }
    return true;
  }

  async function addNote(goalId: string, text: string) {
    const { data } = await supabase
      .from("goal_notes").insert({goal_id:goalId,text,created_at:new Date().toISOString()})
      .select("id,goal_id,text,created_at").single();
    if (data) setNotes(p=>[...p,{id:String(data.id),goal_id:String(data.goal_id),text:String(data.text),created_at:String(data.created_at)}]);
  }

  async function deleteNote(id: string) {
    setNotes(p=>p.filter(n=>n.id!==id));
    await supabase.from("goal_notes").delete().eq("id",id);
  }

  async function toggleSubgoal(goalId: string, idx: number) {
    setGoals(p=>p.map(g=>{
      if (g.id!==goalId) return g;
      const next = g.subgoals.map((s,i)=>i===idx?{...s,done:!s.done}:s);
      supabase.from("goals").update({subgoals:next}).eq("id",goalId);
      return {...g,subgoals:next};
    }));
  }

  const avgPct         = goals.length ? Math.round(goals.reduce((a,g)=>a+Math.min(100,(g.current/g.target)*100),0)/goals.length) : 0;
  const milestonesDone = goals.reduce((acc,g)=>acc+g.milestones.filter(m=>m.v<=g.current).length,0);
  const crushing       = goals.filter(g=>{const s=getStatus(g);return s.label==="CRUSHING IT"||s.label==="COMPLETE";}).length;
  const editingGoal    = goals.find(g=>g.id===editingId);

  if (loading) return (
    <div style={{display:"flex",height:"60vh",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12}}>
      <div style={{display:"flex",gap:6}}>
        {[0,1,2].map(i=><div key={i} style={{width:8,height:8,borderRadius:"50%",background:"var(--blue)",opacity:0.5}}/>)}
      </div>
      <p style={{fontSize:12,color:"var(--t4)"}}>Loading goals…</p>
    </div>
  );

  return (
    <div style={{padding:"40px 52px",background:"var(--bg)",minHeight:"100vh"}}>

      {editingGoal && (
        <GoalEditModal goal={editingGoal} onSave={u=>saveGoal(editingGoal.id,u)} onClose={()=>setEditingId(null)} onDelete={()=>deleteGoal(editingGoal.id)}/>
      )}
      {addModal && <AddGoalModal onAdd={addGoal} onClose={()=>setAddModal(false)}/>}

      <div style={{maxWidth:960}}>

        {/* Header */}
        <div style={{marginBottom:32}}>
          <p style={{fontSize:11,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:"var(--blue)",opacity:0.7,marginBottom:8}}>Goals HQ</p>
          <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between"}}>
            <div>
              <h1 style={{fontSize:36,fontWeight:800,color:"var(--t1)",letterSpacing:"-0.02em",marginBottom:6}}>Your Targets</h1>
              <p style={{fontSize:14,color:"var(--t2)"}}>Every goal tracked. Every milestone visible. No excuses.</p>
            </div>
            <button onClick={()=>setAddModal(true)} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 20px",borderRadius:8,background:"rgba(125,184,232,0.1)",border:"1px solid rgba(125,184,232,0.3)",color:"var(--blue)",fontSize:13,fontWeight:700,cursor:"pointer",transition:"all .15s"}}
              onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background="rgba(125,184,232,0.18)"}
              onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background="rgba(125,184,232,0.1)"}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New Goal
            </button>
          </div>
        </div>

        {/* Stats */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:24}}>
          {[
            {label:"Active Goals",   val:String(goals.length),         color:"var(--blue)",  sub:"being tracked"    },
            {label:"Milestones Hit", val:String(milestonesDone),        color:"var(--green)", sub:"of all milestones"},
            {label:"Avg Progress",   val:`${avgPct}%`,                  color:"var(--amber)", sub:"across all goals" },
            {label:"On Track",       val:`${crushing}/${goals.length}`, color:"var(--green)", sub:"on track or ahead"},
          ].map(s=>(
            <div key={s.label} style={{padding:"18px 20px",borderRadius:10,background:"var(--surface)",border:"1px solid var(--border)"}}>
              <p style={{fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"var(--t3)",marginBottom:8}}>{s.label}</p>
              <p style={{fontSize:24,fontWeight:900,color:s.color,marginBottom:3,fontFamily:"monospace"}}>{s.val}</p>
              <p style={{fontSize:10,color:"var(--t4)"}}>{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Quarterly check-in info */}
        <div style={{padding:"12px 18px",borderRadius:8,background:"rgba(125,184,232,0.05)",border:"1px solid rgba(125,184,232,0.12)",marginBottom:28,display:"flex",alignItems:"center",gap:12}}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <p style={{fontSize:12,color:"var(--t2)"}}>
            <span style={{fontWeight:700,color:"var(--blue)"}}>Quarterly Check-in</span> — M.A.X. reviews your goals on Jan 1, Apr 1, Jul 1 &amp; Oct 1 and sends a full progress report to Telegram.
          </p>
        </div>

        {/* Goal cards */}
        {goals.length === 0 ? (
          <div style={{textAlign:"center",padding:"60px 0"}}>
            <p style={{fontSize:14,color:"var(--t4)",marginBottom:16}}>No goals yet. Set your first target.</p>
            <button onClick={()=>setAddModal(true)} style={{padding:"10px 24px",borderRadius:8,background:"rgba(125,184,232,0.1)",border:"1px solid rgba(125,184,232,0.3)",color:"var(--blue)",fontSize:13,fontWeight:700,cursor:"pointer"}}>Add First Goal</button>
          </div>
        ) : (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
            {goals.map(g=>(
              <GoalCard
                key={g.id} g={g} habits={habits}
                notes={notes.filter(n=>n.goal_id===g.id)}
                onEdit={()=>setEditingId(g.id)}
                onDelete={()=>deleteGoal(g.id)}
                onNoteAdd={text=>addNote(g.id,text)}
                onNoteDelete={deleteNote}
                onSubgoalToggle={idx=>toggleSubgoal(g.id,idx)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
