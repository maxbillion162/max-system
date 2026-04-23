"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/* ── Types ── */
interface Email {
  id: string; threadId: string; from: string; fromEmail: string;
  subject: string; preview: string; body: string; time: string;
  unread: boolean; category: "action"|"fyi"|"noise"; labels: string[];
  snoozed?: boolean; pinned?: boolean;
}
type Folder = "all"|"action"|"fyi"|"newsletters"|"noise";

/* ── Helpers ── */
function categorize(labels: string[]): "action"|"fyi"|"noise" {
  if (labels.includes("IMPORTANT")||labels.includes("STARRED")) return "action";
  if (labels.includes("CATEGORY_PROMOTIONS")||labels.includes("CATEGORY_UPDATES")||labels.includes("CATEGORY_SOCIAL")) return "noise";
  return "fyi";
}
function parseSender(from: string) {
  const m = from.match(/^(.*?)\s*<(.+?)>$/);
  if (m) return { name: m[1].replace(/"/g,"").trim()||m[2], email: m[2] };
  return { name: from, email: from };
}
function relativeTime(dateStr: string): string {
  const d = new Date(dateStr); if (isNaN(d.getTime())) return dateStr;
  const diff = Date.now()-d.getTime(), mins = Math.floor(diff/60000);
  if (mins<1) return "just now"; if (mins<60) return `${mins}m`;
  const hrs = Math.floor(mins/60); if (hrs<24) return `${hrs}h`;
  const days = Math.floor(hrs/24); if (days===1) return "Yesterday";
  if (days<7) return `${days}d`;
  return d.toLocaleDateString("en-US",{month:"short",day:"numeric"});
}
function initials(name: string) { return name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()||"?"; }
const AVATAR_COLORS = ["#8b5cf6","#06b6d4","#10b981","#f97316","#ec4899","#4589ff","#f59e0b","#ef4444"];
function avatarColor(name: string) {
  let h=0; for(let i=0;i<name.length;i++) h=(h*31+name.charCodeAt(i))%AVATAR_COLORS.length; return AVATAR_COLORS[h];
}
function isNewsletter(e: Email) {
  return e.labels.includes("CATEGORY_PROMOTIONS")||e.labels.includes("CATEGORY_UPDATES");
}

/* ── Placeholder data ── */
const PLACEHOLDER: Email[] = [
  { id:"1", threadId:"1", from:"Sarah M.", fromEmail:"sarah@example.com", category:"action", subject:"Contract revision needed", preview:"Hey Max, the client needs a few changes to the contract before they can sign. Specifically they want to revise payment terms and SLA.", body:"Hey Max,\n\nThe client needs a few changes to the contract before they can sign. Specifically they want to revise the payment terms from Net-30 to Net-15 and need an updated SLA section.\n\nCan you review and get back to me by EOD?\n\nThanks,\nSarah", time:"9:14 AM", unread:true, labels:["IMPORTANT"] },
  { id:"2", threadId:"2", from:"HR Department", fromEmail:"hr@company.com", category:"action", subject:"Onboarding paperwork due Friday", preview:"Your onboarding documents must be submitted before your start date. Please log in to the HR portal to complete the required forms.", body:"Hi Max,\n\nYour onboarding documents must be submitted by Friday, July 5th before your start date on July 8th.\n\nPlease log in to the HR portal to complete:\n- I-9 verification\n- Direct deposit setup\n- Benefits enrollment\n- Employee handbook acknowledgment\n\nLet me know if you have any questions.\n\nHR Team", time:"8:02 AM", unread:true, labels:["IMPORTANT"] },
  { id:"3", threadId:"3", from:"CoinDesk", fromEmail:"news@coindesk.com", category:"fyi", subject:"BTC breaks $94K — weekly analysis", preview:"Bitcoin surged past $94,000 this morning on strong institutional inflows. Multiple analysts are revising year-end targets.", body:"Bitcoin surged past $94,000 this morning on strong institutional inflows. Multiple analysts are now revising their year-end price targets upward toward $120K–$150K.\n\nKey drivers:\n- BlackRock ETF inflows hit $800M this week\n- Positive macro sentiment after Fed pause\n- XRP ETF approval odds rising on Polymarket (72%)", time:"7:45 AM", unread:false, labels:[] },
  { id:"4", threadId:"4", from:"Robinhood", fromEmail:"alerts@robinhood.com", category:"fyi", subject:"Price alert: XRP +6.2% today", preview:"Your XRP holdings have moved +6.2% in the last 24 hours. XRP is currently trading at $2.41.", body:"Your XRP holdings have moved +6.2% in the last 24 hours.\n\nXRP is currently trading at $2.41.\nYour position: 200 XRP = $482.00\n24h gain: +$28.14\n\nView your portfolio in the Robinhood app.", time:"6:30 AM", unread:false, labels:[] },
  { id:"5", threadId:"5", from:"Spotify", fromEmail:"no-reply@spotify.com", category:"noise", subject:"Your Weekly Discover playlist is ready", preview:"We found 30 new songs based on your listening history. Check out your Discover Weekly playlist now.", body:"We found 30 new songs based on your listening history. Check out your Discover Weekly playlist now.", time:"6:00 AM", unread:false, labels:["CATEGORY_UPDATES"] },
  { id:"6", threadId:"6", from:"LinkedIn", fromEmail:"news@linkedin.com", category:"noise", subject:"5 new connections viewed your profile", preview:"See who's been looking at your LinkedIn profile this week.", body:"See who's been looking at your LinkedIn profile this week.", time:"Yesterday", unread:false, labels:["CATEGORY_SOCIAL"] },
];

/* ── Shortcuts Modal ── */
const SHORTCUTS = [
  { key:"J / K",  desc:"Navigate emails up / down" },
  { key:"R",      desc:"Focus reply compose" },
  { key:"D",      desc:"Draft reply with M.A.X." },
  { key:"E",      desc:"Archive / dismiss email" },
  { key:"/",      desc:"Focus search bar" },
  { key:"?",      desc:"Toggle this shortcuts panel" },
];

function ShortcutsModal({ onClose }: { onClose: ()=>void }) {
  return (
    <div style={{ position:"fixed",inset:0,zIndex:300,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center" }} onClick={onClose}>
      <div style={{ background:"var(--surface)",border:"1px solid var(--border2)",borderRadius:14,padding:24,width:360,boxShadow:"0 32px 80px rgba(0,0,0,0.7)" }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20 }}>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <div style={{ width:32,height:32,borderRadius:8,background:"rgba(69,137,255,0.1)",border:"1px solid rgba(69,137,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2" strokeLinecap="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
              </svg>
            </div>
            <div>
              <p style={{ fontSize:13,fontWeight:700,color:"var(--t1)" }}>Keyboard Shortcuts</p>
              <p style={{ fontSize:10,color:"var(--t4)" }}>Press <kbd style={{ fontFamily:"monospace",background:"var(--surface2)",border:"1px solid var(--border2)",borderRadius:3,padding:"1px 5px",fontSize:9,color:"var(--t3)" }}>?</kbd> to toggle</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background:"none",border:"none",cursor:"pointer",color:"var(--t4)",fontSize:16,lineHeight:1,padding:4 }}
            onMouseEnter={e=>(e.currentTarget as HTMLElement).style.color="var(--t1)"}
            onMouseLeave={e=>(e.currentTarget as HTMLElement).style.color="var(--t4)"}
          >✕</button>
        </div>
        <div style={{ display:"flex",flexDirection:"column",gap:2 }}>
          {SHORTCUTS.map(s=>(
            <div key={s.key} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 0",borderBottom:"1px solid var(--border)" }}>
              <span style={{ fontSize:12,color:"var(--t2)" }}>{s.desc}</span>
              <kbd style={{ fontFamily:"monospace",fontSize:11,fontWeight:700,background:"var(--surface2)",border:"1px solid var(--border2)",borderRadius:5,padding:"3px 10px",color:"var(--blue)",letterSpacing:"0.04em" }}>{s.key}</kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function EmailPage() {
  const [emails,        setEmails]        = useState<Email[]>([]);
  const [connected,     setConnected]     = useState(false);
  const [loading,       setLoading]       = useState(true);
  const [selected,      setSelected]      = useState<Email|null>(null);
  const [folder,        setFolder]        = useState<Folder>("all");
  const [search,        setSearch]        = useState("");
  const [summaries,     setSummaries]     = useState<Record<string,string>>({});
  const [summaryLoad,   setSummaryLoad]   = useState(false);
  const [digest,        setDigest]        = useState("");
  const [digestLoad,    setDigestLoad]    = useState(false);
  const [aiActions,     setAiActions]     = useState<Record<string,string>>({});
  const [draftText,     setDraftText]     = useState("");
  const [drafting,      setDrafting]      = useState(false);
  const [draftSaved,    setDraftSaved]    = useState(false);
  const [aiReplyLoad,   setAiReplyLoad]   = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [noiseOpen,     setNoiseOpen]     = useState(false);

  const searchRef  = useRef<HTMLInputElement>(null);
  const composeRef = useRef<HTMLTextAreaElement>(null);

  /* ── Load emails ── */
  useEffect(()=>{
    fetch("/api/google/gmail?maxResults=50")
      .then(r=>r.json())
      .then(d=>{
        if (d.connected&&d.emails?.length>0) {
          setConnected(true);
          const parsed: Email[] = d.emails.map((e: { id:string;threadId:string;from:string;subject:string;snippet:string;body:string;date:string;unread:boolean;labels:string[] })=>{
            const {name,email} = parseSender(e.from);
            return {id:e.id,threadId:e.threadId,from:name,fromEmail:email,subject:e.subject,preview:e.snippet,body:e.body,time:relativeTime(e.date),unread:e.unread,labels:e.labels,category:categorize(e.labels)};
          });
          setEmails(parsed);
          setSelected(parsed.find(e=>e.category==="action")??parsed[0]??null);
          /* Background: summaries */
          setSummaryLoad(true);
          fetch("/api/email/summaries",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({emails:parsed.map(e=>({id:e.id,from:e.from,subject:e.subject,preview:e.preview}))})})
            .then(r=>r.json()).then(j=>{if(j.summaries) setSummaries(j.summaries);}).catch(()=>{}).finally(()=>setSummaryLoad(false));
          /* Background: digest */
          setDigestLoad(true);
          fetch("/api/email/digest",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({emails:parsed.map(e=>({from:e.from,subject:e.subject,snippet:e.preview,category:e.category}))})})
            .then(r=>r.json()).then(j=>{if(j.digest) setDigest(j.digest); if(j.actions) setAiActions(j.actions);}).catch(()=>{}).finally(()=>setDigestLoad(false));
        } else {
          setEmails(PLACEHOLDER); setSelected(PLACEHOLDER[0]);
        }
      })
      .catch(()=>{setEmails(PLACEHOLDER); setSelected(PLACEHOLDER[0]);})
      .finally(()=>setLoading(false));
  },[]);

  /* ── Computed lists ── */
  const visible = emails.filter(e=>!e.snoozed);
  const folderFiltered = visible.filter(e=>{
    if (folder==="action")      return e.category==="action";
    if (folder==="fyi")         return e.category==="fyi";
    if (folder==="newsletters") return isNewsletter(e);
    if (folder==="noise")       return e.category==="noise";
    return true;
  });
  const listEmails = folderFiltered.filter(e=>
    !search || e.subject.toLowerCase().includes(search.toLowerCase()) || e.from.toLowerCase().includes(search.toLowerCase())
  );

  const actionCount  = visible.filter(e=>e.category==="action").length;
  const fyiCount     = visible.filter(e=>e.category==="fyi").length;
  const nlCount      = visible.filter(e=>isNewsletter(e)).length;
  const noiseCount   = visible.filter(e=>e.category==="noise").length;
  const unreadCount  = visible.filter(e=>e.unread).length;

  /* ── Actions ── */
  function snooze(id: string) {
    setEmails(prev=>prev.map(e=>e.id===id?{...e,snoozed:true}:e));
    if (selected?.id===id) {
      const idx = listEmails.findIndex(e=>e.id===id);
      const next = listEmails[idx+1]??listEmails[idx-1]??null;
      setSelected(next);
    }
  }
  function pin(id: string) { setEmails(prev=>prev.map(e=>e.id===id?{...e,pinned:!e.pinned}:e)); }

  async function saveDraft() {
    if (!selected||!draftText.trim()) return;
    setDrafting(true);
    try {
      await fetch("/api/google/gmail",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({to:selected.fromEmail,subject:`Re: ${selected.subject}`,body:draftText,threadId:selected.threadId})});
      setDraftSaved(true); setDraftText("");
      setTimeout(()=>setDraftSaved(false),3000);
    } finally { setDrafting(false); }
  }

  async function generateAiReply(email: Email) {
    setAiReplyLoad(true); setDraftText("");
    try {
      const res  = await fetch("/api/email/reply",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({from:email.from,subject:email.subject,body:email.body||email.preview})});
      const data = await res.json();
      if (data.reply) { setDraftText(data.reply); setTimeout(()=>composeRef.current?.focus(),100); }
    } catch {}
    setAiReplyLoad(false);
  }

  function selectEmail(e: Email) { setSelected(e); setDraftText(""); }

  /* ── Keyboard shortcuts ── */
  const handleKey = useCallback((e: KeyboardEvent)=>{
    const target = e.target as HTMLElement;
    if (target.tagName==="INPUT"||target.tagName==="TEXTAREA") {
      if (e.key==="Escape") (target as HTMLInputElement).blur();
      return;
    }
    const idx = listEmails.findIndex(em=>em.id===selected?.id);
    switch (e.key) {
      case "j": case "ArrowDown": e.preventDefault(); if(idx<listEmails.length-1) setSelected(listEmails[idx+1]); break;
      case "k": case "ArrowUp":   e.preventDefault(); if(idx>0) setSelected(listEmails[idx-1]); break;
      case "r": e.preventDefault(); composeRef.current?.focus(); break;
      case "d": e.preventDefault(); if(selected) generateAiReply(selected); break;
      case "e": e.preventDefault(); if(selected) snooze(selected.id); break;
      case "/": e.preventDefault(); searchRef.current?.focus(); break;
      case "?": setShowShortcuts(v=>!v); break;
      case "Escape": setShowShortcuts(false); break;
    }
  },[listEmails,selected]);

  useEffect(()=>{
    document.addEventListener("keydown",handleKey);
    return ()=>document.removeEventListener("keydown",handleKey);
  },[handleKey]);

  /* ── Priority pill ── */
  function priorityPill(email: Email) {
    if (email.labels.includes("STARRED")) return { label:"URGENT", color:"var(--red)", bg:"rgba(239,68,68,0.1)", border:"rgba(239,68,68,0.25)" };
    if (email.category==="action") return { label:"REPLY NEEDED", color:"var(--amber)", bg:"rgba(245,158,11,0.1)", border:"rgba(245,158,11,0.25)" };
    if (email.category==="fyi") return { label:"FYI", color:"var(--blue)", bg:"rgba(69,137,255,0.1)", border:"rgba(69,137,255,0.25)" };
    return { label:"NOISE", color:"var(--t4)", bg:"rgba(255,255,255,0.04)", border:"var(--border)" };
  }

  if (loading) return (
    <div style={{ display:"flex",height:"100vh",background:"var(--bg)",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:14 }}>
      <div style={{ display:"flex",gap:6 }}>
        {[0,1,2].map(i=><div key={i} style={{ width:8,height:8,borderRadius:"50%",background:"var(--blue)",opacity:0.5,animation:`bounce 0.8s ease-in-out ${i*0.18}s infinite` }}/>)}
      </div>
      <p style={{ fontSize:12,color:"var(--t4)" }}>Loading inbox…</p>
    </div>
  );

  const pill = selected ? priorityPill(selected) : null;

  return (
    <div style={{ display:"flex",height:"100vh",background:"var(--bg)",overflow:"hidden" }}>

      {/* ── COL 1: SMART FOLDERS ── */}
      <div style={{ width:188,flexShrink:0,borderRight:"1px solid var(--border)",display:"flex",flexDirection:"column",background:"linear-gradient(180deg,#07090f 0%,#050710 100%)" }}>
        <div style={{ padding:"22px 16px 16px",borderBottom:"1px solid var(--border)" }}>
          <p style={{ fontSize:10,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:"var(--t3)",marginBottom:4 }}>Email</p>
          <div style={{ display:"flex",alignItems:"center",gap:6 }}>
            <h2 style={{ fontSize:20,fontWeight:800,color:"var(--t1)",letterSpacing:"-0.02em",flex:1 }}>Inbox</h2>
            {unreadCount>0&&<span style={{ fontSize:10,fontWeight:700,background:"var(--blue)",color:"#fff",borderRadius:"10px",padding:"2px 7px",fontFamily:"monospace" }}>{unreadCount}</span>}
          </div>
        </div>

        <nav style={{ flex:1,padding:"12px 10px",overflowY:"auto" }}>
          <p style={{ fontSize:9,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:"rgba(6,182,212,0.3)",padding:"0 6px 8px" }}>Smart Folders</p>
          {([
            { id:"all",         label:"All Mail",       count:visible.length,  dot:"var(--t3)" },
            { id:"action",      label:"Needs Action",   count:actionCount,     dot:"var(--red)" },
            { id:"fyi",         label:"FYI",            count:fyiCount,        dot:"var(--blue)" },
            { id:"newsletters", label:"Newsletters",    count:nlCount,         dot:"var(--amber)" },
            { id:"noise",       label:"Noise",          count:noiseCount,      dot:"var(--t4)" },
          ] as { id:Folder; label:string; count:number; dot:string }[]).map(f=>(
            <button key={f.id} onClick={()=>setFolder(f.id)} style={{ width:"100%",display:"flex",alignItems:"center",gap:9,padding:"9px 10px",borderRadius:7,cursor:"pointer",background:folder===f.id?"rgba(69,137,255,0.1)":"transparent",border:`1px solid ${folder===f.id?"rgba(69,137,255,0.2)":"transparent"}`,textAlign:"left",marginBottom:2,transition:"all .12s" }}
              onMouseEnter={e=>folder!==f.id&&((e.currentTarget as HTMLElement).style.background="rgba(255,255,255,0.03)")}
              onMouseLeave={e=>folder!==f.id&&((e.currentTarget as HTMLElement).style.background="transparent")}
            >
              <span style={{ width:6,height:6,borderRadius:"50%",background:folder===f.id?f.dot:f.dot+"60",flexShrink:0 }}/>
              <span style={{ flex:1,fontSize:12,fontWeight:folder===f.id?600:400,color:folder===f.id?"var(--t1)":"var(--t3)" }}>{f.label}</span>
              {f.count>0&&<span style={{ fontSize:10,color:folder===f.id?"var(--blue)":"var(--t4)",fontFamily:"monospace" }}>{f.count}</span>}
            </button>
          ))}
        </nav>

        {/* Connect / Status */}
        <div style={{ padding:"12px 16px",borderTop:"1px solid var(--border)" }}>
          {!connected ? (
            <a href="/api/auth/google" style={{ display:"block",textAlign:"center",padding:"8px",borderRadius:7,background:"rgba(69,137,255,0.08)",border:"1px solid rgba(69,137,255,0.2)",color:"var(--blue)",fontSize:11,fontWeight:700,textDecoration:"none" }}>Connect Gmail →</a>
          ) : (
            <div style={{ display:"flex",alignItems:"center",gap:6 }}>
              <span style={{ width:5,height:5,borderRadius:"50%",background:"var(--green)",boxShadow:"0 0 6px var(--green)",flexShrink:0 }}/>
              <span style={{ fontSize:10,color:"var(--green)",fontWeight:600 }}>Gmail live</span>
            </div>
          )}
        </div>
      </div>

      {/* ── COL 2: EMAIL LIST ── */}
      <div style={{ width:308,flexShrink:0,borderRight:"1px solid var(--border)",display:"flex",flexDirection:"column",overflow:"hidden" }}>
        {/* List header */}
        <div style={{ padding:"16px 16px 12px",borderBottom:"1px solid var(--border)",flexShrink:0 }}>
          {/* Search + eye icon */}
          <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:10 }}>
            <div style={{ flex:1,display:"flex",alignItems:"center",gap:7,background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:8,padding:"7px 11px" }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--t4)" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              <input ref={searchRef} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search…" style={{ background:"none",border:"none",outline:"none",fontSize:12,color:"var(--t1)",flex:1 }}/>
              {search&&<button onClick={()=>setSearch("")} style={{ background:"none",border:"none",cursor:"pointer",color:"var(--t4)",fontSize:12,lineHeight:1 }}>✕</button>}
            </div>
            {/* 👁 Eye icon — click for keyboard shortcuts */}
            <button onClick={()=>setShowShortcuts(v=>!v)} title="Keyboard shortcuts (?))" style={{ width:32,height:32,borderRadius:8,border:`1px solid ${showShortcuts?"rgba(69,137,255,0.4)":"var(--border)"}`,background:showShortcuts?"rgba(69,137,255,0.1)":"var(--surface2)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .15s",color:showShortcuts?"var(--blue)":"var(--t4)" }}
              onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor="rgba(69,137,255,0.4)";(e.currentTarget as HTMLElement).style.color="var(--blue)";}}
              onMouseLeave={e=>{if(!showShortcuts){(e.currentTarget as HTMLElement).style.borderColor="var(--border)";(e.currentTarget as HTMLElement).style.color="var(--t4)";}}}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
          </div>

          {/* M.A.X. situation report */}
          <div style={{ padding:"9px 11px",borderRadius:8,background:"rgba(69,137,255,0.04)",border:"1px solid rgba(69,137,255,0.1)" }}>
            <p style={{ fontSize:9,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"var(--blue)",marginBottom:3 }}>M.A.X.</p>
            <p style={{ fontSize:11,color:"var(--t3)",lineHeight:1.6 }}>
              {digestLoad ? (
                <span style={{ display:"inline-flex",gap:3,alignItems:"center",color:"var(--t4)" }}>
                  Analyzing inbox {[0,1,2].map(i=><span key={i} style={{ width:3,height:3,borderRadius:"50%",background:"var(--blue)",display:"inline-block",animation:`bounce 0.8s ease-in-out ${i*0.2}s infinite`,opacity:0.6 }}/>)}
                </span>
              ) : digest || (connected ? `${actionCount} email${actionCount!==1?"s":""} need action · ${unreadCount} unread` : "Connect Gmail for live triage.")}
            </p>
          </div>
        </div>

        {/* Email rows */}
        <div style={{ flex:1,overflowY:"auto" }}>
          {listEmails.length===0&&(
            <div style={{ padding:"40px 20px",textAlign:"center" }}>
              <p style={{ fontSize:12,color:"var(--t4)" }}>No emails in this folder.</p>
            </div>
          )}
          {listEmails.map(e=>{
            const color = avatarColor(e.from);
            const isSelected = selected?.id===e.id;
            const sum = summaries[e.id];
            const catDot = e.category==="action"?"var(--red)":e.category==="fyi"?"var(--blue)":"var(--t4)";
            return (
              <button key={e.id} onClick={()=>selectEmail(e)} style={{
                display:"flex",alignItems:"flex-start",gap:10,width:"100%",padding:"11px 14px",
                textAlign:"left",cursor:"pointer",borderBottom:"1px solid var(--border)",
                background:isSelected?"rgba(69,137,255,0.06)":"transparent",
                borderLeft:`3px solid ${e.unread?catDot:isSelected?"rgba(69,137,255,0.4)":"transparent"}`,
                transition:"background .1s",
              }}
                onMouseEnter={ev=>!isSelected&&((ev.currentTarget as HTMLElement).style.background="rgba(255,255,255,0.02)")}
                onMouseLeave={ev=>!isSelected&&((ev.currentTarget as HTMLElement).style.background="transparent")}
              >
                <div style={{ width:30,height:30,borderRadius:8,flexShrink:0,background:`${color}18`,border:`1px solid ${color}25`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color,marginTop:1 }}>
                  {initials(e.from)}
                </div>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ display:"flex",alignItems:"baseline",justifyContent:"space-between",marginBottom:2 }}>
                    <span style={{ fontSize:12,fontWeight:e.unread?700:500,color:e.unread?"var(--t1)":"var(--t2)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:160 }}>{e.from}</span>
                    <span style={{ fontSize:10,color:"var(--t4)",flexShrink:0,marginLeft:6,fontFamily:"monospace" }}>{e.time}</span>
                  </div>
                  <p style={{ fontSize:11,color:e.unread?"var(--t2)":"var(--t3)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:e.unread?500:400,marginBottom:2 }}>{e.subject}</p>
                  <p style={{ fontSize:10,color:"var(--t4)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontStyle: sum?"normal":"italic" }}>
                    {summaryLoad&&!sum ? <span style={{ opacity:0.5 }}>Analyzing…</span> : sum || e.preview.slice(0,60)}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── COL 3: READING PANE ── */}
      <div style={{ flex:1,overflow:"hidden",display:"flex",flexDirection:"column" }}>
        {!selected ? (
          <div style={{ flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12,color:"var(--t4)" }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
            </svg>
            <p style={{ fontSize:13 }}>Select an email to read</p>
            <p style={{ fontSize:11,opacity:0.6 }}>Press <kbd style={{ fontFamily:"monospace",background:"var(--surface2)",border:"1px solid var(--border2)",borderRadius:3,padding:"1px 6px",fontSize:10 }}>J</kbd> or <kbd style={{ fontFamily:"monospace",background:"var(--surface2)",border:"1px solid var(--border2)",borderRadius:3,padding:"1px 6px",fontSize:10 }}>K</kbd> to navigate</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ padding:"20px 28px 18px",borderBottom:"1px solid var(--border)",flexShrink:0 }}>
              {/* Priority pill + quick actions */}
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14 }}>
                <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                  {pill&&<span style={{ fontSize:9,fontWeight:800,padding:"4px 10px",borderRadius:5,background:pill.bg,border:`1px solid ${pill.border}`,color:pill.color,letterSpacing:"0.1em" }}>{pill.label}</span>}
                  {selected.unread&&<span style={{ fontSize:9,fontWeight:700,color:"var(--blue)",background:"rgba(69,137,255,0.1)",padding:"3px 8px",borderRadius:4,border:"1px solid rgba(69,137,255,0.2)" }}>UNREAD</span>}
                  {selected.pinned&&<span style={{ fontSize:9,fontWeight:700,color:"var(--amber)" }}>◆ PINNED</span>}
                </div>
                <div style={{ display:"flex",gap:6 }}>
                  <button onClick={()=>pin(selected.id)} title="Pin" style={{ padding:"6px 12px",borderRadius:7,cursor:"pointer",fontSize:11,fontWeight:600,background:"transparent",border:"1px solid var(--border)",color:selected.pinned?"var(--amber)":"var(--t3)",transition:"all .15s" }}
                    onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor="var(--amber)";(e.currentTarget as HTMLElement).style.color="var(--amber)";}}
                    onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor="var(--border)";(e.currentTarget as HTMLElement).style.color=selected.pinned?"var(--amber)":"var(--t3)";}}
                  >{selected.pinned?"Unpin":"Pin"}</button>
                  <button onClick={()=>snooze(selected.id)} title="Archive (E)" style={{ padding:"6px 12px",borderRadius:7,cursor:"pointer",fontSize:11,fontWeight:600,background:"transparent",border:"1px solid var(--border)",color:"var(--t3)",transition:"all .15s" }}
                    onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor="var(--red)";(e.currentTarget as HTMLElement).style.color="var(--red)";}}
                    onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor="var(--border)";(e.currentTarget as HTMLElement).style.color="var(--t3)";}}
                  >Archive</button>
                </div>
              </div>

              {/* Subject */}
              <h2 style={{ fontSize:19,fontWeight:700,color:"var(--t1)",lineHeight:1.3,letterSpacing:"-0.01em",marginBottom:14 }}>{selected.subject}</h2>

              {/* Sender */}
              <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                <div style={{ width:36,height:36,borderRadius:9,flexShrink:0,background:`${avatarColor(selected.from)}18`,border:`1px solid ${avatarColor(selected.from)}28`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:avatarColor(selected.from) }}>
                  {initials(selected.from)}
                </div>
                <div>
                  <p style={{ fontSize:13,fontWeight:600,color:"var(--t1)" }}>{selected.from}</p>
                  <p style={{ fontSize:11,color:"var(--t4)" }}>{selected.fromEmail} · {selected.time}</p>
                </div>
              </div>
            </div>

            {/* M.A.X. action hint */}
            {selected.category==="action"&&aiActions[selected.subject]&&(
              <div style={{ padding:"10px 28px 0",flexShrink:0 }}>
                <div style={{ display:"flex",alignItems:"flex-start",gap:9,padding:"10px 14px",borderRadius:8,background:"rgba(245,158,11,0.04)",border:"1px solid rgba(245,158,11,0.15)" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink:0,marginTop:2 }}>
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <p style={{ fontSize:11,color:"var(--t2)",lineHeight:1.6 }}>
                    <span style={{ fontWeight:700,color:"var(--amber)" }}>M.A.X.: </span>
                    {aiActions[selected.subject]}
                  </p>
                </div>
              </div>
            )}

            {/* Body */}
            <div style={{ flex:1,overflowY:"auto",padding:"22px 28px" }}>
              <div style={{ maxWidth:640 }}>
                <pre style={{ fontSize:13,color:"var(--t2)",lineHeight:1.9,whiteSpace:"pre-wrap",fontFamily:"inherit",margin:0 }}>
                  {selected.body||selected.preview}
                </pre>
              </div>
            </div>

            {/* Compose */}
            <div style={{ padding:"14px 28px 22px",borderTop:"1px solid var(--border)",flexShrink:0 }}>
              {draftSaved ? (
                <div style={{ display:"flex",alignItems:"center",gap:8,padding:"12px 16px",borderRadius:10,background:"rgba(34,197,94,0.06)",border:"1px solid rgba(34,197,94,0.18)" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                  <p style={{ fontSize:12,color:"var(--green)",fontWeight:600 }}>Draft saved to Gmail</p>
                </div>
              ) : (
                <div style={{ background:"var(--surface)",border:"1px solid var(--border)",borderRadius:12,overflow:"hidden" }}>
                  {/* Compose toolbar */}
                  <div style={{ display:"flex",alignItems:"center",gap:8,padding:"10px 14px",borderBottom:"1px solid var(--border)" }}>
                    <span style={{ fontSize:11,color:"var(--t4)",flex:1 }}>
                      Re: <span style={{ color:"var(--t3)" }}>{selected.from}</span>
                    </span>
                    <button onClick={()=>selected&&generateAiReply(selected)} disabled={aiReplyLoad} style={{ display:"flex",alignItems:"center",gap:6,padding:"5px 12px",borderRadius:6,background:"rgba(69,137,255,0.1)",border:"1px solid rgba(69,137,255,0.25)",color:"var(--blue)",fontSize:11,fontWeight:700,cursor:"pointer",opacity:aiReplyLoad?0.6:1 }}
                      onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background="rgba(69,137,255,0.18)"}
                      onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background="rgba(69,137,255,0.1)"}
                    >
                      {aiReplyLoad
                        ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ animation:"spin-slow 1s linear infinite" }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/></svg>
                        : <span style={{ fontWeight:900,fontSize:10 }}>M</span>
                      }
                      {aiReplyLoad?"Writing…":"Draft with M.A.X."}
                    </button>
                    <span style={{ fontSize:10,color:"var(--t4)",opacity:0.5 }}>D</span>
                  </div>
                  <textarea ref={composeRef} value={draftText} onChange={e=>setDraftText(e.target.value)} placeholder={connected?`Reply to ${selected.from}…`:"Connect Gmail to compose replies"} disabled={!connected} rows={4}
                    style={{ width:"100%",background:"none",border:"none",outline:"none",fontSize:13,color:"var(--t1)",padding:"14px 16px",resize:"none",fontFamily:"inherit",lineHeight:1.7,opacity:connected?1:0.5,boxSizing:"border-box" }}
                  />
                  {connected&&(
                    <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,padding:"8px 14px 12px" }}>
                      <div style={{ display:"flex",gap:4 }}>
                        <span style={{ fontSize:9,color:"var(--t4)",opacity:0.5 }}>R focus · E archive</span>
                      </div>
                      <div style={{ display:"flex",gap:8 }}>
                        {draftText&&<button onClick={()=>setDraftText("")} style={{ padding:"6px 12px",borderRadius:6,background:"none",border:"1px solid var(--border)",fontSize:11,fontWeight:600,color:"var(--t3)",cursor:"pointer" }}>Clear</button>}
                        <button onClick={saveDraft} disabled={drafting||!draftText.trim()} style={{ padding:"6px 16px",borderRadius:6,background:"rgba(69,137,255,0.12)",border:"1px solid rgba(69,137,255,0.3)",fontSize:12,fontWeight:700,color:"var(--blue)",cursor:"pointer",opacity:draftText.trim()?1:0.4 }}>
                          {drafting?"Saving…":"Save Draft"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Shortcuts Modal ── */}
      {showShortcuts&&<ShortcutsModal onClose={()=>setShowShortcuts(false)}/>}
    </div>
  );
}
