"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { HudCard } from "@/components/ui/HudCard";
import { Sparkline } from "@/components/ui/Sparkline";
import { supabase } from "@/lib/supabase";
import PlaidLinkButton from "@/components/ui/PlaidLinkButton";
import TransactionReview, { ReviewTransaction } from "@/components/ui/TransactionReview";

/* ─────────────── Types ─────────────── */
interface PlaidAccount   { id: string; plaid_account_id: string; name: string; type: string; subtype: string; institution: string; mask: string | null; current_balance: number | null; available_balance: number | null; last_synced: string | null }
interface WealthData     { ira: number; savings: number; btc_amount: number; xrp_amount: number }
interface IRAFund        { symbol: string; name: string; nav: number; chg: number; value: number; shares: number }
interface Bill           { name: string; amt: number; due: number }
interface LiveCrypto     { symbol: string; name: string; price: number; c24: number; c7: number; data: number[] }
interface WealthHistory  { recorded_at: string; net_worth: number }
interface BudgetAlloc    { id: string; category: string; budgeted: number; period_start: string }
interface Transaction    { id: string; date: string; amount: number; merchant: string; merchant_normalized: string; category: string; budget_category: string | null; pending: boolean }

/* ─────────────── Constants ─────────────── */
const CAT_COLORS: Record<string, string> = {
  Housing:"#4589ff", Food:"#10b981", Transport:"#f59e0b", Entertainment:"#8b5cf6",
  Subscriptions:"#06b6d4", Savings:"#10b981", Health:"#ef4444", Shopping:"#f97316",
  Personal:"#ec4899", Investing:"#6366f1", Misc:"#6b7280",
};
const ALL_CATEGORIES = Object.keys(CAT_COLORS);

const QUICK_DEFAULTS = [
  { category:"Housing", budgeted:950 }, { category:"Food", budgeted:400 },
  { category:"Transport", budgeted:150 }, { category:"Entertainment", budgeted:100 },
  { category:"Subscriptions", budgeted:75 }, { category:"Savings", budgeted:200 },
  { category:"Health", budgeted:50 }, { category:"Shopping", budgeted:100 },
  { category:"Personal", budgeted:80 }, { category:"Investing", budgeted:100 },
  { category:"Misc", budgeted:50 },
];

const WEALTH_DEFAULTS: WealthData = { ira:2720, savings:2800, btc_amount:0.02, xrp_amount:200 };

const IRA_INIT: IRAFund[] = [
  { symbol:"MDDVX", name:"Mid-Cap Growth", nav:42.18, chg:0.32,  value:1200, shares:28.45 },
  { symbol:"RPEAX", name:"Real Assets",    nav:11.44, chg:-0.18, value:880,  shares:76.92 },
  { symbol:"PTTRX", name:"Total Return",   nav:9.87,  chg:0.05,  value:640,  shares:64.84 },
];

const BILLS_INIT: Bill[] = [
  { name:"Rent", amt:950, due:1 }, { name:"Spotify", amt:10.99, due:3 },
  { name:"Phone", amt:75, due:8 }, { name:"Netflix", amt:15.49, due:18 },
  { name:"Gym", amt:40, due:22 },
];

/* ─────────────── Helpers ─────────────── */
function periodStart(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`;
}
function nextPeriod(p: string) {
  const d = new Date(p + "T12:00:00"); d.setMonth(d.getMonth()+1); return periodStart(d);
}
function fmt(n: number) { return n.toLocaleString("en-US", { minimumFractionDigits:2, maximumFractionDigits:2 }); }
function fmtK(n: number) { return n >= 1000 ? `${(n/1000).toFixed(1)}k` : fmtInt(n); }
function fmtInt(n: number) { return n.toLocaleString("en-US", { maximumFractionDigits:0 }); }

/* ─────────────── Small shared UI ─────────────── */
function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding:"10px 20px", borderRadius:8, fontSize:13, fontWeight:active?700:500, cursor:"pointer",
      background: active ? "rgba(69,137,255,0.12)" : "transparent",
      border: `1px solid ${active ? "rgba(69,137,255,0.35)" : "transparent"}`,
      color: active ? "var(--blue)" : "var(--t3)",
      transition:"all 0.15s",
    }}
    onMouseEnter={e=>{ if(!active)(e.currentTarget as HTMLElement).style.color="var(--t2)"; }}
    onMouseLeave={e=>{ if(!active)(e.currentTarget as HTMLElement).style.color="var(--t3)"; }}
    >
      {label}
    </button>
  );
}

function StatPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div style={{ fontSize:10, color:"var(--t4)", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:5 }}>{label}</div>
      <div style={{ fontSize:20, fontWeight:700, fontFamily:"monospace", color }}>{value}</div>
    </div>
  );
}

function SmallEditBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ background:"none", border:"1px solid var(--border)", borderRadius:5, padding:"4px 8px", cursor:"pointer", color:"var(--t3)", fontSize:11, fontWeight:600, transition:"all .15s" }}
      onMouseEnter={e=>{ (e.currentTarget as HTMLElement).style.borderColor="var(--blue)"; (e.currentTarget as HTMLElement).style.color="var(--blue)"; }}
      onMouseLeave={e=>{ (e.currentTarget as HTMLElement).style.borderColor="var(--border)"; (e.currentTarget as HTMLElement).style.color="var(--t3)"; }}
    >Edit</button>
  );
}

/* ─────────────── Modals ─────────────── */
function IncomeModal({ current, onSave, onClose }: { current:number; onSave:(n:number)=>void; onClose:()=>void }) {
  const [val, setVal] = useState(String(current||""));
  return (
    <div style={{ position:"fixed",inset:0,zIndex:100,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center" }} onClick={onClose}>
      <div style={{ background:"var(--surface)",border:"1px solid var(--border2)",borderRadius:12,padding:"28px 32px",width:340 }} onClick={e=>e.stopPropagation()}>
        <h3 style={{ fontSize:16,fontWeight:700,color:"var(--t1)",marginBottom:20 }}>Monthly Income</h3>
        <div style={{ position:"relative",marginBottom:24 }}>
          <span style={{ position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:"var(--t3)",fontFamily:"monospace",fontSize:16 }}>$</span>
          <input type="number" autoFocus value={val} onChange={e=>setVal(e.target.value)}
            onKeyDown={e=>{ if(e.key==="Enter"){onSave(parseFloat(val)||0);onClose();} if(e.key==="Escape")onClose(); }}
            style={{ width:"100%",background:"var(--surface2)",border:"1px solid var(--border2)",borderRadius:7,padding:"12px 12px 12px 28px",color:"var(--t1)",fontFamily:"monospace",fontSize:18,fontWeight:700,outline:"none" }}
            onFocus={e=>e.target.style.borderColor="var(--blue)"} onBlur={e=>e.target.style.borderColor="var(--border2)"}
          />
        </div>
        <div style={{ display:"flex",gap:10 }}>
          <button onClick={onClose} style={{ flex:1,padding:"11px 0",borderRadius:6,fontSize:13,fontWeight:600,cursor:"pointer",background:"transparent",border:"1px solid var(--border2)",color:"var(--t3)" }}>Cancel</button>
          <button onClick={()=>{onSave(parseFloat(val)||0);onClose();}} style={{ flex:2,padding:"11px 0",borderRadius:6,fontSize:13,fontWeight:700,cursor:"pointer",background:"rgba(69,137,255,0.15)",border:"1px solid rgba(69,137,255,0.4)",color:"var(--blue)" }}>Save</button>
        </div>
      </div>
    </div>
  );
}

function AllocModal({ alloc, existingCats, onSave, onDelete, onClose }: { alloc?:BudgetAlloc; existingCats:string[]; onSave:(cat:string,budgeted:number,id?:string)=>void; onDelete?:()=>void; onClose:()=>void }) {
  const available = ALL_CATEGORIES.filter(c=>!existingCats.includes(c)||c===alloc?.category);
  const [cat, setCat] = useState(alloc?.category??available[0]??"");
  const [amt, setAmt] = useState(String(alloc?.budgeted??""));
  return (
    <div style={{ position:"fixed",inset:0,zIndex:100,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center" }} onClick={onClose}>
      <div style={{ background:"var(--surface)",border:"1px solid var(--border2)",borderRadius:12,padding:"28px 32px",width:380 }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:22 }}>
          <h3 style={{ fontSize:16,fontWeight:700,color:"var(--t1)" }}>{alloc?"Edit Category":"Add Category"}</h3>
          <button onClick={onClose} style={{ background:"none",border:"none",cursor:"pointer",color:"var(--t3)" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
        </div>
        <div style={{ display:"flex",flexDirection:"column",gap:14,marginBottom:22 }}>
          <div>
            <label style={{ fontSize:11,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"var(--t3)",display:"block",marginBottom:6 }}>Category</label>
            <select value={cat} onChange={e=>setCat(e.target.value)} disabled={!!alloc}
              style={{ width:"100%",background:"var(--surface2)",border:"1px solid var(--border2)",borderRadius:6,padding:"10px 12px",color:"var(--t1)",fontSize:14,fontWeight:600,outline:"none" }}>
              {available.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize:11,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"var(--t3)",display:"block",marginBottom:6 }}>Monthly Budget</label>
            <div style={{ position:"relative" }}>
              <span style={{ position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:"var(--t3)",fontFamily:"monospace" }}>$</span>
              <input type="number" autoFocus={!alloc} value={amt} onChange={e=>setAmt(e.target.value)}
                onKeyDown={e=>{ if(e.key==="Enter")onSave(cat,parseFloat(amt)||0,alloc?.id); if(e.key==="Escape")onClose(); }}
                style={{ width:"100%",background:"var(--surface2)",border:"1px solid var(--border2)",borderRadius:6,padding:"10px 12px 10px 26px",color:"var(--t1)",fontFamily:"monospace",fontSize:15,fontWeight:700,outline:"none" }}
                onFocus={e=>e.target.style.borderColor="var(--blue)"} onBlur={e=>e.target.style.borderColor="var(--border2)"}
              />
            </div>
          </div>
        </div>
        <div style={{ display:"flex",gap:10 }}>
          {onDelete&&<button onClick={onDelete} style={{ padding:"11px 14px",borderRadius:6,fontSize:13,fontWeight:600,cursor:"pointer",background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",color:"var(--red)" }}>Delete</button>}
          <button onClick={onClose} style={{ flex:1,padding:"11px 0",borderRadius:6,fontSize:13,fontWeight:600,cursor:"pointer",background:"transparent",border:"1px solid var(--border2)",color:"var(--t3)" }}>Cancel</button>
          <button onClick={()=>onSave(cat,parseFloat(amt)||0,alloc?.id)} style={{ flex:2,padding:"11px 0",borderRadius:6,fontSize:13,fontWeight:700,cursor:"pointer",background:"rgba(69,137,255,0.15)",border:"1px solid rgba(69,137,255,0.4)",color:"var(--blue)" }}>Save</button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Main page ─────────────── */
type Tab = "overview" | "budget" | "investments" | "transactions";

export default function FinancePage() {
  const [tab,          setTab]          = useState<Tab>("overview");
  const [accounts,     setAccounts]     = useState<PlaidAccount[]>([]);
  const [wealth,       setWealth]       = useState<WealthData>(WEALTH_DEFAULTS);
  const [ira,          setIra]          = useState<IRAFund[]>(IRA_INIT);
  const [bills,        setBills]        = useState<Bill[]>(BILLS_INIT);
  const [live,         setLive]         = useState<LiveCrypto[]>([]);
  const [history,      setHistory]      = useState<WealthHistory[]>([]);
  const [allocations,  setAllocations]  = useState<BudgetAlloc[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [income,       setIncome]       = useState(0);
  const [period,       setPeriod]       = useState(periodStart());
  const [syncing,      setSyncing]      = useState(false);
  const [aiRunning,    setAiRunning]    = useState(false);
  const [lastSync,     setLastSync]     = useState<string|null>(null);
  const [modal,        setModal]        = useState<"income"|"addAlloc"|{type:"edit";alloc:BudgetAlloc}|"bills"|null>(null);
  const [txSearch,     setTxSearch]     = useState("");
  const [txCatFilter,  setTxCatFilter]  = useState<string|null>(null);
  const [reviewQueue,  setReviewQueue]  = useState<ReviewTransaction[]>([]);
  const [reviewing,    setReviewing]    = useState(false);
  const [saving,       setSaving]       = useState(false);

  /* ── Load all data ── */
  useEffect(() => { loadAll(); }, [period]);

  async function loadAll() {
    const [accountsRes, wealthRes, iraRes, billsRes, histRes, cryptoRes, allocRes, txRes, incomeRes] = await Promise.allSettled([
      supabase.from("accounts").select("*").eq("active", true).order("institution"),
      supabase.from("wealth").select("*").eq("id","max").single(),
      supabase.from("ira_funds").select("*"),
      supabase.from("bills").select("*").order("due"),
      supabase.from("wealth_history").select("recorded_at,net_worth").order("recorded_at",{ascending:true}).limit(30),
      fetch("/api/crypto").then(r=>r.json()).catch(()=>null),
      supabase.from("budget_allocations").select("*").eq("period_start",period).order("category"),
      supabase.from("transactions").select("*").gte("date",period).lt("date",nextPeriod(period)).order("date",{ascending:false}).limit(500),
      supabase.from("settings").select("value").eq("key","monthly_income").single(),
    ]);

    if (accountsRes.status==="fulfilled"&&accountsRes.value.data) {
      const accts = accountsRes.value.data as PlaidAccount[];
      setAccounts(accts);
      const synced = accts.map(a=>a.last_synced).filter(Boolean).sort().pop();
      if (synced) setLastSync(synced);
    }
    if (wealthRes.status==="fulfilled"&&wealthRes.value.data)  setWealth(w=>({...w,...wealthRes.value.data}));
    if (iraRes.status==="fulfilled"&&iraRes.value.data?.length) setIra(iraRes.value.data as IRAFund[]);
    if (billsRes.status==="fulfilled"&&billsRes.value.data?.length) setBills(billsRes.value.data as Bill[]);
    if (histRes.status==="fulfilled"&&histRes.value.data?.length) setHistory(histRes.value.data as WealthHistory[]);
    if (cryptoRes.status==="fulfilled"&&cryptoRes.value?.data) {
      const btc = cryptoRes.value.data.find((d:{symbol:string})=>d.symbol==="BTC");
      const xrp = cryptoRes.value.data.find((d:{symbol:string})=>d.symbol==="XRP");
      const next:LiveCrypto[]=[];
      if (btc) next.push({symbol:"BTC",name:"Bitcoin",price:btc.price,c24:btc.change24h??0,c7:btc.change7d??0,data:btc.sparkline?.slice(-20)??[]});
      if (xrp) next.push({symbol:"XRP",name:"Ripple",price:xrp.price,c24:xrp.change24h??0,c7:xrp.change7d??0,data:xrp.sparkline?.slice(-20)??[]});
      setLive(next);
    }
    if (allocRes.status==="fulfilled"&&allocRes.value.data) setAllocations(allocRes.value.data as BudgetAlloc[]);
    if (txRes.status==="fulfilled"&&txRes.value.data) setTransactions(txRes.value.data as Transaction[]);
    if (incomeRes.status==="fulfilled"&&incomeRes.value.data) setIncome(Number(incomeRes.value.data.value)||0);
  }

  /* ── Real-time wealth updates ── */
  useEffect(() => {
    const ch = supabase.channel("finance-wealth").on("postgres_changes",{event:"*",schema:"public",table:"wealth"},p=>{ if(p.new) setWealth(w=>({...w,...(p.new as WealthData)})); }).subscribe();
    return ()=>{ supabase.removeChannel(ch); };
  }, []);

  /* ── Computed values ── */
  const btcPrice    = live.find(l=>l.symbol==="BTC")?.price ?? 75912;
  const xrpPrice    = live.find(l=>l.symbol==="XRP")?.price ?? 1.43;
  const btcVal      = btcPrice * wealth.btc_amount;
  const xrpVal      = xrpPrice * wealth.xrp_amount;
  const cryptoTotal = btcVal + xrpVal;
  const iraTotal    = ira.reduce((a,f)=>a+f.value,0);
  const bankTotal   = accounts.filter(a=>a.type!=="credit"&&a.current_balance!=null).reduce((a,b)=>a+(b.current_balance??0),0);
  const netWorth    = cryptoTotal + iraTotal + wealth.savings;
  const billsTotal  = bills.reduce((a,b)=>a+b.amt,0);
  const dayOfMonth  = new Date().getDate();

  const spendByCategory = useMemo(()=>{
    const map:Record<string,number>={};
    for (const tx of transactions) {
      if (tx.pending||tx.amount<=0) continue;
      const cat=tx.budget_category??tx.category??"Misc";
      map[cat]=(map[cat]??0)+tx.amount;
    }
    return map;
  },[transactions]);

  const totalBudgeted = allocations.reduce((a,b)=>a+b.budgeted,0);
  const totalSpent    = Object.values(spendByCategory).reduce((a,b)=>a+b,0);
  const readyToAssign = income - totalBudgeted;

  const sortedBills = [...bills].sort((a,b)=>{
    const da=a.due>=dayOfMonth?a.due-dayOfMonth:a.due+31-dayOfMonth;
    const db=b.due>=dayOfMonth?b.due-dayOfMonth:b.due+31-dayOfMonth;
    return da-db;
  });

  const filteredTx = useMemo(()=>{
    return transactions.filter(tx=>{
      if (tx.amount<=0||tx.pending) return false;
      const cat = tx.budget_category??tx.category??"";
      if (txCatFilter && cat!==txCatFilter) return false;
      if (txSearch && !tx.merchant.toLowerCase().includes(txSearch.toLowerCase())) return false;
      return true;
    });
  },[transactions,txSearch,txCatFilter]);

  /* ── Actions ── */
  async function syncNow() {
    setSyncing(true);
    try { await fetch("/api/plaid/sync",{method:"POST"}); await loadAll(); } finally { setSyncing(false); }
  }

  async function runAICategorize() {
    setAiRunning(true);
    try {
      await fetch("/api/transactions/ai-categorize",{method:"POST"});
      await loadAll();
      // Build review queue from AI-categorized transactions (unconfirmed rules)
      const { data: rules } = await supabase.from("merchant_rules").select("merchant_pattern,category").eq("confirmed",false);
      if (rules&&rules.length>0) {
        const unconfirmedPatterns = new Set(rules.map(r=>r.merchant_pattern));
        const queue = transactions
          .filter(tx=>tx.budget_category&&unconfirmedPatterns.has(tx.merchant_normalized)&&tx.amount>0&&!tx.pending)
          .filter((tx,i,arr)=>arr.findIndex(t=>t.merchant_normalized===tx.merchant_normalized)===i) // dedupe by merchant
          .map(tx=>({...tx} as ReviewTransaction));
        if (queue.length>0) { setReviewQueue(queue); setReviewing(true); }
      }
    } finally { setAiRunning(false); }
  }

  const confirmCategory = useCallback(async (tx: ReviewTransaction, category: string) => {
    await supabase.from("transactions").update({budget_category:category}).eq("merchant_normalized",tx.merchant_normalized);
    await supabase.from("merchant_rules").upsert({merchant_pattern:tx.merchant_normalized,category,confirmed:true},{onConflict:"merchant_pattern"});
    setTransactions(prev=>prev.map(t=>t.merchant_normalized===tx.merchant_normalized?{...t,budget_category:category}:t));
  },[]);

  async function saveIncome(amount:number) {
    setIncome(amount);
    await supabase.from("settings").upsert({key:"monthly_income",value:amount});
  }

  async function saveAlloc(category:string, budgeted:number, id?:string) {
    if (id) {
      const {data}=await supabase.from("budget_allocations").update({budgeted}).eq("id",id).select().single();
      if (data) setAllocations(prev=>prev.map(a=>a.id===id?data:a));
    } else {
      const {data}=await supabase.from("budget_allocations").insert({category,budgeted,period_start:period,rollover:false}).select().single();
      if (data) setAllocations(prev=>[...prev,data].sort((a,b)=>a.category.localeCompare(b.category)));
    }
    setModal(null);
  }

  async function deleteAlloc(id:string) {
    await supabase.from("budget_allocations").delete().eq("id",id);
    setAllocations(prev=>prev.filter(a=>a.id!==id));
    setModal(null);
  }

  async function quickBudgetSetup() {
    const rows=QUICK_DEFAULTS.map(d=>({...d,period_start:period,rollover:false}));
    const {data}=await supabase.from("budget_allocations").upsert(rows,{onConflict:"category,period_start"}).select();
    if (data) setAllocations(data);
    await supabase.from("settings").upsert({key:"monthly_income",value:3000});
    setIncome(3000);
  }

  async function saveWealth(updates:Partial<WealthData>) {
    const updated={...wealth,...updates};
    setWealth(updated);
    await supabase.from("wealth").upsert({id:"max",...updated});
  }

  async function saveBills(updated:Bill[]) {
    setBills(updated);
    setSaving(true);
    await supabase.from("bills").delete().neq("name","NEVER_MATCH");
    await supabase.from("bills").insert(updated);
    setSaving(false);
  }

  /* ── Render ── */
  return (
    <div style={{ padding:"36px 44px", background:"var(--bg)", minHeight:"100vh" }}>
      {/* Modals */}
      {modal==="income"&&<IncomeModal current={income} onSave={saveIncome} onClose={()=>setModal(null)}/>}
      {modal==="addAlloc"&&<AllocModal existingCats={allocations.map(a=>a.category)} onSave={saveAlloc} onClose={()=>setModal(null)}/>}
      {modal!==null&&typeof modal==="object"&&modal.type==="edit"&&<AllocModal alloc={modal.alloc} existingCats={allocations.map(a=>a.category)} onSave={saveAlloc} onDelete={()=>deleteAlloc(modal.alloc.id)} onClose={()=>setModal(null)}/>}
      {saving&&<div style={{position:"fixed",bottom:24,right:24,zIndex:200,fontSize:12,color:"var(--t3)",background:"var(--surface)",border:"1px solid var(--border)",borderRadius:8,padding:"10px 16px"}}>Saving…</div>}

      <div style={{ maxWidth:1140 }}>
        {/* ─── Header ─── */}
        <div style={{ marginBottom:28, display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
          <div>
            <p style={{ fontSize:11,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:"var(--blue)",opacity:0.7,marginBottom:8 }}>Finance Hub</p>
            <h1 style={{ fontSize:32,fontWeight:800,color:"var(--t1)",letterSpacing:"-0.02em",marginBottom:4 }}>
              ${fmtInt(netWorth)}
              <span style={{ fontSize:16,fontWeight:500,color:"var(--t3)",marginLeft:10 }}>net worth</span>
            </h1>
            {lastSync&&<p style={{ fontSize:11,color:"var(--t4)" }}>Synced {new Date(lastSync).toLocaleString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})}</p>}
          </div>
          <div style={{ display:"flex",gap:10,alignItems:"center" }}>
            {accounts.length>0&&(
              <button onClick={syncNow} disabled={syncing} style={{ padding:"9px 16px",borderRadius:7,fontSize:12,fontWeight:600,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.09)",color:syncing?"var(--t4)":"var(--t2)",cursor:syncing?"not-allowed":"pointer",display:"flex",alignItems:"center",gap:6,transition:"all 0.15s" }}
                onMouseEnter={e=>{if(!syncing)(e.currentTarget as HTMLElement).style.background="rgba(255,255,255,0.08)";}}
                onMouseLeave={e=>{if(!syncing)(e.currentTarget as HTMLElement).style.background="rgba(255,255,255,0.04)";}}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{animation:syncing?"spin-slow 1s linear infinite":"none"}}>
                  <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
                {syncing?"Syncing…":"Sync Now"}
              </button>
            )}
            <PlaidLinkButton onConnected={loadAll}/>
          </div>
        </div>

        {/* ─── Tab bar ─── */}
        <div style={{ display:"flex",gap:4,marginBottom:28,padding:"4px",background:"rgba(255,255,255,0.03)",borderRadius:10,border:"1px solid rgba(255,255,255,0.06)",width:"fit-content" }}>
          {(["overview","budget","investments","transactions"] as Tab[]).map(t=>(
            <TabBtn key={t} label={t.charAt(0).toUpperCase()+t.slice(1)} active={tab===t} onClick={()=>setTab(t)}/>
          ))}
        </div>

        {/* ════════════════════════════════════════
             TAB: OVERVIEW
            ════════════════════════════════════════ */}
        {tab==="overview"&&(
          <div style={{ display:"flex",flexDirection:"column",gap:16 }}>

            {/* Net worth breakdown */}
            <HudCard style={{ padding:"24px 28px" }} delay={0.05}>
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20 }}>
                <h2 style={{ fontSize:14,fontWeight:700,color:"var(--t1)" }}>Portfolio Breakdown</h2>
                {history.length>=2&&(
                  <span style={{ fontSize:11,fontWeight:600,color:history[history.length-1].net_worth>=history[0].net_worth?"var(--green)":"var(--red)" }}>
                    {history[history.length-1].net_worth>=history[0].net_worth?"+":""}{fmtInt(history[history.length-1].net_worth-history[0].net_worth)} vs 30d ago
                  </span>
                )}
              </div>
              <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16 }}>
                {[
                  {label:"Crypto",value:`$${fmtInt(cryptoTotal)}`,color:"var(--amber)"},
                  {label:"Roth IRA",value:`$${fmtInt(iraTotal)}`,color:"var(--blue)"},
                  {label:"Savings",value:`$${fmtInt(wealth.savings)}`,color:"var(--green)"},
                  {label:"Bank Accounts",value:accounts.length?`$${fmtInt(bankTotal)}`:"Not linked",color:accounts.length?"var(--t1)":"var(--t4)"},
                ].map(s=>(
                  <div key={s.label} style={{ padding:"14px 16px",borderRadius:8,background:"var(--surface2)",border:"1px solid var(--border)" }}>
                    <div style={{ fontSize:11,color:"var(--t4)",marginBottom:8 }}>{s.label}</div>
                    <div style={{ fontSize:20,fontWeight:800,fontFamily:"monospace",color:s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>
              {history.length>=2&&(
                <Sparkline data={history.map(h=>h.net_worth)} color="var(--blue)" height={52} id="nw-overview"/>
              )}
            </HudCard>

            {/* Accounts + Budget health */}
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:16 }}>

              {/* Accounts */}
              <HudCard style={{ padding:"22px 24px" }} delay={0.08}>
                <h2 style={{ fontSize:14,fontWeight:700,color:"var(--t1)",marginBottom:16 }}>Bank Accounts</h2>
                {accounts.length===0?(
                  <div style={{ padding:"20px 0",textAlign:"center" }}>
                    <div style={{ fontSize:13,color:"var(--t3)",marginBottom:16 }}>No accounts connected</div>
                    <PlaidLinkButton onConnected={loadAll}/>
                  </div>
                ):(
                  <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                    {accounts.map(a=>{
                      const typeColor=a.type==="credit"?"var(--red)":a.subtype==="savings"?"var(--green)":"var(--blue)";
                      const bal=a.current_balance;
                      return (
                        <div key={a.plaid_account_id} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"11px 14px",borderRadius:8,background:"var(--surface2)",border:"1px solid var(--border)" }}>
                          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                            <div style={{ width:32,height:32,borderRadius:7,background:`${typeColor}14`,border:`1px solid ${typeColor}28`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:typeColor }}>
                              {a.institution.slice(0,2).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontSize:13,fontWeight:600,color:"var(--t1)" }}>{a.name} {a.mask&&<span style={{ color:"var(--t4)",fontWeight:400,fontSize:11 }}>···{a.mask}</span>}</div>
                              <div style={{ fontSize:11,color:"var(--t4)" }}>{a.institution} · {a.subtype}</div>
                            </div>
                          </div>
                          <div style={{ fontSize:15,fontWeight:700,fontFamily:"monospace",color:a.type==="credit"&&bal&&bal>0?"var(--red)":"var(--t1)" }}>
                            {bal!=null?`$${fmt(Math.abs(bal))}`:"—"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </HudCard>

              {/* Budget health */}
              <HudCard style={{ padding:"22px 24px" }} delay={0.1}>
                <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16 }}>
                  <h2 style={{ fontSize:14,fontWeight:700,color:"var(--t1)" }}>Budget Health</h2>
                  <button onClick={()=>setTab("budget")} style={{ fontSize:11,color:"var(--blue)",background:"none",border:"none",cursor:"pointer",fontWeight:600 }}>View Full →</button>
                </div>
                {allocations.length===0?(
                  <div style={{ padding:"16px 0",textAlign:"center" }}>
                    <div style={{ fontSize:13,color:"var(--t3)",marginBottom:12 }}>Budget not set up</div>
                    <button onClick={()=>setTab("budget")} style={{ padding:"8px 16px",borderRadius:7,fontSize:12,fontWeight:600,background:"rgba(69,137,255,0.1)",border:"1px solid rgba(69,137,255,0.25)",color:"var(--blue)",cursor:"pointer" }}>Set Up Budget</button>
                  </div>
                ):(
                  <>
                    <div style={{ display:"flex",gap:20,marginBottom:16 }}>
                      <StatPill label="Ready to Assign" value={`$${fmtInt(Math.abs(readyToAssign))}`} color={readyToAssign>=0?"var(--green)":"var(--red)"}/>
                      <StatPill label="Spent This Month" value={`$${fmtInt(totalSpent)}`} color="var(--amber)"/>
                    </div>
                    <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                      {allocations.slice(0,4).map(a=>{
                        const spent=spendByCategory[a.category]??0;
                        const pct=a.budgeted>0?(spent/a.budgeted)*100:0;
                        const color=CAT_COLORS[a.category]??"#4589ff";
                        const status=pct>=100?"var(--red)":pct>=80?"var(--amber)":"var(--green)";
                        return (
                          <div key={a.id}>
                            <div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
                              <span style={{ fontSize:12,color:"var(--t2)" }}>{a.category}</span>
                              <span style={{ fontSize:12,fontFamily:"monospace",color:status }}>${fmtInt(spent)} / ${fmtInt(a.budgeted)}</span>
                            </div>
                            <div style={{ height:3,borderRadius:2,background:"rgba(255,255,255,0.06)" }}>
                              <div style={{ height:"100%",borderRadius:2,width:`${Math.min(100,pct)}%`,background:status,transition:"width 0.6s ease" }}/>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </HudCard>
            </div>

            {/* Bills */}
            <HudCard style={{ padding:"22px 24px" }} delay={0.12}>
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16 }}>
                <div>
                  <h2 style={{ fontSize:14,fontWeight:700,color:"var(--t1)" }}>Monthly Bills</h2>
                  <span style={{ fontSize:12,color:"var(--t3)" }}>${fmt(billsTotal)}/mo · ${fmtInt(billsTotal*12)}/yr</span>
                </div>
                <SmallEditBtn onClick={()=>setModal("bills")}/>
              </div>
              <div style={{ display:"grid",gridTemplateColumns:`repeat(${Math.min(bills.length,6)},1fr)`,gap:10 }}>
                {sortedBills.map(b=>{
                  const daysUntil=b.due>=dayOfMonth?b.due-dayOfMonth:b.due+31-dayOfMonth;
                  const urgent=daysUntil<=3;
                  return (
                    <div key={b.name} style={{ padding:"16px 12px",borderRadius:8,textAlign:"center",background:urgent?"rgba(239,68,68,0.06)":"var(--surface2)",border:`1px solid ${urgent?"rgba(239,68,68,0.2)":"var(--border)"}`}}>
                      <div style={{ fontSize:12,fontWeight:600,color:"var(--t2)",marginBottom:6 }}>{b.name}</div>
                      <div style={{ fontSize:18,fontWeight:800,fontFamily:"monospace",color:urgent?"var(--red)":"var(--t1)",marginBottom:4 }}>${b.amt%1===0?b.amt:b.amt.toFixed(2)}</div>
                      <div style={{ fontSize:10,fontWeight:600,color:urgent?"var(--red)":"var(--t4)" }}>
                        {daysUntil===0?"⚠ Today":urgent?`⚠ ${daysUntil}d`:`Day ${b.due}`}
                      </div>
                    </div>
                  );
                })}
              </div>
            </HudCard>
          </div>
        )}

        {/* ════════════════════════════════════════
             TAB: BUDGET
            ════════════════════════════════════════ */}
        {tab==="budget"&&(
          <div style={{ display:"flex",flexDirection:"column",gap:16 }}>

            {/* Ready to Assign */}
            <HudCard style={{ padding:"24px 28px" }} delay={0.05}>
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:20 }}>
                <div style={{ display:"flex",gap:40,alignItems:"flex-start",flexWrap:"wrap" }}>
                  <div>
                    <div style={{ fontSize:10,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:"var(--t4)",marginBottom:8 }}>Ready to Assign</div>
                    <div style={{ fontSize:44,fontWeight:800,fontFamily:"monospace",color:readyToAssign>=0?"var(--green)":"var(--red)" }}>
                      {readyToAssign<0?"-":""}${fmtInt(Math.abs(readyToAssign))}
                    </div>
                    {readyToAssign<0&&<div style={{ fontSize:11,color:"var(--red)",marginTop:4 }}>Over-budgeted</div>}
                  </div>
                  <div style={{ display:"flex",gap:28,paddingTop:4,flexWrap:"wrap" }}>
                    <div onClick={()=>setModal("income")} style={{ cursor:"pointer" }}>
                      <StatPill label="Income" value={`$${fmtInt(income)}`} color="var(--green)"/>
                      <div style={{ fontSize:10,color:"rgba(69,137,255,0.4)",marginTop:4 }}>click to edit</div>
                    </div>
                    <StatPill label="Budgeted" value={`$${fmtInt(totalBudgeted)}`} color="var(--blue)"/>
                    <StatPill label="Spent" value={`$${fmtInt(totalSpent)}`} color="var(--amber)"/>
                  </div>
                </div>
                <div style={{ display:"flex",gap:10,flexWrap:"wrap" }}>
                  <button onClick={runAICategorize} disabled={aiRunning} style={{ padding:"10px 16px",borderRadius:8,fontSize:12,fontWeight:700,cursor:aiRunning?"not-allowed":"pointer",background:"rgba(139,92,246,0.12)",border:"1px solid rgba(139,92,246,0.3)",color:"#8b5cf6",display:"flex",alignItems:"center",gap:7,transition:"all 0.15s" }}
                    onMouseEnter={e=>{if(!aiRunning)(e.currentTarget as HTMLElement).style.background="rgba(139,92,246,0.22)";}}
                    onMouseLeave={e=>{if(!aiRunning)(e.currentTarget as HTMLElement).style.background="rgba(139,92,246,0.12)";}}
                  >
                    <span>✦</span>{aiRunning?"Categorizing…":"Auto-Categorize with M.A.X."}
                  </button>
                  <button onClick={()=>setModal("addAlloc")} style={{ padding:"10px 16px",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",background:"rgba(69,137,255,0.12)",border:"1px solid rgba(69,137,255,0.3)",color:"var(--blue)",display:"flex",alignItems:"center",gap:6,transition:"all 0.15s" }}
                    onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background="rgba(69,137,255,0.22)"}
                    onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background="rgba(69,137,255,0.12)"}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                    Add Category
                  </button>
                </div>
              </div>
            </HudCard>

            {/* Tinder review */}
            {reviewing&&reviewQueue.length>0&&(
              <HudCard style={{ padding:"28px" }} delay={0.06}>
                <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:24 }}>
                  <div style={{ width:7,height:7,borderRadius:"50%",background:"#8b5cf6",boxShadow:"0 0 8px #8b5cf6" }}/>
                  <div style={{ fontSize:14,fontWeight:700,color:"var(--t1)" }}>Review M.A.X. Categorizations</div>
                  <div style={{ fontSize:11,color:"rgba(139,92,246,0.7)",background:"rgba(139,92,246,0.1)",padding:"2px 9px",borderRadius:20,border:"1px solid rgba(139,92,246,0.2)" }}>
                    {reviewQueue.length} to review
                  </div>
                </div>
                <TransactionReview
                  transactions={reviewQueue}
                  categories={ALL_CATEGORIES}
                  categoryColors={CAT_COLORS}
                  onConfirm={confirmCategory}
                  onDone={()=>{ setReviewing(false); setReviewQueue([]); }}
                />
              </HudCard>
            )}

            {/* Categories */}
            {allocations.length===0?(
              <HudCard style={{ padding:"52px 40px",textAlign:"center" }} delay={0.08}>
                <div style={{ fontSize:36,marginBottom:16,color:"rgba(69,137,255,0.4)" }}>◈</div>
                <div style={{ fontSize:18,fontWeight:700,color:"var(--t1)",marginBottom:8 }}>No budget set up yet</div>
                <div style={{ fontSize:14,color:"var(--t3)",marginBottom:28,maxWidth:360,margin:"0 auto 28px" }}>
                  Zero-based budgeting means every dollar has a job. Quick Setup loads sensible defaults instantly.
                </div>
                <div style={{ display:"flex",gap:12,justifyContent:"center" }}>
                  <button onClick={quickBudgetSetup} style={{ padding:"12px 28px",borderRadius:8,fontSize:14,fontWeight:700,background:"rgba(69,137,255,0.15)",border:"1px solid rgba(69,137,255,0.35)",color:"var(--blue)",cursor:"pointer",transition:"all 0.15s" }}
                    onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background="rgba(69,137,255,0.25)"}
                    onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background="rgba(69,137,255,0.15)"}
                  >Quick Setup — Load Defaults</button>
                  <button onClick={()=>setModal("addAlloc")} style={{ padding:"12px 24px",borderRadius:8,fontSize:14,fontWeight:600,background:"transparent",border:"1px solid rgba(255,255,255,0.1)",color:"var(--t3)",cursor:"pointer" }}>Build Manually</button>
                </div>
              </HudCard>
            ):(
              <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10 }}>
                {allocations.map(alloc=>{
                  const spent=spendByCategory[alloc.category]??0;
                  const pct=alloc.budgeted>0?(spent/alloc.budgeted)*100:0;
                  const remaining=alloc.budgeted-spent;
                  const color=CAT_COLORS[alloc.category]??"#4589ff";
                  const status=pct>=100?"var(--red)":pct>=80?"var(--amber)":"var(--green)";
                  return (
                    <div key={alloc.id} onClick={()=>setModal({type:"edit",alloc})} style={{ padding:"18px 18px",borderRadius:10,cursor:"pointer",background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",transition:"all 0.15s" }}
                      onMouseEnter={e=>{ (e.currentTarget as HTMLElement).style.background="rgba(255,255,255,0.045)"; (e.currentTarget as HTMLElement).style.borderColor=`${color}35`; }}
                      onMouseLeave={e=>{ (e.currentTarget as HTMLElement).style.background="rgba(255,255,255,0.025)"; (e.currentTarget as HTMLElement).style.borderColor="rgba(255,255,255,0.06)"; }}
                    >
                      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10 }}>
                        <div style={{ display:"flex",alignItems:"center",gap:7 }}>
                          <div style={{ width:7,height:7,borderRadius:2,background:color }}/>
                          <div style={{ fontSize:13,fontWeight:600,color:"var(--t1)" }}>{alloc.category}</div>
                        </div>
                        <div style={{ fontSize:11,fontWeight:700,color:status }}>{pct.toFixed(0)}%</div>
                      </div>
                      <div style={{ height:3,borderRadius:2,background:"rgba(255,255,255,0.06)",overflow:"hidden",marginBottom:12 }}>
                        <div style={{ height:"100%",borderRadius:2,width:`${Math.min(100,pct)}%`,background:status,transition:"width 0.8s ease" }}/>
                      </div>
                      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-end" }}>
                        <div>
                          <div style={{ fontSize:18,fontWeight:800,fontFamily:"monospace",color:"var(--t1)" }}>${fmtInt(spent)}</div>
                          <div style={{ fontSize:11,color:"var(--t4)",marginTop:2 }}>of ${alloc.budgeted.toLocaleString()}</div>
                        </div>
                        <div style={{ textAlign:"right" }}>
                          <div style={{ fontSize:12,fontWeight:700,fontFamily:"monospace",color:remaining>=0?"var(--t2)":"var(--red)" }}>
                            {remaining>=0?`$${fmtInt(remaining)}`:`-$${fmtInt(Math.abs(remaining))}`}
                          </div>
                          <div style={{ fontSize:11,color:"var(--t4)",marginTop:1 }}>{remaining>=0?"left":"over"}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Transactions */}
            {transactions.filter(tx=>tx.amount>0&&!tx.pending).length>0&&(
              <HudCard style={{ padding:"24px 24px" }} delay={0.15}>
                <h2 style={{ fontSize:14,fontWeight:700,color:"var(--t1)",marginBottom:16 }}>Transactions This Month</h2>
                <div style={{ display:"flex",flexDirection:"column" }}>
                  {transactions.filter(tx=>tx.amount>0&&!tx.pending).slice(0,25).map((tx,i,arr)=>{
                    const cat=tx.budget_category??tx.category??"Misc";
                    const color=CAT_COLORS[cat]??"#6b7280";
                    return (
                      <div key={tx.id} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderBottom:i<arr.length-1?"1px solid rgba(255,255,255,0.04)":"none" }}>
                        <div style={{ display:"flex",alignItems:"center",gap:10,flex:1,minWidth:0 }}>
                          <div style={{ width:28,height:28,borderRadius:6,background:`${color}14`,border:`1px solid ${color}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color,flexShrink:0 }}>
                            {(tx.merchant??"?").slice(0,2).toUpperCase()}
                          </div>
                          <div style={{ minWidth:0 }}>
                            <div style={{ fontSize:13,fontWeight:500,color:"var(--t1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{tx.merchant}</div>
                            <div style={{ fontSize:10,color:"var(--t4)" }}>{new Date(tx.date+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})}</div>
                          </div>
                        </div>
                        <div style={{ display:"flex",alignItems:"center",gap:12,flexShrink:0 }}>
                          <div style={{ fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:20,background:`${color}14`,color,border:`1px solid ${color}22`,whiteSpace:"nowrap" }}>{cat}</div>
                          <div style={{ fontSize:13,fontWeight:700,fontFamily:"monospace",color:"var(--red)",minWidth:60,textAlign:"right" }}>-${fmt(tx.amount)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </HudCard>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════
             TAB: INVESTMENTS
            ════════════════════════════════════════ */}
        {tab==="investments"&&(
          <div style={{ display:"flex",flexDirection:"column",gap:16 }}>

            {/* Crypto */}
            <HudCard style={{ padding:"24px 28px" }} delay={0.05}>
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20 }}>
                <div>
                  <h2 style={{ fontSize:14,fontWeight:700,color:"var(--t1)" }}>Crypto Holdings</h2>
                  <div style={{ display:"flex",alignItems:"center",gap:6,marginTop:3 }}>
                    <span style={{ width:6,height:6,borderRadius:"50%",background:live.length?"var(--green)":"var(--amber)",animation:"pulse-dot 2s ease-in-out infinite",display:"inline-block" }}/>
                    <span style={{ fontSize:11,color:"var(--t3)" }}>{live.length?"Live":"Cached"}</span>
                  </div>
                </div>
                <div style={{ fontSize:20,fontWeight:800,fontFamily:"monospace",color:"var(--amber)" }}>${fmt(cryptoTotal)}</div>
              </div>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:16 }}>
                {(live.length?live:[
                  {symbol:"BTC",name:"Bitcoin",price:btcPrice,c24:0,c7:0,data:[]},
                  {symbol:"XRP",name:"Ripple",price:xrpPrice,c24:0,c7:0,data:[]},
                ]).map(a=>{
                  const held=a.symbol==="BTC"?wealth.btc_amount:wealth.xrp_amount;
                  const val=a.price*held;
                  return (
                    <div key={a.symbol} style={{ padding:"20px",borderRadius:10,background:"var(--surface2)",border:"1px solid var(--border)" }}>
                      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14 }}>
                        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                          <div style={{ width:36,height:36,borderRadius:8,background:"var(--surface3)",border:"1px solid var(--border2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:"var(--t1)" }}>{a.symbol[0]}</div>
                          <div>
                            <div style={{ fontSize:14,fontWeight:700,color:"var(--t1)" }}>{a.symbol}</div>
                            <div style={{ fontSize:11,color:"var(--t4)" }}>{held.toFixed(a.symbol==="BTC"?8:0)} held</div>
                          </div>
                        </div>
                        <div style={{ textAlign:"right" }}>
                          <div style={{ fontSize:16,fontWeight:700,fontFamily:"monospace",color:"var(--t1)" }}>
                            ${a.symbol==="BTC"?fmtInt(a.price):a.price.toFixed(4)}
                          </div>
                          <div style={{ fontSize:12,fontWeight:700,color:a.c24>=0?"var(--green)":"var(--red)" }}>
                            {a.c24>=0?"+":""}{Number(a.c24).toFixed(2)}%
                          </div>
                        </div>
                      </div>
                      {a.data.length>0&&<Sparkline data={a.data} color={a.c24>=0?"var(--green)":"var(--red)"} height={44} id={`inv-${a.symbol}`}/>}
                      <div style={{ display:"flex",justifyContent:"space-between",marginTop:10 }}>
                        <span style={{ fontSize:11,color:"var(--t3)" }}>7d: <span style={{ color:a.c7>=0?"var(--green)":"var(--red)",fontWeight:600 }}>{a.c7>=0?"+":""}{Number(a.c7).toFixed(2)}%</span></span>
                        <span style={{ fontSize:13,fontWeight:700,fontFamily:"monospace",color:"var(--amber)" }}>${fmt(val)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </HudCard>

            {/* IRA */}
            <HudCard style={{ padding:"24px 28px" }} delay={0.08}>
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16 }}>
                <div>
                  <h2 style={{ fontSize:14,fontWeight:700,color:"var(--t1)" }}>Roth IRA — Schwab</h2>
                  <div style={{ fontSize:11,color:"var(--t3)" }}>MDDVX · RPEAX · PTTRX</div>
                </div>
                <div style={{ fontSize:20,fontWeight:800,fontFamily:"monospace",color:"var(--blue)" }}>${fmt(iraTotal)}</div>
              </div>
              <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                {ira.map(f=>(
                  <div key={f.symbol} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",borderRadius:8,background:"var(--surface2)",border:"1px solid var(--border)" }}>
                    <div>
                      <div style={{ fontSize:14,fontWeight:700,color:"var(--t1)" }}>{f.symbol}</div>
                      <div style={{ fontSize:11,color:"var(--t3)",marginTop:2 }}>{f.name} · {f.shares} shares</div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:14,fontWeight:700,fontFamily:"monospace",color:"var(--t1)" }}>${fmt(f.value)}</div>
                      <div style={{ fontSize:11,color:f.chg>=0?"var(--green)":"var(--red)",marginTop:2 }}>NAV ${f.nav} ({f.chg>=0?"+":""}{f.chg}%)</div>
                    </div>
                  </div>
                ))}
              </div>
            </HudCard>

            {/* Emergency Fund */}
            <HudCard style={{ padding:"24px 28px" }} delay={0.1}>
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16 }}>
                <h2 style={{ fontSize:14,fontWeight:700,color:"var(--t1)" }}>Emergency Fund</h2>
                <SmallEditBtn onClick={()=>setModal({type:"edit",alloc:{id:"savings-modal",category:"Savings",budgeted:0,period_start:period}})}/>
              </div>
              <div style={{ display:"flex",alignItems:"center",gap:24 }}>
                <svg width="80" height="80" viewBox="0 0 80 80" style={{ flexShrink:0 }}>
                  <circle cx="40" cy="40" r="32" fill="none" stroke="var(--border2)" strokeWidth="5"/>
                  <circle cx="40" cy="40" r="32" fill="none" stroke="var(--blue)" strokeWidth="5"
                    strokeDasharray={2*Math.PI*32} strokeDashoffset={2*Math.PI*32*(1-Math.min(1,wealth.savings/10000))}
                    strokeLinecap="round" transform="rotate(-90 40 40)" style={{ transition:"stroke-dashoffset 1s ease" }}/>
                  <text x="40" y="36" textAnchor="middle" fontSize="13" fontWeight="800" fill="var(--t1)">{Math.round((wealth.savings/10000)*100)}%</text>
                  <text x="40" y="50" textAnchor="middle" fontSize="9" fill="var(--t3)">funded</text>
                </svg>
                <div>
                  <div style={{ fontSize:28,fontWeight:800,fontFamily:"monospace",color:"var(--t1)" }}>${wealth.savings.toLocaleString()}</div>
                  <div style={{ fontSize:13,color:"var(--blue)",marginTop:4 }}>of $10,000 goal</div>
                  <div style={{ fontSize:12,color:"var(--t3)",marginTop:2 }}>${(10000-wealth.savings).toLocaleString()} remaining</div>
                </div>
              </div>
            </HudCard>

            {/* Net worth history */}
            {history.length>=2&&(
              <HudCard style={{ padding:"24px 28px" }} delay={0.12}>
                <h2 style={{ fontSize:14,fontWeight:700,color:"var(--t1)",marginBottom:16 }}>Net Worth History</h2>
                <Sparkline data={history.map(h=>h.net_worth)} color="var(--blue)" height={64} id="nw-invest"/>
                <div style={{ display:"flex",justifyContent:"space-between",marginTop:8 }}>
                  <span style={{ fontSize:10,color:"var(--t4)" }}>{new Date(history[0].recorded_at).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span>
                  <span style={{ fontSize:11,fontWeight:600,color:history[history.length-1].net_worth>=history[0].net_worth?"var(--green)":"var(--red)" }}>
                    {history[history.length-1].net_worth>=history[0].net_worth?"+":""}{fmtInt(history[history.length-1].net_worth-history[0].net_worth)} · 30d
                  </span>
                  <span style={{ fontSize:10,color:"var(--t4)" }}>{new Date(history[history.length-1].recorded_at).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span>
                </div>
              </HudCard>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════
             TAB: TRANSACTIONS
            ════════════════════════════════════════ */}
        {tab==="transactions"&&(
          <HudCard style={{ padding:"24px 28px" }} delay={0.05}>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,gap:12,flexWrap:"wrap" }}>
              <h2 style={{ fontSize:14,fontWeight:700,color:"var(--t1)" }}>All Transactions — {new Date(period+"T12:00:00").toLocaleDateString("en-US",{month:"long",year:"numeric"})}</h2>
              <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
                {/* Search */}
                <div style={{ position:"relative" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"var(--t4)" }}>
                    <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                  </svg>
                  <input value={txSearch} onChange={e=>setTxSearch(e.target.value)} placeholder="Search…"
                    style={{ paddingLeft:30,paddingRight:12,paddingTop:8,paddingBottom:8,borderRadius:7,background:"var(--surface2)",border:"1px solid var(--border2)",color:"var(--t1)",fontSize:13,outline:"none",width:160 }}
                    onFocus={e=>e.target.style.borderColor="var(--blue)"} onBlur={e=>e.target.style.borderColor="var(--border2)"}
                  />
                </div>
                {/* Category filter */}
                <select value={txCatFilter??""} onChange={e=>setTxCatFilter(e.target.value||null)}
                  style={{ padding:"8px 12px",borderRadius:7,background:"var(--surface2)",border:"1px solid var(--border2)",color:"var(--t1)",fontSize:12,outline:"none",cursor:"pointer" }}>
                  <option value="">All Categories</option>
                  {ALL_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div style={{ fontSize:11,color:"var(--t4)",marginBottom:12 }}>{filteredTx.length} transactions · ${fmt(filteredTx.reduce((a,tx)=>a+tx.amount,0))} total</div>

            {filteredTx.length===0?(
              <div style={{ textAlign:"center",padding:"40px 0",color:"var(--t4)",fontSize:14 }}>
                No transactions found
              </div>
            ):(
              <div style={{ display:"flex",flexDirection:"column" }}>
                {filteredTx.map((tx,i)=>{
                  const cat=tx.budget_category??tx.category??"Misc";
                  const color=CAT_COLORS[cat]??"#6b7280";
                  return (
                    <div key={tx.id} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"11px 0",borderBottom:i<filteredTx.length-1?"1px solid rgba(255,255,255,0.04)":"none" }}>
                      <div style={{ display:"flex",alignItems:"center",gap:12,flex:1,minWidth:0 }}>
                        <div style={{ width:32,height:32,borderRadius:7,background:`${color}14`,border:`1px solid ${color}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color,flexShrink:0 }}>
                          {(tx.merchant??"?").slice(0,2).toUpperCase()}
                        </div>
                        <div style={{ minWidth:0,flex:1 }}>
                          <div style={{ fontSize:13,fontWeight:500,color:"var(--t1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{tx.merchant}</div>
                          <div style={{ fontSize:11,color:"var(--t4)" }}>{new Date(tx.date+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</div>
                        </div>
                      </div>
                      <div style={{ display:"flex",alignItems:"center",gap:14,flexShrink:0 }}>
                        <div style={{ fontSize:11,fontWeight:600,padding:"2px 9px",borderRadius:20,background:`${color}14`,color,border:`1px solid ${color}22`,whiteSpace:"nowrap" }}>{cat}</div>
                        <div style={{ fontSize:13,fontWeight:700,fontFamily:"monospace",color:"var(--red)",minWidth:72,textAlign:"right" }}>-${fmt(tx.amount)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </HudCard>
        )}
      </div>

      {/* Bills edit modal */}
      {modal==="bills"&&(
        <BillsModal bills={bills} onSave={saveBills} onClose={()=>setModal(null)}/>
      )}
    </div>
  );
}

/* ─────────────── Bills modal (same as before) ─────────────── */
function BillsModal({ bills, onSave, onClose }: { bills:Bill[]; onSave:(b:Bill[])=>void; onClose:()=>void }) {
  const [draft, setDraft] = useState<Bill[]>(bills.map(b=>({...b})));
  function update(i:number, key:keyof Bill, val:string) {
    setDraft(p=>p.map((b,j)=>j===i?{...b,[key]:key==="name"?val:parseFloat(val)||0}:b));
  }
  return (
    <div style={{ position:"fixed",inset:0,zIndex:100,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center" }} onClick={onClose}>
      <div style={{ background:"var(--surface)",border:"1px solid var(--border2)",borderRadius:12,padding:"28px 32px",width:480,maxWidth:"92vw",maxHeight:"85vh",overflowY:"auto" }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20 }}>
          <h3 style={{ fontSize:16,fontWeight:700,color:"var(--t1)" }}>Edit Monthly Bills</h3>
          <button onClick={onClose} style={{ background:"none",border:"none",cursor:"pointer",color:"var(--t3)" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
        </div>
        <div style={{ display:"flex",flexDirection:"column",gap:8,marginBottom:16 }}>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 100px 70px 32px",gap:8,paddingBottom:8,borderBottom:"1px solid var(--border)" }}>
            {["Name","Amount","Due Day",""].map(h=><span key={h} style={{ fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"var(--t3)" }}>{h}</span>)}
          </div>
          {draft.map((b,i)=>(
            <div key={i} style={{ display:"grid",gridTemplateColumns:"1fr 100px 70px 32px",gap:8,alignItems:"center" }}>
              <input value={b.name} onChange={e=>update(i,"name",e.target.value)} style={{ background:"var(--surface2)",border:"1px solid var(--border2)",borderRadius:5,padding:"8px 10px",color:"var(--t1)",fontSize:13,fontWeight:600,outline:"none" }} onFocus={e=>e.target.style.borderColor="var(--blue)"} onBlur={e=>e.target.style.borderColor="var(--border2)"}/>
              <div style={{ position:"relative" }}>
                <span style={{ position:"absolute",left:8,top:"50%",transform:"translateY(-50%)",fontSize:13,color:"var(--t3)",fontFamily:"monospace" }}>$</span>
                <input type="number" step="0.01" value={b.amt} onChange={e=>update(i,"amt",e.target.value)} style={{ width:"100%",background:"var(--surface2)",border:"1px solid var(--border2)",borderRadius:5,padding:"8px 8px 8px 20px",color:"var(--t1)",fontFamily:"monospace",fontSize:13,fontWeight:600,outline:"none" }} onFocus={e=>e.target.style.borderColor="var(--blue)"} onBlur={e=>e.target.style.borderColor="var(--border2)"}/>
              </div>
              <input type="number" min="1" max="31" value={b.due} onChange={e=>update(i,"due",e.target.value)} style={{ background:"var(--surface2)",border:"1px solid var(--border2)",borderRadius:5,padding:"8px",color:"var(--t1)",fontFamily:"monospace",fontSize:13,fontWeight:600,outline:"none",textAlign:"center" }} onFocus={e=>e.target.style.borderColor="var(--blue)"} onBlur={e=>e.target.style.borderColor="var(--border2)"}/>
              <button onClick={()=>setDraft(p=>p.filter((_,j)=>j!==i))} style={{ background:"none",border:"1px solid var(--border)",borderRadius:4,padding:"7px",cursor:"pointer",color:"var(--t3)",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s" }}
                onMouseEnter={e=>{ (e.currentTarget as HTMLElement).style.borderColor="var(--red)"; (e.currentTarget as HTMLElement).style.color="var(--red)"; }}
                onMouseLeave={e=>{ (e.currentTarget as HTMLElement).style.borderColor="var(--border)"; (e.currentTarget as HTMLElement).style.color="var(--t3)"; }}
              ><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg></button>
            </div>
          ))}
        </div>
        <button onClick={()=>setDraft(p=>[...p,{name:"New Bill",amt:0,due:1}])} style={{ width:"100%",padding:"9px",borderRadius:6,fontSize:12,fontWeight:600,cursor:"pointer",background:"transparent",border:"1px dashed var(--border2)",color:"var(--t3)",marginBottom:16,transition:"all .15s" }}
          onMouseEnter={e=>{ (e.currentTarget as HTMLElement).style.borderColor="var(--blue)"; (e.currentTarget as HTMLElement).style.color="var(--blue)"; }}
          onMouseLeave={e=>{ (e.currentTarget as HTMLElement).style.borderColor="var(--border2)"; (e.currentTarget as HTMLElement).style.color="var(--t3)"; }}
        >+ Add Bill</button>
        <div style={{ display:"flex",gap:10 }}>
          <button onClick={onClose} style={{ flex:1,padding:"11px 0",borderRadius:6,fontSize:13,fontWeight:600,cursor:"pointer",background:"transparent",border:"1px solid var(--border2)",color:"var(--t3)" }}>Cancel</button>
          <button onClick={()=>{onSave(draft);onClose();}} style={{ flex:2,padding:"11px 0",borderRadius:6,fontSize:13,fontWeight:700,cursor:"pointer",background:"rgba(69,137,255,0.15)",border:"1px solid rgba(69,137,255,0.4)",color:"var(--blue)" }}>Save</button>
        </div>
      </div>
    </div>
  );
}
