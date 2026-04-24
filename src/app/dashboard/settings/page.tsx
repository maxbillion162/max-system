"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

/* ─── Types ─────────────────────────────────────────────────────── */
/** All categories consumed by the notify() pipeline. Keys must match NotifyCategory in src/lib/notify.ts. */
interface NotifPrefs {
  // Reminders
  habit_nudge:      boolean;
  calendar_alerts:  boolean;
  bill_alerts:      boolean;
  // Proactive intelligence
  max_insight:      boolean;
  habit_coach:      boolean;
  budget_alerts:    boolean;
  goal_milestone:   boolean;
  market_update:    boolean;
  // Summaries
  weekly_recap:     boolean;
  evening_checkin:  boolean;
  goal_checkin:     boolean;
}
interface Preferences {
  calendar_default_view: "day" | "week" | "month";
  tasks_in_calendar:     boolean;
}
interface PrivacyPrefs {
  blur_net_worth:    boolean;
  blur_transactions: boolean;
  blur_income:       boolean;
}
interface BudgetPrefs {
  period_reset_day: number;      // 1-28 — day of month budget resets
  default_rollover: boolean;     // whether new categories roll unspent to next period
}

/** DEFAULT ALL OFF — opt-in model. Nothing fires until Max explicitly enables. */
const DEFAULT_NOTIF: NotifPrefs = {
  habit_nudge:false, calendar_alerts:false, bill_alerts:false,
  max_insight:false, habit_coach:false, budget_alerts:false, goal_milestone:false, market_update:false,
  weekly_recap:false, evening_checkin:false, goal_checkin:false,
};
const DEFAULT_PREFS:    Preferences   = { calendar_default_view:"week", tasks_in_calendar:true };
const DEFAULT_PRIVACY:  PrivacyPrefs  = { blur_net_worth:false, blur_transactions:false, blur_income:false };
const DEFAULT_BUDGET:   BudgetPrefs   = { period_reset_day:1, default_rollover:false };
const DEFAULT_INTERESTS                = ["Crypto","AI","Sales","Entrepreneurship","Investing","Orlando"];

const SECTIONS = [
  { id:"feed",     icon:"◎", label:"Feed Interests"      },
  { id:"notif",    icon:"◆", label:"Notifications"       },
  { id:"integr",   icon:"⬡", label:"Integrations"        },
  { id:"budget",   icon:"◐", label:"Budget"              },
  { id:"privacy",  icon:"◑", label:"Privacy"             },
  { id:"prefs",    icon:"◷", label:"Preferences"         },
  { id:"intel",    icon:"◈", label:"M.A.X. Intelligence" },
  { id:"behind",   icon:"▦", label:"Behind the Scenes"   },
  { id:"data",     icon:"▤", label:"Data"                },
];

/* ─── Toggle component ───────────────────────────────────────────── */
function Toggle({ value, onChange }: { value:boolean; onChange:(v:boolean)=>void }) {
  return (
    <button
      onClick={()=>onChange(!value)}
      style={{
        width:40,height:22,borderRadius:11,border:"none",cursor:"pointer",flexShrink:0,
        background:value?"var(--blue)":"rgba(255,255,255,0.08)",
        position:"relative",transition:"background .2s",
      }}
    >
      <span style={{
        position:"absolute",top:3,left:value?20:3,width:16,height:16,
        borderRadius:"50%",background:"#fff",transition:"left .2s",
      }}/>
    </button>
  );
}

/* ─── Row wrapper ────────────────────────────────────────────────── */
function SettingRow({ label, desc, children }: { label:string; desc?:string; children:React.ReactNode }) {
  return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 0",borderBottom:"1px solid var(--border)"}}>
      <div>
        <div style={{fontSize:13,fontWeight:600,color:"var(--t1)"}}>{label}</div>
        {desc&&<div style={{fontSize:11,color:"var(--t4)",marginTop:2}}>{desc}</div>}
      </div>
      <div style={{marginLeft:16,flexShrink:0}}>{children}</div>
    </div>
  );
}

/* ─── Section: Feed Interests ────────────────────────────────────── */
function FeedSection({ interests, onSave }: { interests:string[]; onSave:(v:string[])=>Promise<void> }) {
  const [items,   setItems]   = useState<string[]>(interests);
  const [input,   setInput]   = useState("");
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSavedMsg]= useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave(items);
    setSaving(false);
    setSavedMsg(true);
    setTimeout(()=>setSavedMsg(false),2000);
  }
  function remove(t:string) { setItems(p=>p.filter(i=>i!==t)); }
  function add() {
    const v = input.trim();
    if (!v || items.includes(v)) { setInput(""); return; }
    setItems(p=>[...p,v]);
    setInput("");
  }

  return (
    <div>
      <p style={{fontSize:12,color:"var(--t3)",marginBottom:18,lineHeight:1.6}}>
        These topics shape your default news feed. The feed auto-resets daily — a different topic override can be set directly on the Feed page.
      </p>
      <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:18}}>
        {items.map(t=>(
          <div key={t} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 10px 6px 12px",borderRadius:20,background:"rgba(125,184,232,0.08)",border:"1px solid rgba(125,184,232,0.2)"}}>
            <span style={{fontSize:12,fontWeight:600,color:"var(--blue)"}}>{t}</span>
            <button onClick={()=>remove(t)} style={{width:16,height:16,borderRadius:"50%",background:"rgba(125,184,232,0.15)",border:"none",cursor:"pointer",color:"var(--blue)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,padding:0}}>×</button>
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:8,marginBottom:24}}>
        <input
          value={input}
          onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>{if(e.key==="Enter")add();}}
          placeholder="Add topic… (press Enter)"
          style={{flex:1,background:"var(--surface)",border:"1px solid var(--border)",borderRadius:8,padding:"8px 12px",fontSize:12,color:"var(--t1)",outline:"none"}}
          onFocus={e=>(e.currentTarget.style.borderColor="var(--blue)")}
          onBlur={e=>(e.currentTarget.style.borderColor="var(--border)")}
        />
        <button onClick={add} style={{padding:"8px 14px",borderRadius:8,background:"var(--surface)",border:"1px solid var(--border)",cursor:"pointer",fontSize:12,fontWeight:600,color:"var(--t2)"}}>Add</button>
      </div>
      <button
        onClick={handleSave}
        disabled={saving}
        style={{padding:"9px 20px",borderRadius:8,background:"rgba(125,184,232,0.1)",border:"1px solid rgba(125,184,232,0.25)",cursor:"pointer",fontSize:12,fontWeight:700,color:saved?"var(--green)":"var(--blue)",transition:"color .2s"}}
      >
        {saving?"Saving…":saved?"✓ Saved":"Save Interests"}
      </button>
    </div>
  );
}

/* ─── Section: Notifications ─────────────────────────────────────── */
function NotifSection({ prefs, onSave }: { prefs:NotifPrefs; onSave:(v:NotifPrefs)=>Promise<void> }) {
  const [local,   setLocal]   = useState<NotifPrefs>(prefs);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSavedMsg]= useState(false);

  type Row = { key:keyof NotifPrefs; label:string; desc:string };
  const groups: { title:string; rows:Row[] }[] = [
    { title: "Reminders", rows: [
      { key:"habit_nudge",     label:"Habit Nudge",       desc:"9pm ping if habits are still open for the day" },
      { key:"calendar_alerts", label:"Calendar Alerts",   desc:"30 minutes before a scheduled event" },
      { key:"bill_alerts",     label:"Bill Due",          desc:"Heads-up when a bill is due in 3 days" },
    ]},
    { title: "Proactive Intelligence", rows: [
      { key:"max_insight",    label:"M.A.X. Insights",    desc:"Trend findings and observations M.A.X. surfaces on its own" },
      { key:"habit_coach",    label:"Habit Coach",        desc:"Late-afternoon nudge when habits or goals are slipping" },
      { key:"budget_alerts",  label:"Budget Alerts",      desc:"Warnings when a spending category crosses thresholds" },
      { key:"goal_milestone", label:"Goal Milestones",    desc:"Ping when a goal milestone is reached" },
      { key:"market_update",  label:"Market Update",      desc:"2pm snapshot of SPY / QQQ / DIA" },
    ]},
    { title: "Summaries", rows: [
      { key:"weekly_recap",    label:"Weekly Recap",      desc:"Sunday morning summary — habits, goals, wins" },
      { key:"evening_checkin", label:"Evening Check-in",  desc:"Nightly wrap-up with tomorrow's priorities" },
      { key:"goal_checkin",    label:"Quarterly Goals",   desc:"Goal progress report every 3 months" },
    ]},
  ];

  async function save() {
    setSaving(true);
    await onSave(local);
    setSaving(false);
    setSavedMsg(true);
    setTimeout(()=>setSavedMsg(false),2000);
  }

  const enabledCount = Object.values(local).filter(Boolean).length;

  return (
    <div>
      <div style={{padding:"12px 14px",borderRadius:6,background:"rgba(125,184,232,0.04)",border:"1px solid rgba(125,184,232,0.12)",marginBottom:24}}>
        <p style={{fontSize:12,color:"var(--t1b)",lineHeight:1.6,marginBottom:4,fontWeight:600}}>Everything here is opt-in.</p>
        <p style={{fontSize:11,color:"var(--t3)",lineHeight:1.6}}>
          Each enabled notification lands simultaneously in your dashboard bell and Telegram. Nothing fires unless you turn it on here.
          {enabledCount === 0 && <> <span style={{color:"var(--t2)"}}>All currently off.</span></>}
        </p>
      </div>
      {groups.map(g => (
        <div key={g.title} style={{marginBottom:28}}>
          <p style={{fontSize:10,fontWeight:700,letterSpacing:"0.18em",textTransform:"uppercase",color:"var(--t3)",marginBottom:8}}>{g.title}</p>
          {g.rows.map(r => (
            <SettingRow key={r.key} label={r.label} desc={r.desc}>
              <Toggle value={local[r.key]} onChange={v=>setLocal(p=>({...p,[r.key]:v}))}/>
            </SettingRow>
          ))}
        </div>
      ))}
      <div style={{marginTop:8}}>
        <button
          onClick={save}
          disabled={saving}
          style={{padding:"9px 20px",borderRadius:2,background:"rgba(125,184,232,0.1)",border:"1px solid rgba(125,184,232,0.3)",cursor:"pointer",fontSize:12,fontWeight:700,letterSpacing:"0.08em",color:saved?"var(--green)":"var(--blue)",transition:"color .2s"}}
        >
          {saving?"Saving…":saved?"✓ Saved":"Save Notifications"}
        </button>
      </div>
    </div>
  );
}

/* ─── Section: Integrations ──────────────────────────────────────── */
function IntegrSection() {
  const [telegramStatus, setTelegramStatus] = useState<"idle"|"sending"|"ok"|"fail">("idle");
  const [googleStatus,   setGoogleStatus]   = useState<"checking"|"connected"|"disconnected">("checking");
  const [plaidCount,     setPlaidCount]     = useState<number|null>(null);

  useEffect(()=>{
    (async()=>{
      try { const {data}=await supabase.from("google_tokens").select("access_token").limit(1); setGoogleStatus(data?.length?"connected":"disconnected"); }
      catch { setGoogleStatus("disconnected"); }
      try { const {count}=await supabase.from("accounts").select("id",{count:"exact",head:true}); setPlaidCount(count??0); }
      catch { setPlaidCount(0); }
    })();
  },[]);

  async function sendTest() {
    setTelegramStatus("sending");
    try {
      const r = await fetch("/api/telegram/test",{method:"POST"});
      const j = await r.json();
      setTelegramStatus(j.ok?"ok":"fail");
    } catch { setTelegramStatus("fail"); }
    setTimeout(()=>setTelegramStatus("idle"),3000);
  }

  const googleColor = googleStatus==="connected"?"var(--green)":googleStatus==="disconnected"?"var(--red)":"var(--t4)";
  const googleLabel = googleStatus==="connected"?"Connected":"Not connected";

  return (
    <div>
      {/* Google */}
      <SettingRow label="Google OAuth" desc="Calendar + Gmail access">
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{width:7,height:7,borderRadius:"50%",background:googleColor,display:"inline-block",flexShrink:0}}/>
          <span style={{fontSize:12,fontWeight:600,color:googleColor}}>{googleLabel}</span>
          {googleStatus==="disconnected"&&(
            <a href="/api/auth/google" style={{fontSize:11,color:"var(--blue)",marginLeft:6,textDecoration:"none",fontWeight:600}}>Connect →</a>
          )}
        </div>
      </SettingRow>

      {/* Telegram */}
      <SettingRow label="Telegram Bot" desc="Primary notification channel">
        <button
          onClick={sendTest}
          disabled={telegramStatus==="sending"}
          style={{
            padding:"6px 14px",borderRadius:7,border:"1px solid rgba(255,255,255,0.1)",cursor:"pointer",
            fontSize:12,fontWeight:600,transition:"all .15s",
            background: telegramStatus==="ok"?"rgba(52,211,153,0.1)":telegramStatus==="fail"?"rgba(200,90,90,0.1)":"var(--surface2)",
            color: telegramStatus==="ok"?"var(--green)":telegramStatus==="fail"?"var(--red)":"var(--t2)",
          }}
        >
          {telegramStatus==="sending"?"Sending…":telegramStatus==="ok"?"✓ Sent":telegramStatus==="fail"?"✗ Failed":"Send Test"}
        </button>
      </SettingRow>

      {/* Plaid */}
      <SettingRow label="Plaid" desc="Connected bank accounts">
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {plaidCount===null
            ? <span style={{fontSize:12,color:"var(--t4)"}}>Checking…</span>
            : plaidCount > 0
              ? <><span style={{width:7,height:7,borderRadius:"50%",background:"var(--green)",display:"inline-block"}}/><span style={{fontSize:12,fontWeight:600,color:"var(--green)"}}>{plaidCount} account{plaidCount!==1?"s":""}</span></>
              : <><span style={{width:7,height:7,borderRadius:"50%",background:"var(--amber)",display:"inline-block"}}/><span style={{fontSize:12,color:"var(--amber)"}}>No accounts linked</span></>
          }
        </div>
      </SettingRow>

      {/* Dev note for Plaid */}
      <div style={{marginTop:18,padding:"14px 16px",borderRadius:8,background:"rgba(200,90,90,0.05)",border:"1px solid rgba(200,90,90,0.12)"}}>
        <p style={{fontSize:11,color:"var(--amber)",fontWeight:600,marginBottom:4}}>Plaid: Sandbox Mode Active</p>
        <p style={{fontSize:11,color:"var(--t4)",lineHeight:1.6}}>To connect real bank accounts: switch to Development on dashboard.plaid.com, update <code style={{fontFamily:"monospace",color:"var(--t3)"}}>PLAID_ENV=development</code> and <code style={{fontFamily:"monospace",color:"var(--t3)"}}>PLAID_SECRET</code> in Vercel env vars, then redeploy.</p>
      </div>
    </div>
  );
}

/* ─── Section: Preferences ───────────────────────────────────────── */
function PrefsSection({ prefs, onSave }: { prefs:Preferences; onSave:(v:Preferences)=>Promise<void> }) {
  const [local,  setLocal]   = useState<Preferences>(prefs);
  const [saving, setSaving]  = useState(false);
  const [saved,  setSavedMsg]= useState(false);

  async function save() {
    setSaving(true);
    await onSave(local);
    setSaving(false);
    setSavedMsg(true);
    setTimeout(()=>setSavedMsg(false),2000);
  }

  const views = ["day","week","month"] as const;

  return (
    <div>
      <SettingRow label="Default Calendar View" desc="Opening view when you navigate to Schedule">
        <div style={{display:"flex",gap:4}}>
          {views.map(v=>(
            <button key={v} onClick={()=>setLocal(p=>({...p,calendar_default_view:v}))}
              style={{
                padding:"5px 12px",borderRadius:6,border:"1px solid",cursor:"pointer",fontSize:12,fontWeight:600,
                background:local.calendar_default_view===v?"rgba(125,184,232,0.12)":"transparent",
                borderColor:local.calendar_default_view===v?"rgba(125,184,232,0.3)":"var(--border)",
                color:local.calendar_default_view===v?"var(--blue)":"var(--t3)",
                transition:"all .15s",
              }}
            >{v.charAt(0).toUpperCase()+v.slice(1)}</button>
          ))}
        </div>
      </SettingRow>
      <SettingRow label="Show Tasks in Calendar" desc="Display task due dates as calendar blocks">
        <Toggle value={local.tasks_in_calendar} onChange={v=>setLocal(p=>({...p,tasks_in_calendar:v}))}/>
      </SettingRow>
      <div style={{marginTop:20}}>
        <button
          onClick={save}
          disabled={saving}
          style={{padding:"9px 20px",borderRadius:8,background:"rgba(125,184,232,0.1)",border:"1px solid rgba(125,184,232,0.25)",cursor:"pointer",fontSize:12,fontWeight:700,color:saved?"var(--green)":"var(--blue)",transition:"color .2s"}}
        >
          {saving?"Saving…":saved?"✓ Saved":"Save"}
        </button>
      </div>
    </div>
  );
}

/* ─── Section: M.A.X. Intelligence ──────────────────────────────── */
function IntelSection() {
  const [style,       setStyle]      = useState<string>("");
  const [memCount,    setMemCount]   = useState<number|null>(null);
  const [styleLoading,setStyleLoad]  = useState(true);

  useEffect(()=>{
    (async()=>{
      try {
        const {data}=await supabase.from("writing_style").select("*").limit(1);
        if (data?.[0]) {
          const row = data[0] as Record<string,unknown>;
          const text = Object.entries(row)
            .filter(([k])=>k!=="id"&&k!=="created_at"&&k!=="updated_at")
            .map(([k,v])=>`${k.replace(/_/g," ")}: ${v}`)
            .join("\n");
          setStyle(text);
        } else {
          setStyle("No writing style profile yet. Send emails through M.A.X. to build your voice profile.");
        }
      } catch { setStyle("Unable to load writing style."); }
      finally { setStyleLoad(false); }

      try { const {count}=await supabase.from("memories").select("id",{count:"exact",head:true}); setMemCount(count??0); }
      catch { setMemCount(0); }
    })();
  },[]);

  return (
    <div>
      {/* Memory count */}
      <div style={{display:"flex",gap:12,marginBottom:24,flexWrap:"wrap"}}>
        <div style={{padding:"16px 20px",borderRadius:10,background:"var(--surface)",border:"1px solid var(--border)",flex:1,minWidth:140}}>
          <p style={{fontSize:11,color:"var(--t4)",letterSpacing:"0.08em",fontWeight:600,marginBottom:6}}>MEMORIES STORED</p>
          <p style={{fontSize:28,fontWeight:800,fontFamily:"monospace",color:"var(--t1)"}}>{memCount===null?"…":memCount}</p>
          <p style={{fontSize:11,color:"var(--t4)",marginTop:4}}>Long-term facts M.A.X. knows about you</p>
        </div>
        <div style={{padding:"16px 20px",borderRadius:10,background:"var(--surface)",border:"1px solid var(--border)",flex:1,minWidth:140}}>
          <p style={{fontSize:11,color:"var(--t4)",letterSpacing:"0.08em",fontWeight:600,marginBottom:6}}>AI MODEL</p>
          <p style={{fontSize:18,fontWeight:800,color:"var(--t1)"}}>Haiku 4.5</p>
          <p style={{fontSize:11,color:"var(--t4)",marginTop:4}}>Fast · cheap · runs under $5/mo target</p>
        </div>
      </div>

      {/* Writing Style */}
      <div>
        <p style={{fontSize:11,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"var(--t3)",marginBottom:10}}>Your Writing Voice Profile</p>
        {styleLoading
          ? <div style={{display:"flex",gap:5,padding:"16px 0"}}>{[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:"50%",background:"var(--blue)",opacity:0.4}}/>)}</div>
          : <div style={{padding:"16px",borderRadius:8,background:"var(--surface)",border:"1px solid var(--border)"}}>
              <pre style={{fontSize:12,color:"var(--t2)",lineHeight:1.8,whiteSpace:"pre-wrap",fontFamily:"monospace",margin:0}}>{style}</pre>
            </div>
        }
      </div>
    </div>
  );
}

/* ─── Section: Privacy ───────────────────────────────────────────── */
function PrivacySection({ prefs, onSave }: { prefs:PrivacyPrefs; onSave:(v:PrivacyPrefs)=>Promise<void> }) {
  const [local,  setLocal]    = useState<PrivacyPrefs>(prefs);
  const [saving, setSaving]   = useState(false);
  const [saved,  setSavedMsg] = useState(false);

  async function save() {
    setSaving(true);
    await onSave(local);
    setSaving(false);
    setSavedMsg(true);
    setTimeout(()=>setSavedMsg(false),2000);
  }

  return (
    <div>
      <p style={{fontSize:12,color:"var(--t3)",marginBottom:20,lineHeight:1.6}}>
        Hide sensitive financial figures by default. Click-to-reveal remains available on the actual pages.
      </p>
      <SettingRow label="Blur Net Worth" desc="Dashboard and Finance hub figures obscured until revealed">
        <Toggle value={local.blur_net_worth} onChange={v=>setLocal(p=>({...p,blur_net_worth:v}))}/>
      </SettingRow>
      <SettingRow label="Blur Transactions" desc="Transaction amounts hidden in Finance → Transactions">
        <Toggle value={local.blur_transactions} onChange={v=>setLocal(p=>({...p,blur_transactions:v}))}/>
      </SettingRow>
      <SettingRow label="Blur Income" desc="Monthly income figure obscured on Finance">
        <Toggle value={local.blur_income} onChange={v=>setLocal(p=>({...p,blur_income:v}))}/>
      </SettingRow>
      <div style={{marginTop:20}}>
        <button onClick={save} disabled={saving}
          style={{padding:"9px 20px",borderRadius:2,background:"rgba(125,184,232,0.1)",border:"1px solid rgba(125,184,232,0.3)",cursor:"pointer",fontSize:12,fontWeight:700,letterSpacing:"0.08em",color:saved?"var(--green)":"var(--blue)",transition:"color .2s"}}>
          {saving?"Saving…":saved?"✓ Saved":"Save Privacy"}
        </button>
      </div>
    </div>
  );
}

/* ─── Section: Budget ────────────────────────────────────────────── */
function BudgetSection({ prefs, onSave }: { prefs:BudgetPrefs; onSave:(v:BudgetPrefs)=>Promise<void> }) {
  const [local,  setLocal]    = useState<BudgetPrefs>(prefs);
  const [saving, setSaving]   = useState(false);
  const [saved,  setSavedMsg] = useState(false);

  async function save() {
    setSaving(true);
    await onSave(local);
    setSaving(false);
    setSavedMsg(true);
    setTimeout(()=>setSavedMsg(false),2000);
  }

  return (
    <div>
      <p style={{fontSize:12,color:"var(--t3)",marginBottom:20,lineHeight:1.6}}>
        How your monthly budget behaves. These apply globally across the Finance hub.
      </p>
      <SettingRow label="Period Reset Day" desc="Day of month when the new budget period starts (1st–28th)">
        <select value={local.period_reset_day} onChange={e=>setLocal(p=>({...p,period_reset_day:parseInt(e.target.value,10)}))}
          style={{background:"var(--surface2)",border:"1px solid var(--border2)",borderRadius:2,padding:"7px 10px",color:"var(--t1)",fontSize:12,fontWeight:600,outline:"none",cursor:"pointer",fontFamily:"monospace"}}>
          {Array.from({length:28},(_,i)=>i+1).map(d=>(
            <option key={d} value={d}>{d}{d===1?"st":d===2?"nd":d===3?"rd":"th"}</option>
          ))}
        </select>
      </SettingRow>
      <SettingRow label="Default Rollover" desc="New categories start with unspent funds rolling into the next period">
        <Toggle value={local.default_rollover} onChange={v=>setLocal(p=>({...p,default_rollover:v}))}/>
      </SettingRow>
      <div style={{marginTop:20}}>
        <button onClick={save} disabled={saving}
          style={{padding:"9px 20px",borderRadius:2,background:"rgba(125,184,232,0.1)",border:"1px solid rgba(125,184,232,0.3)",cursor:"pointer",fontSize:12,fontWeight:700,letterSpacing:"0.08em",color:saved?"var(--green)":"var(--blue)",transition:"color .2s"}}>
          {saving?"Saving…":saved?"✓ Saved":"Save Budget"}
        </button>
      </div>
    </div>
  );
}

/* ─── Section: Behind the Scenes ────────────────────────────────── */
interface ActivityRow { id:string; type:string; description:string; created_at:string }
interface MemoryRow   { id:string; content:string; tags?:string[] | null; created_at:string }
interface NotifRow    { id:string; type:string; title:string; body:string; read:boolean; created_at:string }

function BehindSection() {
  const [activity,  setActivity]      = useState<ActivityRow[]|null>(null);
  const [memories,  setMemories]      = useState<MemoryRow[]|null>(null);
  const [notifs,    setNotifs]        = useState<NotifRow[]|null>(null);

  useEffect(() => {
    (async () => {
      const [actRes, memRes, notifRes] = await Promise.allSettled([
        supabase.from("activity_log").select("id,type,description,created_at").order("created_at",{ascending:false}).limit(15),
        supabase.from("memories").select("id,content,tags,created_at").order("created_at",{ascending:false}).limit(10),
        supabase.from("notifications").select("id,type,title,body,read,created_at").order("created_at",{ascending:false}).limit(10),
      ]);
      setActivity( actRes.status   === "fulfilled" && actRes.value.data   ? actRes.value.data   as ActivityRow[] : []);
      setMemories( memRes.status   === "fulfilled" && memRes.value.data   ? memRes.value.data   as MemoryRow[]   : []);
      setNotifs(   notifRes.status === "fulfilled" && notifRes.value.data ? notifRes.value.data as NotifRow[]    : []);
    })();
  }, []);

  const cronSchedules = [
    { name: "Morning email briefing",  schedule: "7:00 ET daily" },
    { name: "Daily bank sync",         schedule: "6:00 ET daily" },
    { name: "Wealth snapshot",         schedule: "19:00 ET daily" },
    { name: "Market update push",      schedule: "10:00 ET daily" },
    { name: "Bill due scan",           schedule: "7:00 ET daily" },
    { name: "Habit nudge",             schedule: "21:00 ET daily" },
    { name: "Evening check-in",        schedule: "20:00 ET daily" },
    { name: "Weekly recap",            schedule: "Sunday 8:00 ET" },
    { name: "Quarterly goal check-in", schedule: "Jan / Apr / Jul / Oct 1st" },
  ];

  return (
    <div>
      <div style={{padding:"12px 14px",borderRadius:6,background:"rgba(125,184,232,0.04)",border:"1px solid rgba(125,184,232,0.12)",marginBottom:24}}>
        <p style={{fontSize:12,color:"var(--t1b)",lineHeight:1.6,marginBottom:4,fontWeight:600}}>What M.A.X. does invisibly.</p>
        <p style={{fontSize:11,color:"var(--t3)",lineHeight:1.6}}>Observability surface — recent agent activity, stored memories, delivered notifications, and scheduled jobs.</p>
      </div>

      <Panel title="Recent Agent Activity" count={activity?.length ?? 0}>
        {activity === null ? (
          <LoadingDots/>
        ) : activity.length === 0 ? (
          <Empty text="No agent activity logged yet."/>
        ) : (
          <div style={{display:"flex",flexDirection:"column"}}>
            {activity.map(a => (
              <div key={a.id} style={{display:"flex",gap:12,padding:"9px 0",borderBottom:"1px solid var(--border)",alignItems:"flex-start"}}>
                <span style={{fontSize:9,fontFamily:"monospace",color:"var(--t4)",letterSpacing:"0.1em",textTransform:"uppercase",flexShrink:0,paddingTop:2,minWidth:72}}>{a.type}</span>
                <span style={{fontSize:12,color:"var(--t1b)",flex:1,lineHeight:1.5}}>{a.description}</span>
                <span style={{fontSize:10,color:"var(--t4)",fontFamily:"monospace",flexShrink:0,paddingTop:2}}>{timeAgo(a.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Memory Writes" count={memories?.length ?? 0}>
        {memories === null ? (
          <LoadingDots/>
        ) : memories.length === 0 ? (
          <Empty text="M.A.X. hasn't stored any memories yet."/>
        ) : (
          <div style={{display:"flex",flexDirection:"column"}}>
            {memories.map(m => (
              <div key={m.id} style={{padding:"9px 0",borderBottom:"1px solid var(--border)"}}>
                <p style={{fontSize:12,color:"var(--t1b)",lineHeight:1.5,marginBottom:3}}>{m.content}</p>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <span style={{fontSize:10,color:"var(--t4)",fontFamily:"monospace"}}>{timeAgo(m.created_at)}</span>
                  {Array.isArray(m.tags) && m.tags.length > 0 && (
                    <span style={{fontSize:10,color:"var(--t3)"}}>· {m.tags.join(", ")}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Recent Notifications" count={notifs?.length ?? 0}>
        {notifs === null ? (
          <LoadingDots/>
        ) : notifs.length === 0 ? (
          <Empty text="Nothing delivered yet. Enable categories in Notifications to start seeing history here."/>
        ) : (
          <div style={{display:"flex",flexDirection:"column"}}>
            {notifs.map(n => (
              <div key={n.id} style={{display:"flex",gap:12,padding:"9px 0",borderBottom:"1px solid var(--border)",alignItems:"flex-start"}}>
                <span style={{fontSize:9,fontFamily:"monospace",color:"var(--t4)",letterSpacing:"0.1em",textTransform:"uppercase",flexShrink:0,paddingTop:2,minWidth:86}}>{n.type}</span>
                <div style={{flex:1}}>
                  <p style={{fontSize:12,color:"var(--t1b)",fontWeight:600,marginBottom:2}}>{n.title}</p>
                  <p style={{fontSize:11,color:"var(--t3)",lineHeight:1.5}}>{n.body}</p>
                </div>
                <span style={{fontSize:10,color:"var(--t4)",fontFamily:"monospace",flexShrink:0,paddingTop:2}}>{timeAgo(n.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Scheduled Jobs" count={cronSchedules.length}>
        <div style={{display:"flex",flexDirection:"column"}}>
          {cronSchedules.map(c => (
            <div key={c.name} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid var(--border)"}}>
              <span style={{fontSize:12,color:"var(--t1b)"}}>{c.name}</span>
              <span style={{fontSize:11,color:"var(--t3)",fontFamily:"monospace"}}>{c.schedule}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function Panel({ title, count, children }: { title:string; count:number; children:React.ReactNode }) {
  return (
    <div style={{marginBottom:24}}>
      <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",marginBottom:10}}>
        <p style={{fontSize:10,fontWeight:700,letterSpacing:"0.22em",textTransform:"uppercase",color:"var(--t2)"}}>{title}</p>
        <span style={{fontSize:10,color:"var(--t4)",fontFamily:"monospace"}}>{count}</span>
      </div>
      <div style={{padding:"4px 14px",borderRadius:3,background:"var(--surface)",border:"1px solid var(--border)"}}>{children}</div>
    </div>
  );
}
function LoadingDots() {
  return <div style={{display:"flex",gap:5,padding:"14px 0"}}>{[0,1,2].map(i=><div key={i} style={{width:5,height:5,borderRadius:"50%",background:"var(--blue)",opacity:0.4}}/>)}</div>;
}
function Empty({ text }: { text:string }) {
  return <p style={{fontSize:11,color:"var(--t4)",padding:"14px 0"}}>{text}</p>;
}
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/* ─── Section: Data ──────────────────────────────────────────────── */
function DataSection() {
  const [exportingGoals, setExportingGoals] = useState(false);
  const [exportingNotes, setExportingNotes] = useState(false);
  const [clearingChat,   setClearingChat]   = useState(false);
  const [clearDone,      setClearDone]      = useState(false);

  async function exportGoals() {
    setExportingGoals(true);
    const { data } = await supabase.from("goals").select("*");
    const blob = new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `max-goals-${new Date().toISOString().slice(0,10)}.json`;
    a.click(); URL.revokeObjectURL(url);
    setExportingGoals(false);
  }

  async function exportNotes() {
    setExportingNotes(true);
    const { data } = await supabase.from("goal_notes").select("*");
    const blob = new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `max-goal-notes-${new Date().toISOString().slice(0,10)}.json`;
    a.click(); URL.revokeObjectURL(url);
    setExportingNotes(false);
  }

  async function clearChat() {
    if (!confirm("Delete all web chat history? This cannot be undone.")) return;
    setClearingChat(true);
    await supabase.from("chat_messages").delete().neq("id","00000000-0000-0000-0000-000000000000");
    setClearingChat(false);
    setClearDone(true);
    setTimeout(()=>setClearDone(false),3000);
  }

  const btnBase: React.CSSProperties = {
    padding:"9px 18px",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:700,
    display:"inline-flex",alignItems:"center",gap:7,transition:"all .15s",border:"1px solid",
  };

  return (
    <div>
      <p style={{fontSize:12,color:"var(--t3)",marginBottom:20,lineHeight:1.6}}>
        Export your data as JSON or clear stored history. Exports download immediately to your device.
      </p>

      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        <SettingRow label="Export Goals" desc="Download all goal data including milestones and subgoals">
          <button onClick={exportGoals} disabled={exportingGoals} style={{...btnBase,background:"rgba(125,184,232,0.08)",borderColor:"rgba(125,184,232,0.2)",color:"var(--blue)"}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            {exportingGoals?"Exporting…":"Export JSON"}
          </button>
        </SettingRow>

        <SettingRow label="Export Goal Notes" desc="Download all journal entries for your goals">
          <button onClick={exportNotes} disabled={exportingNotes} style={{...btnBase,background:"rgba(125,184,232,0.08)",borderColor:"rgba(125,184,232,0.2)",color:"var(--blue)"}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            {exportingNotes?"Exporting…":"Export JSON"}
          </button>
        </SettingRow>

        <SettingRow label="Clear Chat History" desc="Delete all web chat messages (Telegram history is kept)">
          <button onClick={clearChat} disabled={clearingChat} style={{...btnBase,background:clearDone?"rgba(52,211,153,0.08)":"rgba(200,90,90,0.07)",borderColor:clearDone?"rgba(52,211,153,0.25)":"rgba(200,90,90,0.2)",color:clearDone?"var(--green)":"var(--red)"}}>
            {clearingChat?"Clearing…":clearDone?"✓ Cleared":"Clear History"}
          </button>
        </SettingRow>
      </div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────── */
export default function SettingsPage() {
  const [active,      setActive]      = useState("feed");
  const [interests,   setInterests]   = useState<string[]>(DEFAULT_INTERESTS);
  const [notifPrefs,  setNotifPrefs]  = useState<NotifPrefs>(DEFAULT_NOTIF);
  const [userPrefs,   setUserPrefs]   = useState<Preferences>(DEFAULT_PREFS);
  const [privacyPrefs,setPrivacyPrefs]= useState<PrivacyPrefs>(DEFAULT_PRIVACY);
  const [budgetPrefs, setBudgetPrefs] = useState<BudgetPrefs>(DEFAULT_BUDGET);
  const [loading,     setLoading]     = useState(true);

  const loadSettings = useCallback(async () => {
    const { data } = await supabase.from("settings").select("key,value");
    if (!data) { setLoading(false); return; }
    for (const row of data) {
      if (row.key==="feed_interests" && Array.isArray(row.value)) setInterests(row.value as string[]);
      if (row.key==="notification_prefs" && row.value) setNotifPrefs({ ...DEFAULT_NOTIF, ...(row.value as Partial<NotifPrefs>) });
      if (row.key==="preferences" && row.value) setUserPrefs({ ...DEFAULT_PREFS, ...(row.value as Partial<Preferences>) });
      if (row.key==="privacy_prefs" && row.value) setPrivacyPrefs({ ...DEFAULT_PRIVACY, ...(row.value as Partial<PrivacyPrefs>) });
      if (row.key==="budget_prefs" && row.value) setBudgetPrefs({ ...DEFAULT_BUDGET, ...(row.value as Partial<BudgetPrefs>) });
    }
    setLoading(false);
  }, []);

  useEffect(()=>{ loadSettings(); },[loadSettings]);

  async function saveSetting(key:string, value:unknown) {
    await supabase.from("settings").upsert({ key, value }, { onConflict:"key" });
  }

  const section = SECTIONS.find(s=>s.id===active)!;

  return (
    <div style={{display:"flex",minHeight:"100vh",background:"var(--bg)"}}>

      {/* Left nav */}
      <div style={{width:220,borderRight:"1px solid var(--border)",padding:"40px 0",flexShrink:0}}>
        <div style={{padding:"0 24px 24px",borderBottom:"1px solid var(--border)",marginBottom:12}}>
          <p style={{fontSize:10,fontWeight:700,letterSpacing:"0.2em",textTransform:"uppercase",color:"rgba(125,184,232,0.5)",marginBottom:8}}>M.A.X. OS</p>
          <h1 style={{fontSize:20,fontWeight:800,color:"var(--t1)",letterSpacing:"-0.02em",margin:0}}>Settings</h1>
        </div>
        <nav style={{padding:"0 12px"}}>
          {SECTIONS.map(s=>(
            <button
              key={s.id}
              onClick={()=>setActive(s.id)}
              style={{
                display:"flex",alignItems:"center",gap:10,width:"100%",textAlign:"left",
                padding:"10px 12px",borderRadius:8,border:"none",cursor:"pointer",transition:"all .15s",
                background:active===s.id?"rgba(125,184,232,0.1)":"transparent",
                color:active===s.id?"var(--blue)":"var(--t3)",
              }}
              onMouseEnter={e=>{ if(active!==s.id)(e.currentTarget as HTMLElement).style.background="rgba(255,255,255,0.04)"; }}
              onMouseLeave={e=>{ if(active!==s.id)(e.currentTarget as HTMLElement).style.background="transparent"; }}
            >
              <span style={{fontSize:14,opacity:0.7}}>{s.icon}</span>
              <span style={{fontSize:13,fontWeight:active===s.id?700:500}}>{s.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div style={{flex:1,padding:"40px 48px",maxWidth:720}}>
        {loading ? (
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:300}}>
            <div style={{display:"flex",gap:6}}>{[0,1,2].map(i=><div key={i} style={{width:8,height:8,borderRadius:"50%",background:"var(--blue)",opacity:0.4}}/>)}</div>
          </div>
        ) : (
          <>
            {/* Section header */}
            <div style={{marginBottom:32}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                <div style={{width:32,height:32,borderRadius:9,background:"rgba(125,184,232,0.08)",border:"1px solid rgba(125,184,232,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,color:"rgba(125,184,232,0.7)"}}>
                  {section.icon}
                </div>
                <h2 style={{fontSize:20,fontWeight:800,color:"var(--t1)",letterSpacing:"-0.02em",margin:0}}>{section.label}</h2>
              </div>
              <div style={{height:1,background:"var(--border)"}}/>
            </div>

            {/* Section body */}
            {active==="feed"    && <FeedSection    interests={interests} onSave={async v=>{ setInterests(v); await saveSetting("feed_interests",v); }}/>}
            {active==="notif"   && <NotifSection   prefs={notifPrefs}    onSave={async v=>{ setNotifPrefs(v); await saveSetting("notification_prefs",v); }}/>}
            {active==="integr"  && <IntegrSection/>}
            {active==="budget"  && <BudgetSection  prefs={budgetPrefs}   onSave={async v=>{ setBudgetPrefs(v); await saveSetting("budget_prefs",v); }}/>}
            {active==="privacy" && <PrivacySection prefs={privacyPrefs}  onSave={async v=>{ setPrivacyPrefs(v); await saveSetting("privacy_prefs",v); }}/>}
            {active==="prefs"   && <PrefsSection   prefs={userPrefs}     onSave={async v=>{ setUserPrefs(v); await saveSetting("preferences",v); }}/>}
            {active==="intel"   && <IntelSection/>}
            {active==="behind"  && <BehindSection/>}
            {active==="data"    && <DataSection/>}
          </>
        )}
      </div>
    </div>
  );
}
