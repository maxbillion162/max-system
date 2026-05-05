"use client";
// v2
import { useState, useEffect, useCallback } from "react";
import { HudCard } from "@/components/ui/HudCard";
import { supabase } from "@/lib/supabase";
import { dbWrite } from "@/lib/db-client";

/* ── Types ── */
interface Habit {
  id: string; label: string; cat: string; color: string; best: number;
}
interface PPLDay { name: string; detail: string; color: string; days: string }
interface Achievement {
  id: string; icon: string; label: string; desc: string;
  earned: boolean; progress?: string;
}

/* ── Constants ── */
const CATS   = ["Morning","Health","Nutrition","Learning","Sleep","Mindset","Work","Other"];
const COLORS = ["#7DB8E8","#5FB07D","#C85A5A","#9B8AFB","#9B8AFB","#7DB8E8","#C85A5A","#C85A5A"];
const PPL_DEFAULT: PPLDay[] = [
  { name:"Push", detail:"Chest · Triceps · Shoulders", color:"#7DB8E8", days:"Mon / Thu" },
  { name:"Pull", detail:"Back · Biceps",               color:"#5FB07D", days:"Tue / Fri" },
  { name:"Legs", detail:"Quads · Hamstrings · Glutes", color:"#9B8AFB", days:"Wed / Sat" },
];
const LEVEL_DEFS = [
  { name:"Recruit",     min:0,  max:6,   color:"var(--t3)",    glow:"rgba(148,163,184,0.3)"  },
  { name:"Consistent",  min:7,  max:20,  color:"var(--blue)",   glow:"rgba(125,184,232,0.4)"  },
  { name:"Machine",     min:21, max:59,  color:"var(--amber)",  glow:"rgba(200,90,90,0.4)"  },
  { name:"Untouchable", min:60, max:Infinity, color:"var(--green)", glow:"rgba(95,176,125,0.4)" },
];
const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

/* ── Helpers ── */
function getLast30Days(): string[] {
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (29 - i));
    return d.toISOString().slice(0, 10);
  });
}
function todayStr() { return new Date().toISOString().slice(0, 10); }

function computeStreak(habitId: string, completedDates: Map<string, Set<string>>): number {
  const dates = completedDates.get(habitId);
  if (!dates) return 0;
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    if (dates.has(d.toISOString().slice(0, 10))) streak++;
    else break;
  }
  return streak;
}

function getLevel(best: number) {
  return [...LEVEL_DEFS].reverse().find(l => best >= l.min) ?? LEVEL_DEFS[0];
}

function getLevelProgress(best: number) {
  const lvl = getLevel(best);
  const idx  = LEVEL_DEFS.indexOf(lvl);
  const next = LEVEL_DEFS[idx + 1];
  if (!next) return 1;
  return (best - lvl.min) / (next.min - lvl.min);
}

function getTodaySession(ppl: PPLDay[]): PPLDay | null {
  const dayName = DAY_NAMES[new Date().getDay()];
  return ppl.find(p => p.days.includes(dayName)) ?? null;
}

function computeAchievements(
  habits: Habit[],
  completedDates: Map<string, Set<string>>,
  best: number
): Achievement[] {
  const totalLogs = Array.from(completedDates.values()).reduce((s, d) => s + d.size, 0);
  const last30 = getLast30Days();
  const last7  = last30.slice(-7);
  const hadPerfectWeek = habits.length > 0 && last7.every(date =>
    habits.every(h => completedDates.get(h.id)?.has(date))
  );

  // Comeback: completed after a 3+ day gap (check last 30 days)
  let hadComeback = false;
  for (const habit of habits) {
    const dates = completedDates.get(habit.id);
    if (!dates) continue;
    for (let i = 1; i < last30.length; i++) {
      const prev3Miss = !dates.has(last30[i-1]) && (i < 2 || !dates.has(last30[i-2])) && (i < 3 || !dates.has(last30[i-3]));
      if (prev3Miss && dates.has(last30[i])) { hadComeback = true; break; }
    }
    if (hadComeback) break;
  }

  return [
    { id:"first_week",   icon:"⭐", label:"First Week",   desc:"Any habit · 7 days straight",  earned:best>=7,   progress:best<7?`${best}/7`:undefined },
    { id:"iron_will",    icon:"⚡", label:"Iron Will",    desc:"Any habit · 30 days straight",  earned:best>=30,  progress:best<30?`${Math.min(best,29)}/30`:undefined },
    { id:"centurion",    icon:"💯", label:"Centurion",    desc:"100 total completions",          earned:totalLogs>=100, progress:totalLogs<100?`${totalLogs}/100`:undefined },
    { id:"perfect_week", icon:"🏆", label:"Perfect Week", desc:"All habits done · 7 days",      earned:hadPerfectWeek },
    { id:"comeback",     icon:"💪", label:"Comeback",     desc:"Complete after a 3+ day gap",   earned:hadComeback },
  ];
}

/* ── Habit Modal ── */
function HabitModal({ habit, onSave, onClose, onDelete }: {
  habit: Habit | null;
  onSave: (h: Omit<Habit, "best">) => void;
  onClose: () => void;
  onDelete?: () => void;
}) {
  const isNew = !habit;
  const [label, setLabel] = useState(habit?.label ?? "");
  const [cat,   setCat]   = useState(habit?.cat   ?? "Health");
  const [color, setColor] = useState(habit?.color ?? "#7DB8E8");

  function save() {
    if (!label.trim()) return;
    onSave({ id: habit?.id ?? `h${Date.now()}`, label: label.trim(), cat, color });
    onClose();
  }

  return (
    <div style={{ position:"fixed",inset:0,zIndex:100,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center" }} onClick={onClose}>
      <div style={{ background:"var(--surface)",border:"1px solid var(--border2)",borderRadius:12,padding:"28px 32px",width:420,boxShadow:"0 24px 80px rgba(0,0,0,0.5)" }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24 }}>
          <h3 style={{ fontSize:16,fontWeight:700,color:"var(--t1)" }}>{isNew?"Add Habit":"Edit Habit"}</h3>
          <button onClick={onClose} style={{ background:"none",border:"none",cursor:"pointer",color:"var(--t3)",padding:4 }}>✕</button>
        </div>
        <div style={{ display:"flex",flexDirection:"column",gap:18,marginBottom:28 }}>
          <div>
            <label style={{ fontSize:11,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"var(--t3)",display:"block",marginBottom:6 }}>Habit Name</label>
            <input autoFocus value={label} onChange={e=>setLabel(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")save();if(e.key==="Escape")onClose();}} placeholder="e.g. Gym session"
              style={{ width:"100%",background:"var(--surface2)",border:"1px solid var(--border2)",borderRadius:6,padding:"10px 12px",color:"var(--t1)",fontSize:14,fontWeight:600,outline:"none",boxSizing:"border-box" }}
              onFocus={e=>(e.target.style.borderColor="var(--blue)")} onBlur={e=>(e.target.style.borderColor="var(--border2)")}
            />
          </div>
          <div>
            <label style={{ fontSize:11,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"var(--t3)",display:"block",marginBottom:6 }}>Category</label>
            <select value={cat} onChange={e=>setCat(e.target.value)} style={{ width:"100%",background:"var(--surface2)",border:"1px solid var(--border2)",borderRadius:6,padding:"10px 12px",color:"var(--t1)",fontSize:13,outline:"none",boxSizing:"border-box",cursor:"pointer" }}>
              {CATS.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize:11,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"var(--t3)",display:"block",marginBottom:8 }}>Color</label>
            <div style={{ display:"flex",gap:8 }}>
              {COLORS.map(c=>(
                <button key={c} onClick={()=>setColor(c)} style={{ width:28,height:28,borderRadius:6,background:c,border:"none",cursor:"pointer",outline:color===c?`2px solid ${c}`:"2px solid transparent",outlineOffset:2,transform:color===c?"scale(1.15)":"scale(1)",transition:"all .15s" }}/>
              ))}
            </div>
          </div>
        </div>
        <div style={{ display:"flex",gap:10 }}>
          {!isNew&&onDelete&&<button onClick={()=>{onDelete();onClose();}} style={{ padding:"11px 16px",borderRadius:6,fontSize:13,fontWeight:600,cursor:"pointer",background:"rgba(200,90,90,0.06)",border:"1px solid rgba(200,90,90,0.2)",color:"var(--red)" }}>Delete</button>}
          <button onClick={onClose} style={{ flex:1,padding:"11px 0",borderRadius:6,fontSize:13,fontWeight:600,cursor:"pointer",background:"transparent",border:"1px solid var(--border2)",color:"var(--t3)" }}>Cancel</button>
          <button onClick={save} disabled={!label.trim()} style={{ flex:2,padding:"11px 0",borderRadius:6,fontSize:13,fontWeight:700,cursor:"pointer",background:"rgba(125,184,232,0.15)",border:"1px solid rgba(125,184,232,0.4)",color:"var(--blue)",opacity:label.trim()?1:0.4 }}>Save</button>
        </div>
      </div>
    </div>
  );
}

/* ── PPL Modal ── */
function PPLModal({ splits, onSave, onClose }: { splits: PPLDay[]; onSave:(s:PPLDay[])=>void; onClose:()=>void }) {
  const [draft, setDraft] = useState(splits.map(s=>({...s})));
  function up(i: number, k: keyof PPLDay, v: string) { setDraft(p=>p.map((s,j)=>j===i?{...s,[k]:v}:s)); }
  return (
    <div style={{ position:"fixed",inset:0,zIndex:100,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center" }} onClick={onClose}>
      <div style={{ background:"var(--surface)",border:"1px solid var(--border2)",borderRadius:12,padding:"28px 32px",width:460,boxShadow:"0 24px 80px rgba(0,0,0,0.5)" }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24 }}>
          <h3 style={{ fontSize:16,fontWeight:700,color:"var(--t1)" }}>Edit Workout Split</h3>
          <button onClick={onClose} style={{ background:"none",border:"none",cursor:"pointer",color:"var(--t3)",padding:4 }}>✕</button>
        </div>
        <div style={{ display:"flex",flexDirection:"column",gap:16,marginBottom:28 }}>
          {draft.map((s,i)=>(
            <div key={i} style={{ padding:"16px 18px",borderRadius:8,background:"var(--surface2)",border:`1px solid ${s.color}22` }}>
              <div style={{ fontSize:11,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:s.color,marginBottom:10 }}>{s.name}</div>
              {(["detail","days"] as const).map(k=>(
                <div key={k} style={{ marginBottom:8 }}>
                  <label style={{ fontSize:10,color:"var(--t3)",display:"block",marginBottom:3 }}>{k==="detail"?"Muscle Groups":"Schedule"}</label>
                  <input value={s[k]} onChange={e=>up(i,k,e.target.value)} style={{ width:"100%",background:"var(--bg)",border:"1px solid var(--border2)",borderRadius:5,padding:"7px 10px",color:"var(--t1)",fontSize:12,outline:"none",boxSizing:"border-box" }}/>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ display:"flex",gap:10 }}>
          <button onClick={onClose} style={{ flex:1,padding:"11px 0",borderRadius:6,fontSize:13,fontWeight:600,cursor:"pointer",background:"transparent",border:"1px solid var(--border2)",color:"var(--t3)" }}>Cancel</button>
          <button onClick={()=>{onSave(draft);onClose();}} style={{ flex:2,padding:"11px 0",borderRadius:6,fontSize:13,fontWeight:700,cursor:"pointer",background:"rgba(125,184,232,0.15)",border:"1px solid rgba(125,184,232,0.4)",color:"var(--blue)" }}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function HabitsPage() {
  const [habits,        setHabits]        = useState<Habit[]>([]);
  const [completedDates,setCompletedDates]= useState<Map<string,Set<string>>>(new Map());
  const [streaks,       setStreaks]        = useState<Record<string,number>>({});
  const [shields,       setShields]        = useState(0);
  const [ppl,           setPpl]            = useState<PPLDay[]>(PPL_DEFAULT);
  const [loading,       setLoading]        = useState(true);
  const [modalHabit,    setModalHabit]     = useState<Habit|"new"|null>(null);
  const [pplModal,      setPplModal]       = useState(false);

  const today    = todayStr();
  const last30   = getLast30Days();

  /* ── Load data ── */
  useEffect(()=>{
    async function load() {
      const [habitsRes, logsRes, settingsRes] = await Promise.allSettled([
        supabase.from("habits").select("id,name,cat,color,best").order("cat"),
        supabase.from("habit_logs").select("habit_id,date,completed").gte("date", last30[0]).eq("completed",true),
        supabase.from("settings").select("value").in("key",["habit_shields","ppl_split"]),
      ]);

      // Habits
      if (habitsRes.status==="fulfilled"&&habitsRes.value.data?.length) {
        setHabits(habitsRes.value.data.map(r=>({
          id:    String(r.id),
          label: r.name ?? "",
          cat:   r.cat  ?? "General",
          color: r.color?? "#7DB8E8",
          best:  r.best ?? 0,
        })));
      }

      // Habit logs → completedDates map
      if (logsRes.status==="fulfilled"&&logsRes.value.data) {
        const map = new Map<string,Set<string>>();
        for (const log of logsRes.value.data) {
          if (!map.has(log.habit_id)) map.set(log.habit_id, new Set());
          map.get(log.habit_id)!.add(log.date);
        }
        setCompletedDates(map);
      }

      // Settings
      if (settingsRes.status==="fulfilled"&&settingsRes.value.data) {
        for (const row of settingsRes.value.data as { value: { shields?:number; splits?:PPLDay[] } }[]) {
          if (row.value?.shields !== undefined) setShields(row.value.shields);
          if (row.value?.splits)                setPpl(row.value.splits);
        }
      }

      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  /* ── Recompute streaks whenever completedDates or habits change ── */
  useEffect(()=>{
    const s: Record<string,number> = {};
    for (const h of habits) s[h.id] = computeStreak(h.id, completedDates);
    setStreaks(s);
  },[completedDates, habits]);

  /* ── Toggle habit ── */
  const toggle = useCallback(async (habitId: string)=>{
    const wasDone = completedDates.get(habitId)?.has(today) ?? false;
    const nowDone = !wasDone;

    // Update local state
    setCompletedDates(prev=>{
      const next = new Map(prev);
      const dates = new Set(next.get(habitId) ?? []);
      if (nowDone) dates.add(today); else dates.delete(today);
      next.set(habitId, dates);
      return next;
    });

    // Persist
    if (nowDone) {
      await dbWrite.from("habit_logs").upsert({ habit_id:habitId, date:today, completed:true });
    } else {
      await dbWrite.from("habit_logs").update({ completed:false }).eq("habit_id",habitId).eq("date",today);
    }

    // Update streak + completed in habits table
    const newStreak = computeStreak(habitId, (() => {
      const tmp = new Map(completedDates);
      const d = new Set(tmp.get(habitId) ?? []);
      if (nowDone) d.add(today); else d.delete(today);
      tmp.set(habitId, d); return tmp;
    })());
    const habit = habits.find(h=>h.id===habitId);
    const newBest = Math.max(habit?.best??0, newStreak);
    setHabits(prev=>prev.map(h=>h.id===habitId?{...h,best:newBest}:h));
    await dbWrite.from("habits").update({ completed:nowDone, streak:newStreak, best:newBest }).eq("id",habitId);

    // Check for perfect day → award shield if all done
    // (done after state updates settle via effect)
  },[completedDates, habits, today]);

  /* ── Save habit ── */
  async function saveHabit(h: Omit<Habit,"best">) {
    const exists = habits.find(x=>x.id===h.id);
    const full: Habit = { ...h, best: exists?.best ?? 0 };
    if (exists) {
      setHabits(prev=>prev.map(x=>x.id===h.id?full:x));
      await dbWrite.from("habits").update({ name:h.label, cat:h.cat, color:h.color }).eq("id",h.id);
    } else {
      setHabits(prev=>[...prev,full]);
      await dbWrite.from("habits").insert({ id:h.id, name:h.label, cat:h.cat, color:h.color, completed:false, streak:0, best:0, updated_at:new Date().toISOString() });
    }
  }

  async function deleteHabit(id: string) {
    setHabits(prev=>prev.filter(h=>h.id!==id));
    await dbWrite.from("habits").delete().eq("id",id);
    await dbWrite.from("habit_logs").delete().eq("habit_id",id);
  }

  async function savePpl(splits: PPLDay[]) {
    setPpl(splits);
    await dbWrite.from("settings").upsert({ key:"ppl_split", value:{ splits } });
  }

  async function useShield(habitId: string) {
    if (shields <= 0) return;
    // Add yesterday to the habit's completedDates so streak is preserved
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate()-1);
    const yStr = yesterday.toISOString().slice(0,10);
    setCompletedDates(prev=>{
      const next = new Map(prev);
      const dates = new Set(next.get(habitId) ?? []);
      dates.add(yStr);
      next.set(habitId, dates);
      return next;
    });
    const newShields = shields - 1;
    setShields(newShields);
    await dbWrite.from("habit_logs").upsert({ habit_id:habitId, date:yStr, completed:true });
    await dbWrite.from("settings").upsert({ key:"habit_shields", value:{ shields:newShields } });
  }

  /* ── Derived stats ── */
  const todayDone   = habits.filter(h=>completedDates.get(h.id)?.has(today)).length;
  const todayTotal  = habits.length;
  const todayPct    = todayTotal>0?Math.round((todayDone/todayTotal)*100):0;
  const overallBest = Math.max(0,...habits.map(h=>h.best));
  const level       = getLevel(overallBest);
  const levelProg   = getLevelProgress(overallBest);
  const nextLevel   = LEVEL_DEFS[LEVEL_DEFS.indexOf(level)+1];
  const recentXP    = Array.from(completedDates.values()).reduce((s,d)=>s+d.size,0) * 10;

  const todaySession = getTodaySession(ppl);
  const achievements = computeAchievements(habits, completedDates, overallBest);
  const weekRate     = last30.slice(-7).reduce((sum,date)=>{
    const done = habits.filter(h=>completedDates.get(h.id)?.has(date)).length;
    return sum+(todayTotal>0?done/todayTotal:0);
  },0)/7;

  /* ── Category breakdown (last 30 days) ── */
  const catMap: Record<string,{done:number;total:number;color:string}> = {};
  for (const h of habits) {
    if (!catMap[h.cat]) catMap[h.cat] = {done:0,total:0,color:h.color};
    catMap[h.cat].total += 30;
    catMap[h.cat].done  += (completedDates.get(h.id)?.size ?? 0);
  }
  const cats = Object.entries(catMap).sort((a,b)=>(b[1].done/b[1].total)-(a[1].done/a[1].total));

  /* ── Grouped habits ── */
  const grouped: Record<string,Habit[]> = {};
  for (const h of habits) {
    if (!grouped[h.cat]) grouped[h.cat] = [];
    grouped[h.cat].push(h);
  }

  const C    = 2*Math.PI*44;
  const dash = C-(todayPct/100)*C;

  if (loading) return (
    <div style={{ display:"flex",height:"60vh",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12 }}>
      <div style={{ display:"flex",gap:6 }}>
        {[0,1,2].map(i=><div key={i} style={{ width:8,height:8,borderRadius:"50%",background:"var(--blue)",opacity:0.5,animation:`bounce 0.8s ease-in-out ${i*0.18}s infinite` }}/>)}
      </div>
      <p style={{ fontSize:12,color:"var(--t4)" }}>Loading habits…</p>
    </div>
  );

  return (
    <div style={{ padding:"28px 36px",background:"var(--bg)",minHeight:"100vh" }}>

      {/* Modals */}
      {modalHabit!==null&&(
        <HabitModal
          habit={modalHabit==="new"?null:modalHabit}
          onSave={saveHabit}
          onClose={()=>setModalHabit(null)}
          onDelete={modalHabit!=="new"?(()=>deleteHabit((modalHabit as Habit).id)):undefined}
        />
      )}
      {pplModal&&<PPLModal splits={ppl} onSave={savePpl} onClose={()=>setPplModal(false)}/>}

      {/* Header */}
      <div style={{ marginBottom:24 }}>
        <p style={{ fontSize:11,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:"var(--t3)",marginBottom:6 }}>Habits & Training</p>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
          <h1 style={{ fontSize:28,fontWeight:800,color:"var(--t1)",letterSpacing:"-0.02em" }}>Daily Discipline</h1>
          <button onClick={()=>setModalHabit("new")} style={{ display:"flex",alignItems:"center",gap:6,padding:"9px 16px",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:700,background:"rgba(125,184,232,0.1)",border:"1px solid rgba(125,184,232,0.25)",color:"var(--blue)" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>Add Habit
          </button>
        </div>
      </div>

      {/* ── TOP ROW ── */}
      <div style={{ display:"grid",gridTemplateColumns:"220px 1fr 1fr",gap:14,marginBottom:14 }}>

        {/* Today's Ring */}
        <HudCard style={{ padding:"20px 24px",display:"flex",alignItems:"center",gap:16 }}>
          <svg width="96" height="96" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(125,184,232,0.07)" strokeWidth="6"/>
            <circle cx="50" cy="50" r="44" fill="none"
              stroke={todayPct===100?"var(--green)":"var(--blue)"} strokeWidth="6"
              strokeDasharray={C} strokeDashoffset={dash} strokeLinecap="round"
              transform="rotate(-90 50 50)"
              style={{ filter:`drop-shadow(0 0 8px ${todayPct===100?"var(--green)":"var(--blue)"})`,transition:"stroke-dashoffset .6s ease" }}
            />
            <text x="50" y="46" textAnchor="middle" fontSize="22" fontWeight="900" fill="var(--t1)">{todayDone}</text>
            <text x="50" y="62" textAnchor="middle" fontSize="11" fill="var(--t3)">of {todayTotal}</text>
          </svg>
          <div>
            <p style={{ fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"var(--t3)",marginBottom:4 }}>Today</p>
            <p style={{ fontSize:22,fontWeight:800,color:todayPct===100?"var(--green)":"var(--t1)" }}>{todayPct}%</p>
            <p style={{ fontSize:11,color:"var(--t3)",marginTop:2 }}>{todayPct===100?"Perfect day!":todayTotal-todayDone>0?`${todayTotal-todayDone} left`:"No habits yet"}</p>
            <p style={{ fontSize:11,color:"var(--t3)",marginTop:4 }}>7-day avg: <span style={{ color:"var(--t2)",fontWeight:600 }}>{Math.round(weekRate*100)}%</span></p>
          </div>
        </HudCard>

        {/* Level / XP */}
        <HudCard style={{ padding:"20px 24px" }}>
          <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:12 }}>
            <div>
              <p style={{ fontSize:10,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:"var(--t3)",marginBottom:4 }}>Level</p>
              <p style={{ fontSize:22,fontWeight:900,color:level.color,letterSpacing:"-0.01em",textShadow:`0 0 20px ${level.glow}` }}>{level.name.toUpperCase()}</p>
            </div>
            <div style={{ textAlign:"right" }}>
              <p style={{ fontSize:10,color:"var(--t3)",fontWeight:600,marginBottom:2 }}>Recent XP</p>
              <p style={{ fontSize:18,fontWeight:800,color:"var(--t2)",fontFamily:"monospace" }}>{recentXP.toLocaleString()}</p>
            </div>
          </div>
          <div style={{ marginBottom:8 }}>
            <div style={{ height:6,borderRadius:3,background:"var(--surface2)",overflow:"hidden" }}>
              <div style={{ height:"100%",borderRadius:3,width:`${levelProg*100}%`,background:level.color,boxShadow:`0 0 8px ${level.glow}`,transition:"width .8s ease" }}/>
            </div>
          </div>
          <div style={{ display:"flex",justifyContent:"space-between",marginBottom:10 }}>
            {LEVEL_DEFS.map((l,i)=>(
              <span key={l.name} style={{ fontSize:9,fontWeight:700,letterSpacing:"0.06em",color:l.name===level.name?l.color:"var(--t4)",textTransform:"uppercase" }}>
                {i < LEVEL_DEFS.indexOf(level) ? "✓ " : ""}{l.name}
              </span>
            ))}
          </div>
          <div style={{ display:"flex",alignItems:"center",gap:6 }}>
            <span style={{ fontSize:11,color:"var(--t4)" }}>Best streak:</span>
            <span style={{ fontSize:13,fontWeight:700,color:level.color }}>{overallBest}d</span>
            {nextLevel&&<span style={{ fontSize:11,color:"var(--t4)",marginLeft:"auto" }}>{nextLevel.min - overallBest}d to {nextLevel.name}</span>}
          </div>
        </HudCard>

        {/* Today's Session + Shields */}
        <HudCard style={{ padding:"20px 24px" }}>
          {todaySession ? (
            <>
              <p style={{ fontSize:10,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:"var(--t3)",marginBottom:10 }}>Today's Session</p>
              <div style={{ padding:"14px 16px",borderRadius:8,background:`${todaySession.color}08`,border:`1px solid ${todaySession.color}20`,marginBottom:14 }}>
                <p style={{ fontSize:22,fontWeight:900,color:todaySession.color,marginBottom:4,textShadow:`0 0 16px ${todaySession.color}60` }}>{todaySession.name}</p>
                <p style={{ fontSize:12,color:"var(--t2)" }}>{todaySession.detail}</p>
              </div>
            </>
          ) : (
            <>
              <p style={{ fontSize:10,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:"var(--t3)",marginBottom:10 }}>Today's Session</p>
              <p style={{ fontSize:18,fontWeight:800,color:"var(--t3)",marginBottom:14 }}>Rest Day</p>
            </>
          )}
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
            <div>
              <p style={{ fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"var(--t3)",marginBottom:5 }}>Streak Shields</p>
              <div style={{ display:"flex",gap:4,alignItems:"center" }}>
                {Array.from({length:3},(_,i)=>(
                  <span key={i} style={{ fontSize:18,opacity:i<shields?1:0.2,filter:i<shields?"drop-shadow(0 0 4px rgba(200,90,90,0.6))":"none" }}>🛡</span>
                ))}
                <span style={{ fontSize:11,color:"var(--t4)",marginLeft:4 }}>{shields}/3</span>
              </div>
            </div>
            <button onClick={()=>setPplModal(true)} style={{ fontSize:10,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:"var(--t4)",background:"none",border:"1px solid var(--border2)",borderRadius:5,padding:"5px 10px",cursor:"pointer",transition:"all .15s" }}
              onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor="var(--blue)";(e.currentTarget as HTMLElement).style.color="var(--blue)";}}
              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor="var(--border2)";(e.currentTarget as HTMLElement).style.color="var(--t4)";}}
            >Edit Split</button>
          </div>
          <p style={{ fontSize:10,color:"var(--t4)",marginTop:6 }}>Earn 1 per perfect week · protects a broken streak</p>
        </HudCard>
      </div>

      {/* ── ACHIEVEMENTS ── */}
      <HudCard style={{ padding:"18px 24px",marginBottom:14 }}>
        <p style={{ fontSize:10,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:"var(--t3)",marginBottom:14 }}>Achievements</p>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10 }}>
          {achievements.map(a=>(
            <div key={a.id} style={{ padding:"14px 12px",borderRadius:10,textAlign:"center",background:a.earned?"var(--surface2)":"transparent",border:`1px solid ${a.earned?"var(--border2)":"var(--border)"}`,opacity:a.earned?1:0.45,transition:"all .2s" }}>
              <div style={{ fontSize:24,marginBottom:6,filter:a.earned?"drop-shadow(0 0 8px rgba(200,90,90,0.5))":"none" }}>{a.icon}</div>
              <p style={{ fontSize:11,fontWeight:700,color:"var(--t1)",marginBottom:3 }}>{a.label}</p>
              <p style={{ fontSize:9,color:"var(--t4)",lineHeight:1.4 }}>{a.desc}</p>
              {a.progress&&!a.earned&&<p style={{ fontSize:10,fontWeight:700,color:"var(--blue)",marginTop:5 }}>{a.progress}</p>}
              {a.earned&&<p style={{ fontSize:9,fontWeight:700,color:"var(--green)",marginTop:5 }}>EARNED</p>}
            </div>
          ))}
        </div>
      </HudCard>

      {/* ── HABITS LIST ── */}
      <HudCard style={{ overflow:"hidden",marginBottom:14 }}>
        {/* Header */}
        <div style={{ display:"grid",gridTemplateColumns:"200px 1fr 80px 44px 36px",padding:"10px 20px",fontSize:9,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:"var(--t3)",background:"rgba(125,184,232,0.03)",borderBottom:"1px solid var(--border)" }}>
          <div>Habit</div>
          <div>Last 30 Days</div>
          <div style={{ textAlign:"center" }}>Streak</div>
          <div style={{ textAlign:"center" }}>Today</div>
          <div/>
        </div>

        {habits.length===0&&(
          <div style={{ padding:"32px 20px",textAlign:"center" }}>
            <p style={{ fontSize:13,color:"var(--t4)",marginBottom:12 }}>No habits yet.</p>
            <button onClick={()=>setModalHabit("new")} style={{ padding:"8px 20px",borderRadius:7,cursor:"pointer",fontSize:12,fontWeight:700,background:"rgba(125,184,232,0.1)",border:"1px solid rgba(125,184,232,0.25)",color:"var(--blue)" }}>Add your first habit</button>
          </div>
        )}

        {Object.entries(grouped).map(([cat,hs])=>(
          <div key={cat}>
            <div style={{ padding:"7px 20px",fontSize:9,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:"var(--t3)",background:"var(--surface2)",borderBottom:"1px solid var(--border)" }}>{cat}</div>
            {hs.map((habit,i)=>{
              const isDone   = completedDates.get(habit.id)?.has(today) ?? false;
              const streak   = streaks[habit.id] ?? 0;
              const isLast   = i===hs.length-1;
              // Streak at risk = streak > 0 and yesterday not done
              const yesterday = new Date(); yesterday.setDate(yesterday.getDate()-1);
              const yStr = yesterday.toISOString().slice(0,10);
              const atRisk = streak>0 && !isDone && !(completedDates.get(habit.id)?.has(yStr));

              return (
                <div key={habit.id} style={{ display:"grid",gridTemplateColumns:"200px 1fr 80px 44px 36px",padding:"12px 20px",alignItems:"center",borderBottom:isLast?"none":"1px solid var(--border)",transition:"background .12s" }}
                  onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background="rgba(255,255,255,0.015)"}
                  onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background="transparent"}
                >
                  {/* Name */}
                  <div style={{ display:"flex",alignItems:"center",gap:8,minWidth:0 }}>
                    <span style={{ width:8,height:8,borderRadius:"50%",background:habit.color,boxShadow:`0 0 5px ${habit.color}`,flexShrink:0 }}/>
                    <div>
                      <p style={{ fontSize:13,fontWeight:600,color:"var(--t1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:150 }}>{habit.label}</p>
                      {atRisk&&shields>0&&(
                        <button onClick={()=>useShield(habit.id)} style={{ fontSize:9,fontWeight:700,color:"var(--amber)",background:"none",border:"1px solid rgba(200,90,90,0.3)",borderRadius:4,padding:"2px 6px",cursor:"pointer",marginTop:2 }}>🛡 Use Shield</button>
                      )}
                    </div>
                  </div>

                  {/* 30-day heatmap */}
                  <div style={{ display:"flex",gap:2,alignItems:"center",flexWrap:"nowrap",overflow:"hidden" }}>
                    {last30.map((date,di)=>{
                      const done = completedDates.get(habit.id)?.has(date) ?? false;
                      const isT  = date===today;
                      return (
                        <div key={di} title={date} style={{
                          width:9,height:9,borderRadius:2,flexShrink:0,
                          background:done?habit.color:"var(--surface2)",
                          opacity:done?1:0.3,
                          boxShadow:done&&isT?`0 0 6px ${habit.color}`:undefined,
                          border:isT?`1px solid ${habit.color}40`:"none",
                          transition:"background .15s",
                        }}/>
                      );
                    })}
                  </div>

                  {/* Streak */}
                  <div style={{ textAlign:"center" }}>
                    {streak>0
                      ? <span style={{ fontSize:13,fontWeight:700,color:streak>=7?"var(--amber)":"var(--t2)" }}>
                          {streak>=7?"🔥 ":""}{streak}d
                        </span>
                      : <span style={{ fontSize:13,color:"var(--t4)" }}>—</span>
                    }
                  </div>

                  {/* Toggle */}
                  <div style={{ display:"flex",justifyContent:"center" }}>
                    <button onClick={()=>toggle(habit.id)} style={{ width:30,height:30,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",background:isDone?`${habit.color}18`:"rgba(255,255,255,0.03)",border:`1.5px solid ${isDone?habit.color+"60":"rgba(255,255,255,0.08)"}`,boxShadow:isDone?`0 0 10px ${habit.color}30`:"none",transition:"all .15s" }}>
                      {isDone&&<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={habit.color} strokeWidth="3.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                    </button>
                  </div>

                  {/* Edit */}
                  <div style={{ display:"flex",justifyContent:"center" }}>
                    <button onClick={()=>setModalHabit(habit)} style={{ background:"none",border:"1px solid var(--border)",borderRadius:5,padding:"4px 6px",cursor:"pointer",color:"var(--t3)",fontSize:11,transition:"all .15s" }}
                      onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor="var(--blue)";(e.currentTarget as HTMLElement).style.color="var(--blue)";}}
                      onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor="var(--border)";(e.currentTarget as HTMLElement).style.color="var(--t3)";}}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                  </div>
                </div>
              );
            })}
            <div style={{ borderBottom:"1px solid var(--border)" }}/>
          </div>
        ))}

        {/* Add row */}
        <div style={{ padding:"12px 20px" }}>
          <button onClick={()=>setModalHabit("new")} style={{ width:"100%",background:"none",border:"1px dashed var(--border2)",borderRadius:6,padding:"9px",cursor:"pointer",color:"var(--t3)",fontSize:12,fontWeight:600,transition:"all .15s" }}
            onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor="var(--blue)";(e.currentTarget as HTMLElement).style.color="var(--blue)";}}
            onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor="var(--border2)";(e.currentTarget as HTMLElement).style.color="var(--t3)";}}
          >+ Add Habit</button>
        </div>
      </HudCard>

      {/* ── BOTTOM ROW ── */}
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14 }}>

        {/* Category Performance (30-day) */}
        <HudCard style={{ padding:"20px 24px" }}>
          <p style={{ fontSize:13,fontWeight:700,color:"var(--t1)",marginBottom:16 }}>Category Performance <span style={{ fontSize:10,color:"var(--t4)",fontWeight:400 }}>· 30 days</span></p>
          {cats.length===0&&<p style={{ fontSize:12,color:"var(--t4)" }}>No habits yet.</p>}
          <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
            {cats.map(([name,{done:cd,total:ct,color}])=>{
              const pct = ct>0?Math.round((cd/ct)*100):0;
              return (
                <div key={name}>
                  <div style={{ display:"flex",justifyContent:"space-between",marginBottom:5 }}>
                    <div style={{ display:"flex",alignItems:"center",gap:7 }}>
                      <span style={{ width:7,height:7,borderRadius:2,background:color }}/>
                      <span style={{ fontSize:12,fontWeight:600,color:"var(--t1)" }}>{name}</span>
                    </div>
                    <span style={{ fontSize:12,fontWeight:700,fontFamily:"monospace",color:pct>=70?"var(--green)":pct>=40?"var(--amber)":"var(--red)" }}>{pct}%</span>
                  </div>
                  <div style={{ height:4,borderRadius:2,background:"var(--surface2)",overflow:"hidden" }}>
                    <div style={{ height:"100%",borderRadius:2,width:`${pct}%`,background:pct>=70?"var(--green)":pct>=40?"var(--amber)":"var(--red)",transition:"width .6s ease" }}/>
                  </div>
                </div>
              );
            })}
          </div>
        </HudCard>

        {/* Workout Split */}
        <HudCard style={{ padding:"20px 24px" }}>
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16 }}>
            <p style={{ fontSize:13,fontWeight:700,color:"var(--t1)" }}>Workout Split</p>
            <button onClick={()=>setPplModal(true)} style={{ fontSize:10,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:"var(--t4)",background:"none",border:"1px solid var(--border2)",borderRadius:5,padding:"5px 10px",cursor:"pointer",transition:"all .15s" }}
              onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor="var(--blue)";(e.currentTarget as HTMLElement).style.color="var(--blue)";}}
              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor="var(--border2)";(e.currentTarget as HTMLElement).style.color="var(--t4)";}}
            >Edit</button>
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
            {ppl.map(d=>{
              const isToday = todaySession?.name===d.name;
              return (
                <div key={d.name} style={{ padding:"14px 16px",borderRadius:8,background:`${d.color}${isToday?"10":"06"}`,border:`1px solid ${d.color}${isToday?"35":"15"}`,display:"flex",alignItems:"center",justifyContent:"space-between",transition:"all .2s" }}>
                  <div>
                    <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                      <span style={{ fontSize:15,fontWeight:800,color:d.color }}>{d.name}</span>
                      {isToday&&<span style={{ fontSize:9,fontWeight:700,background:`${d.color}20`,border:`1px solid ${d.color}40`,color:d.color,borderRadius:4,padding:"2px 7px" }}>TODAY</span>}
                    </div>
                    <div style={{ fontSize:11,color:"var(--t2)",marginTop:2 }}>{d.detail}</div>
                  </div>
                  <div style={{ fontSize:11,fontWeight:600,color:"var(--t3)" }}>{d.days}</div>
                </div>
              );
            })}
          </div>
        </HudCard>
      </div>
    </div>
  );
}
