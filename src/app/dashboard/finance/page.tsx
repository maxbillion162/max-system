"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { HudCard } from "@/components/ui/HudCard";
import { Sparkline } from "@/components/ui/Sparkline";
import { supabase } from "@/lib/supabase";
import PlaidLinkButton from "@/components/ui/PlaidLinkButton";
import TransactionReview, { ReviewTransaction } from "@/components/ui/TransactionReview";
import { LiveStatusBar } from "@/components/finance/LiveStatusBar";
import { FinanceQueryBar } from "@/components/finance/FinanceQueryBar";
import { NetWorthChart } from "@/components/finance/NetWorthChart";
import { AccountHub } from "@/components/finance/AccountHub";
import { DiscretionaryTracker } from "@/components/finance/DiscretionaryTracker";
import { LivingTargetsModal } from "@/components/finance/LivingTargetsModal";
import { GoalAllocatorModal } from "@/components/finance/GoalAllocatorModal";
import { PaycheckPlannerModal } from "@/components/finance/PaycheckPlannerModal";
import { PlaidDiagnostics } from "@/components/finance/PlaidDiagnostics";
import { BudgetTable } from "@/components/finance/BudgetTable";
import { CategoryDetailPanel } from "@/components/finance/CategoryDetailPanel";
import { BudgetReallocateModal } from "@/components/finance/BudgetReallocateModal";
import { SpendingIntel } from "@/components/finance/SpendingIntel";
import { CashFlowForecast } from "@/components/finance/CashFlowForecast";
import { NetWorthSimulator } from "@/components/finance/NetWorthSimulator";
import { WhatIfEngine } from "@/components/finance/WhatIfEngine";
import { SubscriptionAudit } from "@/components/finance/SubscriptionAudit";
import { MoneyDNA } from "@/components/finance/MoneyDNA";
import { MerchantDrilldown } from "@/components/finance/MerchantDrilldown";
import { InvestmentThesisCard } from "@/components/finance/InvestmentThesisCard";
import { BillsCalendar } from "@/components/finance/BillsCalendar";
import { ManualTxnModal } from "@/components/finance/ManualTxnModal";
import { QuarterlyReport } from "@/components/finance/QuarterlyReport";
import { ScenarioTracker } from "@/components/finance/ScenarioTracker";
import { cashFlowRunway, netWorthBreakdown, delta24h } from "@/lib/finance-math";
import { normalizeAccountType } from "@/lib/plaid";
import type { Account as FinAccount, AccountType, WealthSnapshot } from "@/types/finance";

/* ─────────────── Types ─────────────── */
interface PlaidAccount   { id: string; plaid_account_id: string; plaid_item_id: string; name: string; official_name?: string|null; type: string; subtype: string; institution: string; mask: string | null; current_balance: number | null; available_balance: number | null; last_synced: string | null; account_type?: string | null; archived?: boolean | null; active?: boolean }
interface WealthData     { ira: number; savings: number; btc_amount: number; xrp_amount: number }
interface IRAFund        { symbol: string; name: string; nav: number; chg: number; value: number; shares: number }
interface Bill           { name: string; amt: number; due: number }
interface LiveCrypto     { symbol: string; name: string; price: number; c24: number; c7: number; data: number[] }
interface WealthHistory  { recorded_at: string; net_worth: number; crypto_total?: number; ira_total?: number; savings?: number }
interface MarketIndex   { symbol: string; name: string; price: number; change: number; changePct: number }
interface MarketSnapshot{ SPY: MarketIndex|null; QQQ: MarketIndex|null; DIA: MarketIndex|null; updated: string }
interface NewsArticle   { title: string; url: string; snippet: string; published: string|null }
interface BudgetAlloc    { id: string; category: string; budgeted: number; period_start: string; rollover?: boolean }
interface Transaction    { id: string; date: string; amount: number; merchant: string; merchant_normalized: string; category: string; budget_category: string | null; pending: boolean }

/* ─────────────── Constants ─────────────── */
const CAT_COLORS: Record<string, string> = {
  Housing:"#7DB8E8", Food:"#5FB07D", Transport:"#C85A5A", Entertainment:"#9B8AFB",
  Subscriptions:"#7DB8E8", Savings:"#5FB07D", Health:"#C85A5A", Shopping:"#C85A5A",
  Personal:"#9B8AFB", Investing:"#6366f1", Misc:"#6b7280",
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

/* No more hardcoded fallbacks — show empty / loading states instead. */
const EMPTY_WEALTH: WealthData = { ira: 0, savings: 0, btc_amount: 0, xrp_amount: 0 };

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
      background: active ? "rgba(125,184,232,0.12)" : "transparent",
      border: `1px solid ${active ? "rgba(125,184,232,0.35)" : "transparent"}`,
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
          <button onClick={()=>{onSave(parseFloat(val)||0);onClose();}} style={{ flex:2,padding:"11px 0",borderRadius:6,fontSize:13,fontWeight:700,cursor:"pointer",background:"rgba(125,184,232,0.15)",border:"1px solid rgba(125,184,232,0.4)",color:"var(--blue)" }}>Save</button>
        </div>
      </div>
    </div>
  );
}

function AllocModal({ alloc, existingCats, onSave, onDelete, onClose }: { alloc?:BudgetAlloc; existingCats:string[]; onSave:(cat:string,budgeted:number,id?:string)=>void; onDelete?:()=>Promise<boolean>; onClose:()=>void }) {
  const available = ALL_CATEGORIES.filter(c=>!existingCats.includes(c)||c===alloc?.category);
  const [cat, setCat] = useState(alloc?.category??available[0]??"");
  const [amt, setAmt] = useState(String(alloc?.budgeted??""));
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
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
        {confirming && onDelete && (
          <div style={{ padding:"12px 14px",borderRadius:6,background:"rgba(200,90,90,0.08)",border:"1px solid rgba(200,90,90,0.3)",marginBottom:12 }}>
            <p style={{ fontSize:12,color:"var(--t1)",lineHeight:1.5,marginBottom:10 }}>Remove <strong>{alloc?.category}</strong> from this period&apos;s budget? Transactions are not affected.</p>
            <div style={{ display:"flex",gap:8 }}>
              <button onClick={()=>setConfirming(false)} disabled={deleting} style={{ flex:1,padding:"8px 0",borderRadius:4,fontSize:11,fontWeight:600,cursor:"pointer",background:"transparent",border:"1px solid var(--border2)",color:"var(--t3)" }}>Keep</button>
              <button onClick={async()=>{
                setDeleting(true);
                const ok = await onDelete();
                setDeleting(false);
                if (!ok) setConfirming(false);
              }} disabled={deleting} style={{ flex:1,padding:"8px 0",borderRadius:4,fontSize:11,fontWeight:700,cursor:deleting?"default":"pointer",background:"rgba(200,90,90,0.15)",border:"1px solid rgba(200,90,90,0.5)",color:"var(--red)",opacity:deleting?0.6:1 }}>
                {deleting ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        )}
        <div style={{ display:"flex",gap:10 }}>
          {onDelete&&!confirming&&<button onClick={()=>setConfirming(true)} style={{ padding:"11px 14px",borderRadius:6,fontSize:13,fontWeight:600,cursor:"pointer",background:"rgba(200,90,90,0.08)",border:"1px solid rgba(200,90,90,0.2)",color:"var(--red)" }}>Delete</button>}
          <button onClick={onClose} style={{ flex:1,padding:"11px 0",borderRadius:6,fontSize:13,fontWeight:600,cursor:"pointer",background:"transparent",border:"1px solid var(--border2)",color:"var(--t3)" }}>Cancel</button>
          <button onClick={()=>onSave(cat,parseFloat(amt)||0,alloc?.id)} style={{ flex:2,padding:"11px 0",borderRadius:6,fontSize:13,fontWeight:700,cursor:"pointer",background:"rgba(125,184,232,0.15)",border:"1px solid rgba(125,184,232,0.4)",color:"var(--blue)" }}>Save</button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Main page ─────────────── */
type Tab = "overview" | "budget" | "investments";

export default function FinancePage() {
  const [tab,          setTab]          = useState<Tab>("overview");
  const [drilldownMerchant, setDrilldownMerchant] = useState<string | null>(null);
  const [manualTxnOpen, setManualTxnOpen] = useState(false);
  const [accounts,     setAccounts]     = useState<PlaidAccount[]>([]);
  const [wealth,       setWealth]       = useState<WealthData>(EMPTY_WEALTH);
  const [ira,          setIra]          = useState<IRAFund[]>([]);
  const [bills,        setBills]        = useState<Bill[]>([]);
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const [txHistory6mo, setTxHistory6mo] = useState<{ amount: number; date: string; budget_category: string | null; category: string }[]>([]);
  const [classifications, setClassifications] = useState<Record<string, "need"|"want"|"savings"|"investment">>({});
  const [livingTargetsOpen, setLivingTargetsOpen] = useState(false);
  const [goalAllocOpen, setGoalAllocOpen] = useState(false);
  const [paycheckPlannerOpen, setPaycheckPlannerOpen] = useState(false);
  const [pendingPaycheck, setPendingPaycheck] = useState<{ amount: number; source?: string|null; date?: string|null } | null>(null);
  const [goals, setGoals] = useState<{ id: string; label: string; current: number; target: number; deadline: string|null }[]>([]);
  const [selectedBudgetCategory, setSelectedBudgetCategory] = useState<string | null>(null);
  const [reallocateOpen, setReallocateOpen] = useState(false);
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
  const [market,       setMarket]       = useState<MarketSnapshot|null>(null);
  const [news,         setNews]         = useState<NewsArticle[]>([]);

  /* ── Load all data ── */
  useEffect(() => { loadAll(); }, [period]);

  /* Auto-cleanup is gone — too aggressive. The diagnostics panel surfaces
     the real state honestly so we can debug, and cleanup is now a manual
     button gated by the panel. */

  async function loadAll() {
    const sixMoAgo = new Date(Date.now() - 180*24*60*60*1000).toISOString().slice(0,10);
    const [accountsRes, wealthRes, iraRes, billsRes, histRes, cryptoRes, allocRes, txRes, incomeRes, marketRes, newsRes, tx6moRes, classRes, goalsRes] = await Promise.allSettled([
      supabase.from("accounts").select("id,plaid_account_id,plaid_item_id,name,official_name,type,subtype,institution,mask,current_balance,available_balance,last_synced,active,created_at").eq("active", true).order("institution"),
      supabase.from("wealth").select("*").eq("id","max").single(),
      supabase.from("ira_funds").select("*"),
      supabase.from("bills").select("*").order("due"),
      supabase.from("wealth_history").select("recorded_at,net_worth,crypto_total,ira_total,savings").order("recorded_at",{ascending:true}).limit(730),
      fetch("/api/crypto").then(r=>r.json()).catch(()=>null),
      supabase.from("budget_allocations").select("*").eq("period_start",period).order("category"),
      supabase.from("transactions").select("*").gte("date",period).lt("date",nextPeriod(period)).order("date",{ascending:false}).limit(500),
      supabase.from("settings").select("value").eq("key","monthly_income").single(),
      fetch("/api/market").then(r=>r.json()).catch(()=>null),
      fetch("/api/finance-news").then(r=>r.json()).catch(()=>null),
      supabase.from("transactions").select("amount,date,budget_category,category,pending").gte("date", sixMoAgo).order("date",{ascending:true}).limit(2500),
      supabase.from("category_classification").select("category,type"),
      supabase.from("goals").select("id,label,current,target,deadline").order("deadline",{ascending:true,nullsFirst:false}),
    ]);

    if (accountsRes.status==="fulfilled"&&accountsRes.value.data) {
      const accts = accountsRes.value.data as PlaidAccount[];
      setAccounts(accts);
      const synced = accts.map(a=>a.last_synced).filter(Boolean).sort().pop();
      if (synced) setLastSync(synced);
    }
    setAccountsLoaded(true);
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
    if (marketRes.status==="fulfilled"&&marketRes.value?.snapshot) setMarket(marketRes.value.snapshot as MarketSnapshot);
    if (iraRes.status==="fulfilled"&&iraRes.value.data?.length) setIra(iraRes.value.data as IRAFund[]);
    else if (marketRes.status==="fulfilled"&&marketRes.value?.ira?.length) setIra(marketRes.value.ira as IRAFund[]);
    if (newsRes.status==="fulfilled"&&newsRes.value?.articles?.length) setNews(newsRes.value.articles as NewsArticle[]);
    if (tx6moRes.status==="fulfilled"&&tx6moRes.value.data) {
      setTxHistory6mo((tx6moRes.value.data as { amount:number; date:string; budget_category:string|null; category:string; pending:boolean }[])
        .filter(t => !t.pending && t.amount > 0));
    }
    if (classRes.status==="fulfilled"&&classRes.value.data) {
      const m: Record<string, "need"|"want"|"savings"|"investment"> = {};
      for (const r of (classRes.value.data as { category:string; type:"need"|"want"|"savings"|"investment" }[])) m[r.category] = r.type;
      setClassifications(m);
    }
    if (goalsRes.status==="fulfilled"&&goalsRes.value.data) {
      setGoals(goalsRes.value.data as { id: string; label: string; current: number; target: number; deadline: string|null }[]);
    }
  }

  /* ── Real-time wealth updates ── */
  useEffect(() => {
    const ch = supabase.channel("finance-wealth").on("postgres_changes",{event:"*",schema:"public",table:"wealth"},p=>{ if(p.new) setWealth(w=>({...w,...(p.new as WealthData)})); }).subscribe();
    return ()=>{ supabase.removeChannel(ch); };
  }, []);

  /* ── Computed values ── */
  const btcPrice    = live.find(l=>l.symbol==="BTC")?.price ?? 0;
  const xrpPrice    = live.find(l=>l.symbol==="XRP")?.price ?? 0;
  const btcVal      = btcPrice * wealth.btc_amount;
  const xrpVal      = xrpPrice * wealth.xrp_amount;
  const cryptoTotal = btcVal + xrpVal;
  const iraTotal    = ira.reduce((a,f)=>a+f.value,0);
  const bankTotal   = accounts.filter(a=>a.type!=="credit"&&a.current_balance!=null).reduce((a,b)=>a+(b.current_balance??0),0);
  const billsTotal  = bills.reduce((a,b)=>a+b.amt,0);
  const dayOfMonth  = new Date().getDate();

  /* ── New foundation metrics (Zone A / B) ── */
  const finAccounts: FinAccount[] = useMemo(() => accounts
    .filter(a => !a.archived)
    .map(a => ({
      plaid_account_id:  a.plaid_account_id,
      plaid_item_id:     a.plaid_item_id,
      name:              a.name,
      official_name:     a.official_name ?? null,
      institution:       a.institution ?? null,
      mask:              a.mask,
      type:              a.type,
      subtype:           a.subtype,
      account_type:      (a.account_type as AccountType | null) ?? normalizeAccountType(a.type, a.subtype) as AccountType,
      current_balance:   a.current_balance,
      available_balance: a.available_balance,
      last_synced:       a.last_synced,
      active:            a.active ?? true,
      archived:          a.archived ?? false,
    })), [accounts]);

  const breakdown = useMemo(() => netWorthBreakdown(finAccounts, cryptoTotal, iraTotal), [finAccounts, cryptoTotal, iraTotal]);

  // Net worth — when bank accounts are connected, combine all assets minus debt;
  // otherwise fall back to manual savings + IRA + crypto so the page is still useful pre-Plaid.
  const netWorth = finAccounts.length > 0
    ? breakdown.net_worth
    : cryptoTotal + iraTotal + wealth.savings;

  const wealthSnapshots: WealthSnapshot[] = useMemo(() => history.map(h => ({
    recorded_at:  h.recorded_at,
    net_worth:    h.net_worth,
    crypto_total: h.crypto_total ?? 0,
    ira_total:    h.ira_total ?? 0,
    savings:      h.savings ?? 0,
  })), [history]);

  const { delta: nwDelta, pct: nwPct } = useMemo(
    () => delta24h(wealthSnapshots, netWorth),
    [wealthSnapshots, netWorth]
  );

  const last30 = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return wealthSnapshots.filter(s => new Date(s.recorded_at).getTime() >= cutoff);
  }, [wealthSnapshots]);

  const liquidCash = breakdown.cash + breakdown.savings;
  const txForRunway: { amount: number; date: string; pending?: boolean; merchant: string; merchant_normalized?: string; plaid_transaction_id: string; category: string; source: string }[] =
    transactions.map(t => ({
      amount: t.amount,
      date: t.date,
      pending: t.pending,
      merchant: t.merchant,
      merchant_normalized: t.merchant_normalized,
      plaid_transaction_id: t.id,
      category: t.category,
      source: "plaid",
    }));
  const runway = useMemo(
    () => cashFlowRunway(liquidCash, txForRunway),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [liquidCash, transactions]
  );

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

  /* ── Per-category 6-month monthly spend history (for sparklines) ── */
  const monthlyHistoryByCategory = useMemo(() => {
    const buckets: Record<string, Record<string, number>> = {}; // { category: { 'YYYY-MM': total } }
    for (const t of txHistory6mo) {
      const cat = t.budget_category ?? t.category ?? "Misc";
      const ym  = t.date.slice(0, 7);
      if (!buckets[cat]) buckets[cat] = {};
      buckets[cat][ym] = (buckets[cat][ym] ?? 0) + t.amount;
    }
    // Build a 6-slot ordered array per category, oldest → newest
    const months: string[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);
    }
    const out: Record<string, number[]> = {};
    for (const [cat, byMonth] of Object.entries(buckets)) {
      out[cat] = months.map(m => Math.round(byMonth[m] ?? 0));
    }
    return out;
  }, [txHistory6mo]);

  /* ── Needs/Wants/Savings/Investment splits from current allocations ── */
  const flowSplit = useMemo(() => {
    let needs = 0, wants = 0, savings = 0, investment = 0;
    for (const a of allocations) {
      const type = classifications[a.category] ?? "want";
      if (type === "need") needs += a.budgeted;
      else if (type === "savings") savings += a.budgeted;
      else if (type === "investment") investment += a.budgeted;
      else wants += a.budgeted;
    }
    return { needs, wants, savings, investment };
  }, [allocations, classifications]);

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

  async function deleteAlloc(id:string): Promise<boolean> {
    const prev = allocations;
    setAllocations(p => p.filter(a => a.id !== id));
    const { error } = await supabase.from("budget_allocations").delete().eq("id", id);
    if (error) {
      setAllocations(prev);
      alert(`Couldn't remove category: ${error.message}`);
      return false;
    }
    setModal(null);
    return true;
  }

  async function quickBudgetSetup() {
    const rows=QUICK_DEFAULTS.map(d=>({...d,period_start:period,rollover:false}));
    const {data}=await supabase.from("budget_allocations").upsert(rows,{onConflict:"category,period_start"}).select();
    if (data) setAllocations(data);
    await supabase.from("settings").upsert({key:"monthly_income",value:3000});
    setIncome(3000);
  }

  async function applyLivingTargets(rows: { category: string; budgeted: number }[]) {
    const insertRows = rows.map(r => ({ category: r.category, budgeted: r.budgeted, period_start: period, rollover: false }));
    const { data } = await supabase
      .from("budget_allocations")
      .upsert(insertRows, { onConflict: "category,period_start" })
      .select();
    if (data) {
      // Merge upserted rows back into state
      setAllocations(prev => {
        const updated = new Map(prev.map(a => [a.category, a] as const));
        for (const row of data as BudgetAlloc[]) updated.set(row.category, row);
        return Array.from(updated.values()).sort((a, b) => a.category.localeCompare(b.category));
      });
    }
  }

  async function toggleRollover(allocId: string, next: boolean) {
    const prev = allocations;
    setAllocations(p => p.map(a => a.id === allocId ? { ...a, rollover: next } : a));
    const { error } = await supabase.from("budget_allocations").update({ rollover: next }).eq("id", allocId);
    if (error) setAllocations(prev);
  }

  async function updateBudgetedInline(allocId: string, budgeted: number) {
    const prev = allocations;
    setAllocations(p => p.map(a => a.id === allocId ? { ...a, budgeted } : a));
    const { error } = await supabase.from("budget_allocations").update({ budgeted }).eq("id", allocId);
    if (error) setAllocations(prev);
  }

  async function classifyCategory(category: string, type: "need"|"want"|"savings"|"investment") {
    const prev = classifications;
    setClassifications(c => ({ ...c, [category]: type }));
    const { error } = await supabase.from("category_classification").upsert({ category, type, set_by: "user" });
    if (error) setClassifications(prev);
  }

  async function reallocate(fromId: string, toId: string, amount: number) {
    const fromAlloc = allocations.find(a => a.id === fromId);
    const toAlloc   = allocations.find(a => a.id === toId);
    if (!fromAlloc || !toAlloc) return;
    const newFrom = Math.max(0, fromAlloc.budgeted - amount);
    const newTo   = toAlloc.budgeted + amount;
    setAllocations(p => p.map(a =>
      a.id === fromId ? { ...a, budgeted: newFrom } :
      a.id === toId   ? { ...a, budgeted: newTo   } :
      a
    ));
    await Promise.all([
      supabase.from("budget_allocations").update({ budgeted: newFrom }).eq("id", fromId),
      supabase.from("budget_allocations").update({ budgeted: newTo   }).eq("id", toId),
    ]);
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
      {modal!==null&&typeof modal==="object"&&modal.type==="edit"&&<AllocModal alloc={modal.alloc} existingCats={allocations.map(a=>a.category)} onSave={saveAlloc} onDelete={async()=>deleteAlloc(modal.alloc.id)} onClose={()=>setModal(null)}/>}
      {saving&&<div style={{position:"fixed",bottom:24,right:24,zIndex:200,fontSize:12,color:"var(--t3)",background:"var(--surface)",border:"1px solid var(--border)",borderRadius:8,padding:"10px 16px"}}>Saving…</div>}

      <div style={{ maxWidth:1180 }}>
        {/* ─── Header: title + sync-status + tab nav ─── */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.32em", color: "var(--blue)", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", marginBottom: 6 }}>
                FINANCE
              </p>
              <h1 style={{ fontSize: 22, fontWeight: 600, color: "var(--t1)", letterSpacing: "-0.01em" }}>
                Autonomous CFO
              </h1>
            </div>
            {lastSync && (
              <span style={{ fontSize: 10, color: "var(--t4)", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", letterSpacing: "0.14em" }}>
                SYNCED {new Date(lastSync).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).toUpperCase()}
              </span>
            )}
          </div>

          {/* Tab nav — full-width, three primary sections */}
          <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)" }}>
            {([
              { id: "overview",    label: "OVERVIEW" },
              { id: "budget",      label: "BUDGET" },
              { id: "investments", label: "INVESTMENTS" },
            ] as { id: Tab; label: string }[]).map(t => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  style={{
                    background: "transparent", border: "none",
                    padding: "12px 22px",
                    color: active ? "var(--blue)" : "var(--t3)",
                    cursor: "pointer",
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    fontSize: 11, fontWeight: 700, letterSpacing: "0.24em",
                    borderBottom: `2px solid ${active ? "var(--blue)" : "transparent"}`,
                    marginBottom: -1,
                    transition: "color .15s, border-color .15s",
                  }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = "var(--t1)"; }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = "var(--t3)"; }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>


        {/* ════════════════════════════════════════
             TAB: OVERVIEW
            ════════════════════════════════════════ */}
        {tab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <LiveStatusBar
              netWorth={netWorth}
              delta24h={nwDelta}
              delta24hPct={nwPct}
              history30d={last30}
              cashFlowRunwayDays={runway}
              readyToAssign={income > 0 ? readyToAssign : null}
            />
            <FinanceQueryBar />
            <NetWorthChart history={wealthSnapshots} loading={!accountsLoaded} />
            <QuarterlyReport />
            <CashFlowForecast />
            <MoneyDNA />
            <NetWorthSimulator />
            <ScenarioTracker />
            <WhatIfEngine />
            <PlaidDiagnostics onChanged={loadAll} />
            <AccountHub
              accounts={finAccounts}
              loading={!accountsLoaded}
              onRefresh={syncNow}
              onArchive={async (id) => {
                await supabase.from("accounts").update({ archived: true, active: false }).eq("plaid_account_id", id);
                await loadAll();
              }}
              onConnected={async () => {
                // Freshly-connected accounts come back with null balances —
                // sync immediately so the UI populates with real numbers.
                await syncNow();
              }}
            />
          </div>
        )}


        {/* ════════════════════════════════════════
             TAB: BUDGET
            ════════════════════════════════════════ */}
        {tab==="budget"&&(
          <div style={{ display:"flex",flexDirection:"column",gap:14 }}>

            {/* Header strip — income, ready-to-assign, budgeted, spent + actions */}
            <div style={{
              background: "linear-gradient(160deg, #0f141d 0%, #080b11 100%)",
              border: "1px solid rgba(125,184,232,0.10)", borderRadius: 3,
              padding: "16px 20px",
              display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 20,
            }}>
              <div style={{ display: "flex", gap: 32, alignItems: "flex-start", flexWrap: "wrap" }}>
                <div>
                  <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.32em", color: "var(--blue)", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", marginBottom: 6 }}>READY TO ASSIGN</p>
                  <p style={{ fontSize: 30, fontWeight: 600, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", color: readyToAssign >= 0 ? "var(--green)" : "var(--red)", letterSpacing: "-0.02em", lineHeight: 1 }}>
                    {readyToAssign < 0 ? "−" : ""}${fmtInt(Math.abs(readyToAssign))}
                  </p>
                  {readyToAssign < 0 && <p style={{ fontSize: 10, color: "var(--red)", marginTop: 4, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", letterSpacing: "0.14em" }}>OVER-BUDGETED</p>}
                </div>
                <button onClick={() => setModal("income")} style={{ background: "transparent", border: "none", padding: 0, textAlign: "left", cursor: "pointer" }}>
                  <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.32em", color: "var(--t3)", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", marginBottom: 6 }}>INCOME</p>
                  <p style={{ fontSize: 22, fontWeight: 500, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", color: "var(--green)", letterSpacing: "-0.02em", lineHeight: 1 }}>${fmtInt(income)}</p>
                  <p style={{ fontSize: 9, color: "var(--t4)", marginTop: 4, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", letterSpacing: "0.14em" }}>CLICK TO EDIT</p>
                </button>
                <div>
                  <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.32em", color: "var(--t3)", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", marginBottom: 6 }}>BUDGETED</p>
                  <p style={{ fontSize: 22, fontWeight: 500, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", color: "var(--blue)", letterSpacing: "-0.02em", lineHeight: 1 }}>${fmtInt(totalBudgeted)}</p>
                </div>
                <div>
                  <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.32em", color: "var(--t3)", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", marginBottom: 6 }}>SPENT</p>
                  <p style={{ fontSize: 22, fontWeight: 500, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", color: totalSpent > totalBudgeted && totalBudgeted > 0 ? "var(--red)" : "var(--t1)", letterSpacing: "-0.02em", lineHeight: 1 }}>${fmtInt(totalSpent)}</p>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => setGoalAllocOpen(true)} style={{ padding: "8px 14px", borderRadius: 2, background: "var(--blue-dim)", border: "1px solid var(--blue-border)", color: "var(--blue)", cursor: "pointer", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 10, letterSpacing: "0.18em", fontWeight: 700 }}>
                  ⊕ GOAL-DRIVEN
                </button>
                <button onClick={() => setLivingTargetsOpen(true)} style={{ padding: "8px 14px", borderRadius: 2, background: "transparent", border: "1px solid var(--blue-border)", color: "var(--blue)", cursor: "pointer", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 10, letterSpacing: "0.18em", fontWeight: 700 }}>
                  ✦ LIVING TARGETS
                </button>
                <button onClick={() => { setPendingPaycheck(null); setPaycheckPlannerOpen(true); }} style={{ padding: "8px 14px", borderRadius: 2, background: "transparent", border: "1px solid var(--border)", color: "var(--t2)", cursor: "pointer", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 10, letterSpacing: "0.18em", fontWeight: 700 }}>
                  💰 PAYCHECK
                </button>
                <button onClick={() => setReallocateOpen(true)} disabled={allocations.length < 2} style={{ padding: "8px 14px", borderRadius: 2, background: "transparent", border: "1px solid var(--border)", color: allocations.length < 2 ? "var(--t4)" : "var(--t2)", cursor: allocations.length < 2 ? "default" : "pointer", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 10, letterSpacing: "0.18em", fontWeight: 700, opacity: allocations.length < 2 ? 0.5 : 1 }}>
                  ⚡ MOVE $
                </button>
                <button onClick={runAICategorize} disabled={aiRunning} style={{ padding: "8px 14px", borderRadius: 2, background: "transparent", border: "1px solid var(--border)", color: aiRunning ? "var(--t4)" : "var(--t2)", cursor: aiRunning ? "default" : "pointer", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 10, letterSpacing: "0.18em", fontWeight: 700 }}>
                  {aiRunning ? "CATEGORIZING…" : "AUTO-CATEGORIZE"}
                </button>
                <button onClick={() => setModal("addAlloc")} style={{ padding: "8px 14px", borderRadius: 2, background: "transparent", border: "1px solid var(--border)", color: "var(--t2)", cursor: "pointer", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 10, letterSpacing: "0.18em", fontWeight: 700 }}>
                  + ADD CATEGORY
                </button>
                <button onClick={() => setManualTxnOpen(true)} style={{ padding: "8px 14px", borderRadius: 2, background: "transparent", border: "1px solid var(--border)", color: "var(--t2)", cursor: "pointer", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 10, letterSpacing: "0.18em", fontWeight: 700 }}>
                  + MANUAL TXN
                </button>
              </div>
            </div>

            {/* Discretionary tracker */}
            {allocations.length > 0 && (
              <DiscretionaryTracker
                needs={flowSplit.needs}
                wants={flowSplit.wants}
                savings={flowSplit.savings}
                investment={flowSplit.investment}
                income={income}
              />
            )}

            {/* Spending Intelligence — top categories, merchants, day-of-week,
                recurring subs, anomalies, AI narrative. The Bloomberg/Mint
                terminal layer on top of the budget table. */}
            <SpendingIntel
              categoryColors={CAT_COLORS}
              onCategoryClick={(cat) => setSelectedBudgetCategory(cat)}
              onMerchantClick={(m) => setDrilldownMerchant(m)}
            />

            {/* Subscription Audit — F3 — recurring detector with cancel/keep/negotiate per sub */}
            <SubscriptionAudit />

            {/* Bills Calendar — F5 — month-grid with weekly totals, click bill to edit */}
            <BillsCalendar bills={bills.map(b => ({ name: b.name, amt: b.amt, due_day: b.due }))} onEditBill={() => setModal("bills")} />

            {/* Tinder review */}
            {reviewing && reviewQueue.length > 0 && (
              <HudCard style={{ padding: "20px 24px" }} delay={0.06}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#9B7BC2" }} />
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.24em", color: "var(--t1)", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                    REVIEW M.A.X. CATEGORIZATIONS
                  </span>
                  <span style={{ fontSize: 10, color: "#9B7BC2", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", letterSpacing: "0.14em" }}>
                    · {reviewQueue.length} TO REVIEW
                  </span>
                </div>
                <TransactionReview
                  transactions={reviewQueue}
                  categories={ALL_CATEGORIES}
                  categoryColors={CAT_COLORS}
                  onConfirm={confirmCategory}
                  onDone={() => { setReviewing(false); setReviewQueue([]); }}
                />
              </HudCard>
            )}

            {/* Category cards */}
            {allocations.length === 0 ? (
              <HudCard style={{ padding: "44px 32px", textAlign: "center" }} delay={0.08}>
                <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.32em", color: "var(--blue)", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", marginBottom: 12 }}>
                  ZERO-BASED BUDGET
                </p>
                <p style={{ fontSize: 16, fontWeight: 600, color: "var(--t1)", marginBottom: 8 }}>Every dollar gets a job</p>
                <p style={{ fontSize: 12, color: "var(--t3)", marginBottom: 22, maxWidth: 380, margin: "0 auto 22px", lineHeight: 1.6 }}>
                  Start fast with sensible defaults, ask M.A.X. to read your spending and propose targets, or build it manually.
                </p>
                <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                  <button onClick={() => setLivingTargetsOpen(true)} style={{ padding: "9px 18px", borderRadius: 2, background: "var(--blue-dim)", border: "1px solid var(--blue-border)", color: "var(--blue)", cursor: "pointer", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 11, letterSpacing: "0.18em", fontWeight: 700 }}>
                    ✦ ASK M.A.X. FOR TARGETS
                  </button>
                  <button onClick={quickBudgetSetup} style={{ padding: "9px 18px", borderRadius: 2, background: "transparent", border: "1px solid var(--border)", color: "var(--t2)", cursor: "pointer", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 11, letterSpacing: "0.18em", fontWeight: 700 }}>
                    QUICK DEFAULTS
                  </button>
                  <button onClick={() => setModal("addAlloc")} style={{ padding: "9px 18px", borderRadius: 2, background: "transparent", border: "1px solid var(--border)", color: "var(--t2)", cursor: "pointer", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 11, letterSpacing: "0.18em", fontWeight: 700 }}>
                    BUILD MANUALLY
                  </button>
                </div>
              </HudCard>
            ) : (
              <BudgetTable
                allocations={allocations}
                spendByCategory={spendByCategory}
                monthlyHistoryByCategory={monthlyHistoryByCategory}
                classifications={classifications}
                categoryColors={CAT_COLORS}
                selectedCategory={selectedBudgetCategory}
                onSelect={setSelectedBudgetCategory}
                onUpdateBudgeted={updateBudgetedInline}
                onUpdateRollover={toggleRollover}
                onClassify={classifyCategory}
              />
            )}

            {/* Transactions — full filterable list */}
            <div style={{
              background: "linear-gradient(160deg, #0f141d 0%, #080b11 100%)",
              border: "1px solid rgba(125,184,232,0.10)", borderRadius: 3,
              padding: "18px 22px",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.24em", color: "var(--t1)", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                  TRANSACTIONS · {new Date(period + "T12:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" }).toUpperCase()}
                </span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ position: "relative" }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--t4)" }}>
                      <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                    </svg>
                    <input value={txSearch} onChange={e => setTxSearch(e.target.value)} placeholder="search merchant…"
                      style={{ paddingLeft: 26, paddingRight: 10, paddingTop: 6, paddingBottom: 6, borderRadius: 2, background: "var(--surface2)", border: "1px solid var(--border2)", color: "var(--t1)", fontSize: 12, outline: "none", width: 160 }}
                    />
                  </div>
                  <select value={txCatFilter ?? ""} onChange={e => setTxCatFilter(e.target.value || null)}
                    style={{ padding: "6px 10px", borderRadius: 2, background: "var(--surface2)", border: "1px solid var(--border2)", color: "var(--t1)", fontSize: 12, outline: "none", cursor: "pointer" }}>
                    <option value="">All categories</option>
                    {ALL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <p style={{ fontSize: 10, color: "var(--t4)", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", letterSpacing: "0.14em", marginBottom: 10 }}>
                {filteredTx.length} TRANSACTIONS · ${fmt(filteredTx.reduce((a, tx) => a + tx.amount, 0))} TOTAL
              </p>

              {filteredTx.length === 0 ? (
                <p style={{ textAlign: "center", padding: "30px 0", color: "var(--t4)", fontSize: 12 }}>
                  {transactions.filter(tx => tx.amount > 0 && !tx.pending).length === 0
                    ? "No transactions in this period yet."
                    : "No transactions match your filter."}
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {filteredTx.map((tx, i) => {
                    const cat = tx.budget_category ?? tx.category ?? "Misc";
                    const color = CAT_COLORS[cat] ?? "#6b7280";
                    return (
                      <div key={tx.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: i < filteredTx.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                          <div style={{ width: 28, height: 28, borderRadius: 4, background: `${color}14`, border: `1px solid ${color}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color, flexShrink: 0 }}>
                            {(tx.merchant ?? "?").slice(0, 2).toUpperCase()}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 500, color: "var(--t1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.merchant}</p>
                            <p style={{ fontSize: 10, color: "var(--t4)" }}>{new Date(tx.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                          <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 2, background: `${color}14`, color, border: `1px solid ${color}22`, whiteSpace: "nowrap", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", letterSpacing: "0.06em" }}>{cat}</span>
                          <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", color: "var(--red)", minWidth: 70, textAlign: "right" }}>−${fmt(tx.amount)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Living Targets modal */}
        <LivingTargetsModal
          open={livingTargetsOpen}
          onClose={() => setLivingTargetsOpen(false)}
          onApply={async (rows) => {
            await applyLivingTargets(rows);
            await loadAll();
          }}
        />

        {/* Goal-Driven Allocator modal */}
        <GoalAllocatorModal
          open={goalAllocOpen}
          goals={goals}
          onClose={() => setGoalAllocOpen(false)}
          onApply={async (rows) => {
            await applyLivingTargets(rows);
            await loadAll();
          }}
        />

        {/* Paycheck Planner modal */}
        <PaycheckPlannerModal
          open={paycheckPlannerOpen}
          paycheck={pendingPaycheck}
          onClose={() => { setPaycheckPlannerOpen(false); setPendingPaycheck(null); }}
          onAccept={async (allocations) => {
            // Apply only the budget_category and savings_goal kinds to allocations table.
            // Bills, IRA contributions, and discretionary are recorded but not auto-applied (yet).
            const budgetRows = allocations
              .filter(a => a.kind === "budget_category" || a.kind === "savings_goal")
              .map(a => ({ category: a.bucket, budgeted: a.amount }));
            if (budgetRows.length > 0) await applyLivingTargets(budgetRows);
            await loadAll();
          }}
        />

        {/* Merchant drilldown modal — F4 — opens from any merchant click in SpendingIntel etc */}
        {drilldownMerchant && (
          <MerchantDrilldown
            merchant={drilldownMerchant}
            onClose={() => setDrilldownMerchant(null)}
            onCategoryChanged={loadAll}
          />
        )}

        {/* Manual transaction modal — F5 */}
        <ManualTxnModal open={manualTxnOpen} onClose={() => setManualTxnOpen(false)} onSaved={loadAll} />

        {/* Reallocate modal */}
        <BudgetReallocateModal
          open={reallocateOpen}
          allocations={allocations}
          spendByCategory={spendByCategory}
          onClose={() => setReallocateOpen(false)}
          onApply={reallocate}
        />

        {/* Category detail side panel */}
        {(() => {
          const selectedAlloc = allocations.find(a => a.category === selectedBudgetCategory);
          if (!selectedAlloc) return null;
          return (
            <CategoryDetailPanel
              open={selectedBudgetCategory !== null}
              category={selectedBudgetCategory}
              alloc={selectedAlloc}
              spent={spendByCategory[selectedAlloc.category] ?? 0}
              monthlyHistory={monthlyHistoryByCategory[selectedAlloc.category] ?? []}
              classification={classifications[selectedAlloc.category] ?? "want"}
              color={CAT_COLORS[selectedAlloc.category] ?? "#7DB8E8"}
              transactions={transactions}
              onClose={() => setSelectedBudgetCategory(null)}
              onUpdateBudgeted={async (b) => updateBudgetedInline(selectedAlloc.id, b)}
              onUpdateRollover={async (next) => toggleRollover(selectedAlloc.id, next)}
              onClassify={async (t) => classifyCategory(selectedAlloc.category, t)}
              onDelete={async () => {
                const ok = await deleteAlloc(selectedAlloc.id);
                if (ok) setSelectedBudgetCategory(null);
              }}
            />
          );
        })()}

        {/* ════════════════════════════════════════
             TAB: INVESTMENTS
            ════════════════════════════════════════ */}
        {tab==="investments"&&(
          <div style={{ display:"flex",flexDirection:"column",gap:16 }}>

            {/* Market Overview */}
            <HudCard style={{ padding:"22px 28px" }} delay={0.04}>
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16 }}>
                <h2 style={{ fontSize:14,fontWeight:700,color:"var(--t1)" }}>Market Overview</h2>
                {market?.updated&&<span style={{ fontSize:10,color:"var(--t4)" }}>Updated {new Date(market.updated).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})}</span>}
              </div>
              {market ? (
                <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12 }}>
                  {([market.SPY,market.QQQ,market.DIA] as (MarketIndex|null)[]).filter(Boolean).map(idx=>{
                    const m = idx!;
                    const pos = m.changePct >= 0;
                    return (
                      <div key={m.symbol} style={{ padding:"16px",borderRadius:9,background:"var(--surface2)",border:"1px solid var(--border)" }}>
                        <div style={{ fontSize:10,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:"var(--t4)",marginBottom:6 }}>{m.name}</div>
                        <div style={{ fontSize:20,fontWeight:800,fontFamily:"monospace",color:"var(--t1)",marginBottom:4 }}>{m.price.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
                        <div style={{ fontSize:12,fontWeight:700,color:pos?"var(--green)":"var(--red)" }}>
                          {pos?"+":""}{m.change.toFixed(2)} ({pos?"+":""}{m.changePct.toFixed(2)}%)
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12 }}>
                  {["S&P 500","NASDAQ","Dow Jones"].map(n=>(
                    <div key={n} style={{ padding:"16px",borderRadius:9,background:"var(--surface2)",border:"1px solid var(--border)" }}>
                      <div style={{ fontSize:10,color:"var(--t4)",marginBottom:8 }}>{n}</div>
                      <div style={{ fontSize:14,color:"var(--t4)" }}>Loading…</div>
                    </div>
                  ))}
                </div>
              )}
            </HudCard>

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

            {/* Crypto theses — F5 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <InvestmentThesisCard holding_id="BTC" holding_type="crypto" display_name="Bitcoin" />
              <InvestmentThesisCard holding_id="XRP" holding_type="crypto" display_name="Ripple" />
            </div>

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

            {/* IRA fund theses — F5 */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
              {["MDDVX", "RPEAX", "PTTRX"].map(sym => (
                <InvestmentThesisCard key={sym} holding_id={sym} holding_type="fund" display_name={sym} />
              ))}
            </div>

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

            {/* Investment News */}
            {news.length>0&&(
              <HudCard style={{ padding:"24px 28px" }} delay={0.14}>
                <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:16 }}>
                  <h2 style={{ fontSize:14,fontWeight:700,color:"var(--t1)" }}>Investment News</h2>
                  <div style={{ fontSize:10,fontWeight:700,color:"var(--blue)",background:"rgba(125,184,232,0.1)",padding:"2px 8px",borderRadius:20,border:"1px solid rgba(125,184,232,0.2)" }}>M.A.X. Curated</div>
                </div>
                <div style={{ display:"flex",flexDirection:"column",gap:1 }}>
                  {news.map((article,i)=>(
                    <a key={i} href={article.url} target="_blank" rel="noopener noreferrer" style={{ display:"block",padding:"12px 0",borderBottom:i<news.length-1?"1px solid rgba(255,255,255,0.04)":"none",textDecoration:"none",transition:"all 0.12s" }}
                      onMouseEnter={e=>(e.currentTarget as HTMLElement).style.paddingLeft="6px"}
                      onMouseLeave={e=>(e.currentTarget as HTMLElement).style.paddingLeft="0px"}
                    >
                      <div style={{ fontSize:13,fontWeight:600,color:"var(--t1)",marginBottom:4,lineHeight:1.4 }}>{article.title}</div>
                      <div style={{ fontSize:11,color:"var(--t3)",lineHeight:1.5,marginBottom:4 }}>{article.snippet}</div>
                      {article.published&&<div style={{ fontSize:10,color:"var(--t4)" }}>{new Date(article.published).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</div>}
                    </a>
                  ))}
                </div>
              </HudCard>
            )}
          </div>
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
          <button onClick={()=>{onSave(draft);onClose();}} style={{ flex:2,padding:"11px 0",borderRadius:6,fontSize:13,fontWeight:700,cursor:"pointer",background:"rgba(125,184,232,0.15)",border:"1px solid rgba(125,184,232,0.4)",color:"var(--blue)" }}>Save</button>
        </div>
      </div>
    </div>
  );
}
