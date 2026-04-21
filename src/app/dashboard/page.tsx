"use client";

import { useState, useEffect, useRef } from "react";
import { HudCard } from "@/components/ui/HudCard";
import { Sparkline } from "@/components/ui/Sparkline";
import { supabase } from "@/lib/supabase";

const BTC_FALLBACK = [88200, 89100, 91400, 90800, 92300, 93100, 94210];
const XRP_FALLBACK = [2.31, 2.18, 2.25, 2.09, 2.14, 2.29, 2.18];

interface LiveCrypto  { symbol: string; price: number; change24h: number; change7d: number; sparkline?: number[] }
interface LiveWeather { tempF: number; condition: string; precipChance: number; windMph: number; feelsLikeF: number; forecast?: { day: string; high: number; low: number; precipChance?: number }[] }
interface NewsItem    { title: string; source: string; tag: string; link: string; snippet: string; pubDate: string; breaking?: boolean }
interface Habit       { id: string; name: string; completed: boolean }
interface Goal        { id: string; current: number }
interface Task        { id: string; text: string; completed: boolean }

const WEALTH_DEFAULTS = { ira: 2720, savings: 2800, btc_amount: 0.02, xrp_amount: 200 };

const ALL_TAGS = ["All", "Breaking", "Finance", "Crypto", "Politics", "AI", "Tech"];

const NEWS_FALLBACK: NewsItem[] = [
  { title: "Fed holds rates steady — markets await next inflation print", source: "Reuters", tag: "Finance", link: "#", snippet: "", pubDate: "", breaking: false },
  { title: "BTC breaks $97K resistance for first time this week", source: "CoinDesk", tag: "Crypto", link: "#", snippet: "", pubDate: "", breaking: true },
  { title: "XRP ETF approval odds climb to 72% on Polymarket", source: "CoinTelegraph", tag: "Crypto", link: "#", snippet: "", pubDate: "", breaking: false },
  { title: "Senate passes budget reconciliation bill — market implications", source: "Politico", tag: "Politics", link: "#", snippet: "", pubDate: "", breaking: false },
  { title: "OpenAI releases new reasoning model surpassing GPT-4o", source: "TechCrunch", tag: "AI", link: "#", snippet: "", pubDate: "", breaking: false },
  { title: "Florida staffing sector hiring up 8% — opportunity for new AMs", source: "Bloomberg", tag: "Finance", link: "#", snippet: "", pubDate: "", breaking: false },
];

const GOAL_META: Record<string, { label: string; target: number; unit: string; colorHex: string }> = {
  "income-100k":    { label: "$100K Income",    target: 100000, unit: "$",       colorHex: "#22c55e" },
  "emergency-fund": { label: "Emergency Fund",  target: 10000,  unit: "$",       colorHex: "#8b5cf6" },
  "gym-52weeks":    { label: "Gym Streak",       target: 52,     unit: "weeks",   colorHex: "#06b6d4" },
  "ai-learning":    { label: "AI Learning",      target: 30,     unit: "sessions",colorHex: "#f97316" },
  "morning-routine":{ label: "Morning Routine",  target: 30,     unit: "days",    colorHex: "#ec4899" },
};

// ── Inline editable field ─────────────────────────────────────────────────────
function formatVal(value: number, prefix: string): string {
  if (prefix) return `${prefix}${value.toLocaleString()}`;
  // Crypto amounts — show exact value, up to 8 decimal places, strip trailing zeros
  return parseFloat(value.toFixed(8)).toString();
}

function InlineEdit({ value, label, prefix = "", onSave, color = "var(--blue)" }: {
  value: number; label: string; prefix?: string; onSave: (v: number) => void; color?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(String(value));
  const inputRef              = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  function commit() {
    const n = parseFloat(draft.replace(/,/g, ""));
    if (!isNaN(n) && n >= 0) onSave(n);
    setEditing(false);
  }

  if (editing) return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 11, color: "var(--t3)" }}>{prefix}</span>
      <input ref={inputRef} type="number" value={draft} onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
        onBlur={commit}
        style={{
          background: "var(--surface3)", border: `1px solid ${color}60`, borderRadius: 4,
          color: "var(--t1)", fontFamily: "monospace", fontSize: 13, fontWeight: 700,
          padding: "2px 8px", width: 100, outline: "none",
        }} />
    </div>
  );

  return (
    <button onClick={() => { setDraft(String(value)); setEditing(true); }}
      title={`Click to edit ${label}`}
      style={{
        background: "none", border: "none", cursor: "pointer", padding: 0,
        display: "flex", alignItems: "center", gap: 4,
      }}>
      <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "monospace", color }}>
        {formatVal(value, prefix)}
      </span>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" style={{ opacity: 0.5 }}>
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
    </button>
  );
}

// ── Insight generator ─────────────────────────────────────────────────────────
function generateInsights(params: {
  btc: LiveCrypto | undefined; xrp: LiveCrypto | undefined;
  btcAmt: number; xrpAmt: number;
  netWorth: number; cryptoGain: number;
  habits: Habit[]; goals: Goal[];
  weather: LiveWeather | null;
  hour: number;
}): { icon: string; text: string; color: string; priority: number }[] {
  const { btc, xrp, btcAmt, xrpAmt, cryptoGain, habits, goals, weather, hour } = params;
  const insights: { icon: string; text: string; color: string; priority: number }[] = [];

  // Crypto
  if (btc) {
    const gain = btc.price * btcAmt;
    const dailyChange = gain * (btc.change24h / 100);
    if (Math.abs(btc.change24h) >= 3) {
      insights.push({
        icon: btc.change24h > 0 ? "↗" : "↘",
        text: `BTC ${btc.change24h > 0 ? "up" : "down"} ${Math.abs(btc.change24h).toFixed(1)}% today — your ${btcAmt} BTC ${btc.change24h > 0 ? "gained" : "lost"} $${Math.abs(dailyChange).toFixed(0)}. ${btc.change7d > 0 ? `Up ${btc.change7d.toFixed(1)}% this week.` : `Down ${Math.abs(btc.change7d).toFixed(1)}% this week.`}`,
        color: btc.change24h > 0 ? "var(--green)" : "var(--red)",
        priority: 1,
      });
    } else {
      insights.push({
        icon: "◈",
        text: `BTC trading at $${Math.round(btc.price).toLocaleString()} — ${btc.change24h >= 0 ? "+" : ""}${btc.change24h.toFixed(2)}% today. Portfolio holding steady.`,
        color: "var(--t2)",
        priority: 3,
      });
    }
  }

  if (xrp && Math.abs(xrp.change24h) >= 4) {
    const xrpGain = xrp.price * xrpAmt * (xrp.change24h / 100);
    insights.push({
      icon: xrp.change24h > 0 ? "↗" : "↘",
      text: `XRP ${xrp.change24h > 0 ? "surging" : "dropping"} ${Math.abs(xrp.change24h).toFixed(1)}% — your 200 XRP ${xrp.change24h > 0 ? "gained" : "lost"} $${Math.abs(xrpGain).toFixed(0)} today.`,
      color: xrp.change24h > 0 ? "var(--green)" : "var(--red)",
      priority: 1,
    });
  }

  if (cryptoGain > 50) {
    insights.push({
      icon: "◎",
      text: `Crypto up $${cryptoGain.toFixed(0)} today. Consider whether to take partial profits or hold into next resistance.`,
      color: "var(--green)",
      priority: 2,
    });
  }

  // Habits
  const done    = habits.filter(h => h.completed).length;
  const total   = habits.length;
  const pct     = total > 0 ? Math.round((done / total) * 100) : 0;
  const gymDone = habits.find(h => h.name === "Gym")?.completed;

  if (pct === 100) {
    insights.push({ icon: "✦", text: "Perfect day on habits. Every box checked — this is how the streak gets built.", color: "var(--green)", priority: 2 });
  } else if (total > 0 && done < total) {
    const remaining = total - done;
    insights.push({
      icon: "◉",
      text: hour < 18
        ? `${done}/${total} habits done (${pct}%). ${remaining} left — plenty of time.`
        : `${remaining} habit${remaining > 1 ? "s" : ""} still open tonight. Close them out before you sleep.`,
      color: pct >= 50 ? "var(--amber)" : "var(--red)",
      priority: hour >= 18 ? 1 : 3,
    });
  }

  if (!gymDone && hour >= 15) {
    insights.push({ icon: "↑", text: "Gym not logged yet. Don't let today be the day the streak breaks.", color: "var(--amber)", priority: 2 });
  }

  // Goals
  const emergencyGoal = goals.find(g => g.id === "emergency-fund");
  if (emergencyGoal) {
    const pctDone = (emergencyGoal.current / 10000) * 100;
    const remaining = 10000 - emergencyGoal.current;
    insights.push({
      icon: "◈",
      text: `Emergency fund at ${pctDone.toFixed(0)}% ($${emergencyGoal.current.toLocaleString()}/$10K). Need $${remaining.toLocaleString()} more — at $200/mo that's ${Math.ceil(remaining / 200)} months.`,
      color: "var(--blue)",
      priority: 4,
    });
  }

  // Weather
  if (weather && weather.precipChance >= 60) {
    insights.push({ icon: "◌", text: `${weather.precipChance}% rain today in Orlando. Factor that into your commute and gym timing.`, color: "var(--t3)", priority: 5 });
  }

  return insights.sort((a, b) => a.priority - b.priority).slice(0, 5);
}

// ── Time ago helper ───────────────────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Briefing trigger button ────────────────────────────────────────────────────
function BriefingButton() {
  const [state, setState] = useState<"idle"|"loading"|"sent"|"error">("idle");

  async function trigger() {
    setState("loading");
    try {
      const res = await fetch("/api/briefing", { method: "POST" });
      setState(res.ok ? "sent" : "error");
    } catch {
      setState("error");
    }
    setTimeout(() => setState("idle"), 3000);
  }

  const labels = { idle: "📧", loading: "...", sent: "✓", error: "!" };
  const colors = { idle: "var(--t3)", loading: "var(--blue)", sent: "var(--green)", error: "var(--red)" };

  return (
    <button onClick={trigger} disabled={state === "loading"} title="Send daily briefing now" style={{
      padding: "10px 12px", borderRadius: 4, fontSize: 12, fontWeight: 700,
      background: "rgba(255,255,255,0.03)", color: colors[state],
      border: `1px solid ${state === "idle" ? "var(--border)" : colors[state]}`,
      cursor: state === "loading" ? "default" : "pointer", transition: "all .15s", flexShrink: 0,
    }}>
      {labels[state]}
    </button>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [time, setTime]       = useState(new Date());
  const [crypto, setCrypto]   = useState<LiveCrypto[]>([]);
  const [weather, setWeather] = useState<LiveWeather | null>(null);
  const [news, setNews]       = useState<NewsItem[]>([]);
  const [activeTag, setActiveTag] = useState("All");
  const [habits, setHabits]       = useState<Habit[]>([]);
  const [goals, setGoals]         = useState<Goal[]>([]);
  const [wealth, setWealth]       = useState(WEALTH_DEFAULTS);
  const [savingWealth, setSavingWealth] = useState(false);
  const [tasks, setTasks]         = useState<Task[]>([]);
  const [addingTask, setAddingTask] = useState(false);
  const [newTaskText, setNewTaskText] = useState("");
  const [alertDismissed, setAlertDismissed] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  function fetchCrypto() {
    fetch("/api/crypto").then(r => r.json()).then(j => { if (j.data) setCrypto(j.data); }).catch(() => {});
  }

  useEffect(() => {
    fetchCrypto();
    fetch("/api/weather?location=orlando").then(r => r.json()).then(j => { if (j.data) setWeather(j.data); }).catch(() => {});
    fetch("/api/news?count=30").then(r => r.json()).then(j => { if (j.data) setNews(j.data); }).catch(() => {});
    supabase.from("habits").select("id,name,completed").then(({ data }) => { if (data) setHabits(data); });
    supabase.from("goals").select("id,current").then(({ data }) => { if (data) setGoals(data); });
    supabase.from("wealth").select("*").limit(1).then(({ data }) => {
      if (data && data.length > 0) setWealth({ ...WEALTH_DEFAULTS, ...data[0] });
    });
    supabase.from("tasks").select("id,text,completed").order("created_at").then(({ data }) => { if (data) setTasks(data); });
    const cryptoInterval = setInterval(fetchCrypto, 30000);
    return () => clearInterval(cryptoInterval);
  }, []);

  async function addTask() {
    const text = newTaskText.trim();
    if (!text) return;
    setNewTaskText("");
    setAddingTask(false);
    const { data } = await supabase.from("tasks").insert({ text, completed: false }).select().single();
    if (data) setTasks(prev => [...prev, data]);
  }

  async function toggleTask(id: string, completed: boolean) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !completed } : t));
    await supabase.from("tasks").update({ completed: !completed }).eq("id", id);
  }

  async function deleteTask(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id));
    await supabase.from("tasks").delete().eq("id", id);
  }

  async function updateWealth(key: keyof typeof WEALTH_DEFAULTS, val: number) {
    const updated = { ...wealth, [key]: val };
    setWealth(updated);
    setSavingWealth(true);
    await supabase.from("wealth").upsert({ id: "max", ...updated });
    setTimeout(() => setSavingWealth(false), 800);
  }

  const btc = crypto.find(c => c.symbol === "BTC");
  const xrp = crypto.find(c => c.symbol === "XRP");

  const cryptoAlerts = [
    btc && Math.abs(btc.change24h) >= 5 ? { symbol: "BTC", change: btc.change24h, up: btc.change24h > 0 } : null,
    xrp && Math.abs(xrp.change24h) >= 5 ? { symbol: "XRP", change: xrp.change24h, up: xrp.change24h > 0 } : null,
  ].filter(Boolean) as { symbol: string; change: number; up: boolean }[];

  const btcVal     = btc ? btc.price * wealth.btc_amount : 0;
  const xrpVal     = xrp ? xrp.price * wealth.xrp_amount : 0;
  const cryptoTotal = btcVal + xrpVal;
  const netWorth   = cryptoTotal + wealth.ira + wealth.savings;

  const btcGain  = btc ? btcVal * (btc.change24h / 100) : 0;
  const xrpGain  = xrp ? xrpVal * (xrp.change24h / 100) : 0;
  const cryptoGain = btcGain + xrpGain;
  const netWorthChange = cryptoGain;

  const h        = time.getHours();
  const greeting = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  const dayLabel = time.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const timeStr  = time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const habitsDone = habits.filter(hb => hb.completed).length;
  const ringC      = 2 * Math.PI * 22;
  const ringDash   = habits.length > 0 ? ringC - (habitsDone / habits.length) * ringC : ringC;

  const displayNews = (news.length ? news : NEWS_FALLBACK).filter(n =>
    activeTag === "All" ? true : activeTag === "Breaking" ? n.breaking : n.tag === activeTag
  );

  const insights = generateInsights({ btc, xrp, btcAmt: wealth.btc_amount, xrpAmt: wealth.xrp_amount, netWorth, cryptoGain, habits, goals, weather, hour: h });

  const CRYPTO_ROWS = [
    { symbol: "BTC", name: "Bitcoin", amt: wealth.btc_amount, price: btc?.price ?? 0, change: btc?.change24h ?? 0, val: btcVal, data: btc?.sparkline?.slice(-20) ?? BTC_FALLBACK },
    { symbol: "XRP", name: "Ripple",  amt: wealth.xrp_amount, price: xrp?.price ?? 0, change: xrp?.change24h ?? 0, val: xrpVal, data: xrp?.sparkline?.slice(-20) ?? XRP_FALLBACK },
  ];

  return (
    <div style={{ padding: "28px 36px", background: "var(--bg)", minHeight: "100vh" }}>

      {/* ── CRYPTO ALERT BANNER ── */}
      {!alertDismissed && cryptoAlerts.length > 0 && (
        <div className="afu" style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "10px 16px", marginBottom: 16, borderRadius: 8,
          background: cryptoAlerts.some(a => !a.up) ? "rgba(239,68,68,0.07)" : "rgba(34,197,94,0.07)",
          border: `1px solid ${cryptoAlerts.some(a => !a.up) ? "rgba(239,68,68,0.2)" : "rgba(34,197,94,0.2)"}`,
        }}>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", color: cryptoAlerts.some(a => !a.up) ? "var(--red)" : "var(--green)", flexShrink: 0 }}>
            M.A.X. ALERT
          </span>
          <p style={{ flex: 1, fontSize: 13, color: "var(--t2)", margin: 0 }}>
            {cryptoAlerts.map(a => (
              <span key={a.symbol} style={{ marginRight: 12 }}>
                <span style={{ fontWeight: 700, color: a.up ? "var(--green)" : "var(--red)" }}>
                  {a.symbol}
                </span>{" "}
                {a.up ? "▲" : "▼"} {a.up ? "+" : ""}{a.change.toFixed(1)}% in 24h
              </span>
            ))}
          </p>
          <button onClick={() => setAlertDismissed(true)} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--t4)", display: "flex", alignItems: "center", padding: 4, flexShrink: 0,
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* ── HEADER ── */}
      <div className="afu" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--t3)", marginBottom: 6 }}>{dayLabel}</p>
          <h1 style={{ fontSize: 30, fontWeight: 800, color: "var(--t1)", letterSpacing: "-0.02em", marginBottom: 8 }}>{greeting}, Max.</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 12, color: "var(--t3)" }}>
            <span>{habitsDone}/{habits.length || 6} habits</span>
            <span style={{ color: "var(--border2)" }}>·</span>
            <span style={{ color: netWorthChange >= 0 ? "var(--green)" : "var(--red)", fontWeight: 600 }}>
              {netWorthChange >= 0 ? "+" : ""}${netWorthChange.toFixed(0)} today
            </span>
            <span style={{ color: "var(--border2)" }}>·</span>
            <span style={{ color: btc && btc.change24h >= 0 ? "var(--green)" : "var(--red)", fontWeight: 600 }}>
              BTC {btc ? `${btc.change24h >= 0 ? "+" : ""}${btc.change24h.toFixed(2)}%` : "—"}
            </span>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "monospace", fontSize: 34, fontWeight: 800, color: "var(--t1)", letterSpacing: "-0.02em" }}>{timeStr}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end", marginTop: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green)", animation: "pulse-dot 2s ease-in-out infinite", display: "inline-block" }} />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", color: "var(--green)", textTransform: "uppercase" }}>M.A.X. Online</span>
          </div>
        </div>
      </div>

      {/* ── NET WORTH HERO ── */}
      <HudCard className="afu" delay={.04} style={{ padding: "20px 28px 24px", marginBottom: 16 }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--t3)" }}>Tracked Net Worth</p>
          <a href="/dashboard/finance" style={{
            display: "flex", alignItems: "center", gap: 5,
            fontSize: 11, fontWeight: 600, color: "var(--t3)",
            textDecoration: "none", padding: "5px 10px", borderRadius: 4,
            border: "1px solid var(--border)", background: "var(--surface2)",
            transition: "all .15s",
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--t1)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--blue)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--t3)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Edit Portfolio
          </a>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* Left: total */}
          <div>
            <div style={{ fontSize: 48, fontWeight: 800, fontFamily: "monospace", color: "var(--t1)", letterSpacing: "-0.02em", lineHeight: 1 }}>
              ${netWorth.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: netWorthChange >= 0 ? "var(--green)" : "var(--red)" }}>
                {netWorthChange >= 0 ? "+" : ""}${netWorthChange.toFixed(2)} today
              </span>
              <span style={{ fontSize: 13, color: "var(--t3)" }}>from crypto movement</span>
            </div>
          </div>

          {/* Right: breakdown — read only */}
          <div style={{ display: "flex", gap: 32 }}>
            {[
              { label: "Crypto",   val: `$${cryptoTotal.toFixed(0)}`,                                              sub: "Live prices",  color: "var(--amber)" },
              { label: "BTC Held", val: `${parseFloat(wealth.btc_amount.toFixed(8))} BTC`,                         sub: `$${btcVal.toFixed(0)}`, color: "var(--amber)" },
              { label: "XRP Held", val: `${wealth.xrp_amount} XRP`,                                                sub: `$${xrpVal.toFixed(0)}`, color: "var(--amber)" },
              { label: "Roth IRA", val: `$${wealth.ira.toLocaleString()}`,                                         sub: "Schwab",       color: "var(--blue)"  },
              { label: "Savings",  val: `$${wealth.savings.toLocaleString()}`,                                     sub: "Cash",         color: "var(--green)" },
            ].map((r, i, arr) => (
              <div key={r.label} style={{ display: "flex", gap: 32 }}>
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--t3)", marginBottom: 10 }}>{r.label}</p>
                  <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "monospace", color: r.color }}>{r.val}</div>
                  <p style={{ fontSize: 10, color: "var(--t3)", marginTop: 4 }}>{r.sub}</p>
                </div>
                {i < arr.length - 1 && i !== 2 && <div style={{ width: 1, background: "var(--border)", alignSelf: "stretch" }} />}
              </div>
            ))}
          </div>
        </div>
      </HudCard>

      {/* ── MAIN 3-COL GRID ── */}
      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr 260px", gap: 12 }}>

        {/* ── LEFT: WEATHER + HABITS + GOAL PULSE ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Weather */}
          <HudCard delay={.08} style={{ padding: "20px 20px 16px" }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--t3)", marginBottom: 14 }}>Orlando Weather</p>
            {weather ? (
              <>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 48, fontWeight: 800, color: "var(--t1)", lineHeight: 1, fontFamily: "monospace" }}>{weather.tempF}°</span>
                  <div style={{ marginBottom: 4 }}>
                    <div style={{ fontSize: 13, color: "var(--t2)", fontWeight: 500 }}>{weather.condition}</div>
                    <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 2 }}>Feels {weather.feelsLikeF}° · Wind {weather.windMph}mph</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
                  <div style={{ flex: 1, height: 3, borderRadius: 2, background: "var(--border2)" }}>
                    <div style={{ height: 3, borderRadius: 2, width: `${weather.precipChance}%`, background: weather.precipChance > 50 ? "var(--blue)" : "var(--t4)", transition: "width 1s ease" }} />
                  </div>
                  <span style={{ fontSize: 11, color: weather.precipChance > 50 ? "var(--blue)" : "var(--t3)", fontWeight: 600, flexShrink: 0 }}>Rain {weather.precipChance}%</span>
                </div>
                {weather.forecast && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4 }}>
                    {weather.forecast.slice(0, 5).map((f, i) => (
                      <div key={i} style={{ textAlign: "center", padding: "8px 4px", borderRadius: 4, background: "var(--surface2)", border: "1px solid var(--border)" }}>
                        <div style={{ fontSize: 10, color: "var(--t3)", fontWeight: 600, marginBottom: 4 }}>{f.day}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--t1)", fontFamily: "monospace" }}>{f.high}°</div>
                        <div style={{ fontSize: 10, color: "var(--t3)" }}>{f.low}°</div>
                        {(f.precipChance ?? 0) > 30 && <div style={{ fontSize: 9, color: "var(--blue)", marginTop: 2 }}>{f.precipChance}%</div>}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontSize: 32, fontWeight: 800, color: "var(--t3)" }}>—</div>
            )}
          </HudCard>

          {/* Habits */}
          <HudCard delay={.12} style={{ padding: "20px 20px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--t3)" }}>Today&apos;s Habits</p>
              <a href="/dashboard/habits" style={{ fontSize: 11, color: "var(--blue)", textDecoration: "none" }}>Manage →</a>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14 }}>
              <svg width="52" height="52" viewBox="0 0 52 52" style={{ flexShrink: 0 }}>
                <circle cx="26" cy="26" r="22" fill="none" stroke="var(--border2)" strokeWidth="4" />
                <circle cx="26" cy="26" r="22" fill="none" stroke="var(--blue)" strokeWidth="4"
                  strokeDasharray={ringC} strokeDashoffset={ringDash} strokeLinecap="round" transform="rotate(-90 26 26)"
                  style={{ transition: "stroke-dashoffset .6s ease" }} />
                <text x="26" y="30" textAnchor="middle" fontSize="11" fontWeight="800" fill="var(--t1)">{habitsDone}/{habits.length || 0}</text>
              </svg>
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "var(--t1)" }}>
                  {habits.length > 0 ? `${Math.round((habitsDone / habits.length) * 100)}%` : "—"}
                </div>
                <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 2 }}>done today</div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {habits.slice(0, 5).map((hb, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 4, background: "var(--surface2)" }}>
                  <div style={{
                    width: 14, height: 14, borderRadius: 3, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                    background: hb.completed ? "rgba(34,197,94,0.15)" : "transparent",
                    border: `1px solid ${hb.completed ? "rgba(34,197,94,0.5)" : "var(--border2)"}`,
                  }}>
                    {hb.completed && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3.5"><polyline points="20 6 9 17 4 12" /></svg>}
                  </div>
                  <span style={{ fontSize: 12, flex: 1, color: hb.completed ? "var(--t1)" : "var(--t3)", fontWeight: hb.completed ? 500 : 400 }}>{hb.name}</span>
                </div>
              ))}
              {habits.length === 0 && <p style={{ fontSize: 12, color: "var(--t3)" }}>Loading habits…</p>}
            </div>
          </HudCard>

          {/* Goal Pulse */}
          <HudCard delay={.16} style={{ padding: "20px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--t3)" }}>Goal Pulse</p>
              <a href="/dashboard/goals" style={{ fontSize: 11, color: "var(--blue)", textDecoration: "none" }}>All goals →</a>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {Object.entries(GOAL_META).slice(0, 4).map(([id, meta]) => {
                const g = goals.find(x => x.id === id);
                const cur = g?.current ?? 0;
                const pct = Math.min(100, Math.round((cur / meta.target) * 100));
                const disp = meta.unit === "$" ? `$${cur.toLocaleString()}` : `${cur} ${meta.unit}`;
                return (
                  <div key={id}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 5 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--t1)" }}>{meta.label}</span>
                      <span style={{ fontSize: 11, fontFamily: "monospace", color: meta.colorHex, fontWeight: 700 }}>{pct}%</span>
                    </div>
                    <div style={{ height: 3, borderRadius: 2, background: "var(--border2)", marginBottom: 3 }}>
                      <div style={{ height: 3, borderRadius: 2, width: `${pct || 1}%`, background: meta.colorHex, transition: "width 1s ease" }} />
                    </div>
                    <div style={{ fontSize: 10, color: "var(--t3)" }}>{disp} of {meta.unit === "$" ? `$${meta.target.toLocaleString()}` : `${meta.target} ${meta.unit}`}</div>
                  </div>
                );
              })}
            </div>
          </HudCard>
        </div>

        {/* ── CENTER: SCHEDULE + INTEL FEED ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

        {/* Schedule */}
        <HudCard delay={.09} style={{ padding: "20px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--t3)" }}>Today&apos;s Schedule</p>
            <a href="/dashboard/calendar" style={{ fontSize: 11, color: "var(--blue)", textDecoration: "none" }}>Full calendar →</a>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              { time: "9:00a",  title: "Team standup",                    duration: "30 min", type: "Work"   },
              { time: "11:00a", title: "Client call — Northside Staffing", duration: "1 hr",   type: "Work"   },
              { time: "2:00p",  title: "Review Q2 pipeline",              duration: "45 min", type: "Work"   },
              { time: "6:00p",  title: "Gym — Pull Day",                  duration: "1 hr",   type: "Health" },
            ].map((ev, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 4,
                background: "var(--surface2)", borderLeft: `2px solid ${ev.type === "Health" ? "var(--green)" : "var(--blue)"}`,
              }}>
                <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--t3)", width: 40, flexShrink: 0 }}>{ev.time}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ev.title}</div>
                  <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 1 }}>{ev.duration}</div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 3, flexShrink: 0,
                  background: ev.type === "Health" ? "rgba(34,197,94,0.08)" : "rgba(69,137,255,0.08)",
                  color: ev.type === "Health" ? "var(--green)" : "var(--blue)",
                  border: `1px solid ${ev.type === "Health" ? "rgba(34,197,94,0.2)" : "rgba(69,137,255,0.2)"}`,
                }}>{ev.type}</span>
              </div>
            ))}
          </div>
        </HudCard>

        {/* Intel Feed */}
        <HudCard delay={.1} style={{ padding: "20px 24px", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--t3)", marginBottom: 2 }}>Intel Feed</p>
              <p style={{ fontSize: 11, color: "var(--t3)" }}>{(news.length || NEWS_FALLBACK.length)} articles · live</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green)", animation: "pulse-dot 2s ease-in-out infinite", display: "inline-block" }} />
              <span style={{ fontSize: 11, color: "var(--t3)" }}>Live</span>
            </div>
          </div>

          {/* Filter tabs */}
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 14 }}>
            {ALL_TAGS.map(tag => (
              <button key={tag} onClick={() => setActiveTag(tag)} style={{
                fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 3, cursor: "pointer",
                background: activeTag === tag ? "rgba(69,137,255,0.15)" : "transparent",
                border: `1px solid ${activeTag === tag ? "rgba(69,137,255,0.4)" : "var(--border)"}`,
                color: activeTag === tag ? "var(--blue)" : "var(--t3)",
                transition: "all .15s",
              }}>
                {tag === "Breaking" ? "● Breaking" : tag}
              </button>
            ))}
          </div>

          <div style={{ height: 1, background: "var(--border)", marginBottom: 12 }} />

          {/* Articles */}
          <div style={{ maxHeight: 520, overflowY: "auto", display: "flex", flexDirection: "column" }}>
            {displayNews.slice(0, 20).map((n, i) => (
              <a key={i} href={n.link} target="_blank" rel="noopener noreferrer" style={{
                display: "block", padding: "13px 10px", textDecoration: "none",
                borderLeft: n.breaking ? "2px solid var(--red)" : "2px solid transparent",
                borderBottom: i < displayNews.slice(0, 20).length - 1 ? "1px solid var(--border)" : "none",
                background: n.breaking ? "rgba(239,68,68,0.02)" : "transparent",
                borderRadius: n.breaking ? "0 4px 4px 0" : 0,
                transition: "background .15s",
              }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--surface2)")}
                onMouseLeave={e => (e.currentTarget.style.background = n.breaking ? "rgba(239,68,68,0.02)" : "transparent")}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 5 }}>
                  {n.breaking && (
                    <span style={{ fontSize: 9, fontWeight: 800, color: "var(--red)", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 3, padding: "2px 5px", flexShrink: 0, marginTop: 1, letterSpacing: "0.05em" }}>LIVE</span>
                  )}
                  <p style={{ fontSize: 13, fontWeight: 500, color: "var(--t1)", lineHeight: 1.5, margin: 0 }}>{n.title}</p>
                </div>
                {n.snippet && (
                  <p style={{ fontSize: 11, color: "var(--t3)", lineHeight: 1.5, margin: "0 0 5px", paddingLeft: n.breaking ? 0 : 0 }}>{n.snippet.slice(0, 120)}{n.snippet.length > 120 ? "…" : ""}</p>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--t3)" }}>{n.source}</span>
                  <span style={{ fontSize: 9, color: "var(--t4)" }}>·</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 2, background: "var(--surface3)", color: "var(--t2)" }}>{n.tag}</span>
                  {n.pubDate && <span style={{ fontSize: 10, color: "var(--t4)", marginLeft: "auto" }}>{timeAgo(n.pubDate)}</span>}
                </div>
              </a>
            ))}
            {displayNews.length === 0 && (
              <p style={{ fontSize: 13, color: "var(--t3)", padding: "20px 10px" }}>No articles in this category.</p>
            )}
          </div>
        </HudCard>

        {/* ── TASKS ── */}
        <HudCard delay={.13} style={{ padding: "18px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--t3)" }}>Tasks</p>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <a href="/dashboard/calendar" style={{ fontSize: 11, color: "var(--blue)", textDecoration: "none" }}>All →</a>
              <button onClick={() => setAddingTask(t => !t)} style={{
                width: 22, height: 22, borderRadius: 5, cursor: "pointer",
                background: addingTask ? "rgba(69,137,255,0.12)" : "transparent",
                border: `1px solid ${addingTask ? "rgba(69,137,255,0.3)" : "var(--border2)"}`,
                color: addingTask ? "var(--blue)" : "var(--t3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all .15s",
              }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
            </div>
          </div>

          {addingTask && (
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              <input
                autoFocus
                value={newTaskText}
                onChange={e => setNewTaskText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") addTask();
                  if (e.key === "Escape") { setAddingTask(false); setNewTaskText(""); }
                }}
                placeholder="New task…"
                style={{
                  flex: 1, background: "var(--surface2)", border: "1px solid var(--border2)",
                  borderRadius: 6, padding: "6px 10px", fontSize: 12, color: "var(--t1)", outline: "none",
                }}
              />
              <button onClick={addTask} style={{
                padding: "6px 12px", background: "rgba(69,137,255,0.1)",
                border: "1px solid rgba(69,137,255,0.2)", borderRadius: 6,
                fontSize: 12, fontWeight: 600, color: "var(--blue)", cursor: "pointer",
              }}>Add</button>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 180, overflowY: "auto" }}>
            {tasks.length === 0 && !addingTask && (
              <p style={{ fontSize: 12, color: "var(--t4)", textAlign: "center", padding: "14px 0" }}>
                No open tasks.
              </p>
            )}
            {tasks.filter(t => !t.completed).concat(tasks.filter(t => t.completed)).map(task => (
              <div key={task.id} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "7px 10px",
                borderRadius: 4, background: "var(--surface2)",
                opacity: task.completed ? 0.45 : 1, transition: "opacity .2s",
              }}>
                <button onClick={() => toggleTask(task.id, task.completed)} style={{
                  width: 15, height: 15, borderRadius: 3, flexShrink: 0, cursor: "pointer",
                  background: task.completed ? "rgba(34,197,94,0.15)" : "transparent",
                  border: `1px solid ${task.completed ? "rgba(34,197,94,0.4)" : "var(--border2)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center", transition: "all .15s",
                }}>
                  {task.completed && (
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3.5" strokeLinecap="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
                <span style={{
                  flex: 1, fontSize: 12, color: "var(--t2)",
                  textDecoration: task.completed ? "line-through" : "none",
                }}>
                  {task.text}
                </span>
                <button onClick={() => deleteTask(task.id)} style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--t4)", display: "flex", alignItems: "center", padding: 2,
                  borderRadius: 3, transition: "color .15s",
                }}
                  onMouseEnter={e => (e.currentTarget.style.color = "var(--red)")}
                  onMouseLeave={e => (e.currentTarget.style.color = "var(--t4)")}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </HudCard>

        </div>{/* end center column */}

        {/* ── RIGHT: CRYPTO + M.A.X. BRIEF ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Crypto */}
          <HudCard delay={.1} style={{ padding: "20px 20px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--t3)" }}>Holdings</p>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--green)", animation: "pulse-dot 2s ease-in-out infinite", display: "inline-block" }} />
                <span style={{ fontSize: 10, color: "var(--t3)" }}>Live</span>
              </div>
            </div>
            {CRYPTO_ROWS.map((a, i) => (
              <div key={a.symbol} style={{ marginBottom: i < CRYPTO_ROWS.length - 1 ? 20 : 0 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--t1)" }}>
                      {a.symbol} <span style={{ fontSize: 11, fontWeight: 400, color: "var(--t3)" }}>{a.name}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 2 }}>{a.amt} {a.symbol} · ${a.val.toFixed(2)}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "monospace", color: "var(--t1)" }}>
                      ${a.symbol === "BTC" ? Math.round(a.price).toLocaleString() : a.price.toFixed(4)}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: a.change >= 0 ? "var(--green)" : "var(--red)" }}>
                      {a.change >= 0 ? "+" : ""}{a.change.toFixed(2)}%
                    </div>
                  </div>
                </div>
                <Sparkline data={a.data} color={a.change >= 0 ? "var(--green)" : "var(--red)"} height={32} id={`d-${a.symbol}`} />
              </div>
            ))}
          </HudCard>

          {/* M.A.X. Brief */}
          <HudCard delay={.18} style={{ padding: "20px 20px", flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--t3)" }}>M.A.X. Brief</p>
              <span style={{ fontSize: 10, color: "var(--blue)", fontWeight: 600 }}>Live data</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {insights.length > 0 ? insights.map((ins, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", paddingBottom: 12, borderBottom: i < insights.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: ins.color, flexShrink: 0, marginTop: 1, width: 14, textAlign: "center" }}>{ins.icon}</span>
                  <span style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.6 }}>{ins.text}</span>
                </div>
              )) : (
                <p style={{ fontSize: 12, color: "var(--t3)" }}>Loading insights…</p>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={() => window.dispatchEvent(new CustomEvent("max-open-chat"))} style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                padding: "10px 0", borderRadius: 4, fontSize: 12, fontWeight: 700,
                background: "rgba(69,137,255,0.1)", color: "var(--blue)", border: "1px solid rgba(69,137,255,0.2)",
                cursor: "pointer",
              }}>
                Ask M.A.X. →
              </button>
              <BriefingButton />
            </div>
          </HudCard>
        </div>
      </div>
    </div>
  );
}
