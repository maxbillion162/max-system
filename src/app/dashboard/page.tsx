"use client";

import { useState, useEffect } from "react";
import { HudCard } from "@/components/ui/HudCard";
import { Sparkline } from "@/components/ui/Sparkline";

const PORT_DATA = [5620, 5750, 6100, 5890, 6030, 6220, 6320];
// Fallback sparkline data used until live prices load
const BTC_FALLBACK = [88200, 89100, 91400, 90800, 92300, 93100, 94210];
const XRP_FALLBACK = [2.31, 2.18, 2.25, 2.09, 2.14, 2.29, 2.18];

interface LiveCrypto { symbol: string; price: number; change24h: number; change7d: number; sparkline?: number[] }
interface LiveWeather { tempF: number; condition: string; precipChance: number; windMph: number; feelsLikeF: number; forecast?: { day: string; high: number; low: number }[] }

const EVENTS = [
  { time: "9:00 AM",  title: "Team standup",                duration: "30 min",  type: "Work"   },
  { time: "11:00 AM", title: "Client call — Northside Staffing", duration: "1 hr", type: "Work" },
  { time: "2:00 PM",  title: "Review Q2 pipeline",          duration: "45 min",  type: "Work"   },
  { time: "6:00 PM",  title: "Gym — Pull Day",              duration: "1 hr",    type: "Health" },
];

const HABITS = [
  { label: "Up by 7:30 AM", done: true,  streak: 4  },
  { label: "Gym",           done: true,  streak: 12 },
  { label: "Read / Learn",  done: false, streak: 3  },
  { label: "Protein goal",  done: false, streak: 0  },
];

const NEWS = [
  { title: "Fed holds rates — implications for crypto ETF approvals this quarter", source: "Bloomberg", bias: "C",   tag: "Finance" },
  { title: "OpenAI launches GPT-5 with breakthrough reasoning capabilities",       source: "The Verge", bias: "C-L", tag: "AI"      },
  { title: "XRP ETF approval odds climb to 72% on Polymarket amid SEC signals",   source: "CoinDesk",  bias: "C",   tag: "Crypto"  },
  { title: "FSU football clinches ACC title in comeback win over Clemson",         source: "ESPN",      bias: "C",   tag: "FSU"     },
  { title: "Florida unemployment hits 3.1% — staffing sector hiring up 8%",       source: "Sun Sentinel", bias: "C", tag: "Local" },
];

const BRIEF = [
  { icon: "📈", text: "BTC up 3.2% overnight — holding above $94K. XRP dipped 1.4%, no action needed." },
  { icon: "📅", text: "4 events today. Client call at 11 AM is your most important — prep 10 min before." },
  { icon: "💪", text: "Gym streak at 12 days. Pull day tonight at 6 PM — back and biceps." },
  { icon: "📬", text: "3 urgent emails need replies. 2 are from recruiters — ignore. 1 is from your manager." },
];

const BIAS_C: Record<string, string> = { L: "#f43f5e", "C-L": "#f97316", C: "#10b981", "C-R": "#06b6d4", R: "#8b5cf6" };
const TAG_C:  Record<string, string> = { Finance: "#06b6d4", AI: "#8b5cf6", Crypto: "#f97316", FSU: "#10b981", Local: "#06b6d4" };

export default function Dashboard() {
  const [time, setTime]       = useState(new Date());
  const [crypto, setCrypto]   = useState<LiveCrypto[]>([]);
  const [weather, setWeather] = useState<LiveWeather | null>(null);
  const [news, setNews]       = useState<{ title: string; source: string; bias: string; tag: string; link: string }[]>([]);
  const [dataAge, setDataAge] = useState<string>("");

  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);

  // Fetch live data on mount
  useEffect(() => {
    fetch("/api/crypto")
      .then(r => r.json())
      .then(j => { if (j.data) setCrypto(j.data); })
      .catch(() => {});

    fetch("/api/weather?location=orlando")
      .then(r => r.json())
      .then(j => { if (j.data) setWeather(j.data); })
      .catch(() => {});

    fetch("/api/news?count=5")
      .then(r => r.json())
      .then(j => { if (j.data) setNews(j.data); })
      .catch(() => {});

    setDataAge(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }));
  }, []);

  const btc = crypto.find(c => c.symbol === "BTC");
  const xrp = crypto.find(c => c.symbol === "XRP");

  const h = time.getHours();
  const greeting = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  const dayLabel  = time.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const timeStr   = time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const habitsDone = HABITS.filter(h => h.done).length;
  const C = 2 * Math.PI * 26;
  const dash = C - (habitsDone / HABITS.length) * C;

  return (
    <div className="grid-bg scan-bg min-h-screen" style={{ padding: "40px 48px" }}>

      {/* ── HEADER ── */}
      <div className="flex items-start justify-between mb-8 afu">
        <div>
          <p className="text-sm font-medium tracking-widest uppercase mb-2" style={{ color: "var(--teal)", opacity: .6 }}>
            {dayLabel}
          </p>
          <h1 className="text-4xl font-black tracking-tight mb-2 grad-text">
            {greeting}, Max.
          </h1>
          <div className="flex items-center gap-4 text-sm" style={{ color: "var(--t2)" }}>
            <span>{habitsDone}/{HABITS.length} habits done</span>
            <span style={{ color: "var(--t3)" }}>·</span>
            <span>{EVENTS.length} events today</span>
            <span style={{ color: "var(--t3)" }}>·</span>
            <span style={{ color: "#10b981" }}>BTC +3.24%</span>
          </div>
        </div>
        <div className="text-right afu d2">
          <div className="font-mono text-4xl font-black tabular-nums" style={{ color: "var(--t1)" }}>{timeStr}</div>
          <div className="flex items-center gap-2 justify-end mt-2">
            <span className="w-2 h-2 rounded-full" style={{ background: "var(--green)", boxShadow: "0 0 8px var(--green)", animation: "pulse-dot 2s ease-in-out infinite", color: "var(--green)" }} />
            <span className="text-sm font-semibold" style={{ color: "var(--green)" }}>M.A.X. ONLINE</span>
          </div>
        </div>
      </div>

      {/* ── STAT CARDS ── */}
      <div className="grid grid-cols-4 gap-4 mb-6">

        {/* Weather */}
        <HudCard className="p-6" delay={.05}>
          <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: "var(--t3)" }}>Orlando Weather</p>
          {weather ? (
            <>
              <div className="flex items-end gap-3 mb-3">
                <span className="text-5xl font-black leading-none" style={{ color: "var(--orange)" }}>{weather.tempF}°</span>
                <span className="text-base font-medium mb-1" style={{ color: "var(--t2)" }}>{weather.condition}</span>
              </div>
              <div className="flex gap-4 text-sm" style={{ color: "var(--t3)" }}>
                <span>Rain {weather.precipChance}%</span>
                <span>Wind {weather.windMph}mph</span>
                <span>Feels {weather.feelsLikeF}°</span>
              </div>
            </>
          ) : (
            <div className="text-2xl font-black animate-pulse" style={{ color: "var(--t3)" }}>Loading…</div>
          )}
        </HudCard>

        {/* Portfolio */}
        <HudCard className="p-6" delay={.1}>
          <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: "var(--t3)" }}>Portfolio</p>
          <div className="flex items-end justify-between mb-2">
            <span className="text-5xl font-black leading-none" style={{ color: "var(--t1)" }}>$6,320</span>
            <span className="text-lg font-bold" style={{ color: "var(--green)" }}>+1.18%</span>
          </div>
          <Sparkline data={PORT_DATA} color="#10b981" height={36} id="port-stat" />
        </HudCard>

        {/* Habits ring */}
        <HudCard className="p-6" delay={.15}>
          <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: "var(--t3)" }}>Habits Today</p>
          <div className="flex items-center gap-5">
            <svg width="64" height="64" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(6,182,212,0.08)" strokeWidth="5" />
              <circle cx="32" cy="32" r="26" fill="none" stroke="var(--teal)" strokeWidth="5"
                strokeDasharray={C} strokeDashoffset={dash} strokeLinecap="round" transform="rotate(-90 32 32)"
                style={{ filter: "drop-shadow(0 0 8px rgba(6,182,212,.5))", transition: "stroke-dashoffset .6s ease" }} />
              <text x="32" y="36" textAnchor="middle" fontSize="15" fontWeight="900" fill="var(--t1)">{habitsDone}/{HABITS.length}</text>
            </svg>
            <div>
              <div className="text-3xl font-black" style={{ color: "var(--t1)" }}>{Math.round((habitsDone / HABITS.length) * 100)}%</div>
              <div className="text-sm mt-1" style={{ color: "var(--orange)" }}>🔥 12-day streak</div>
            </div>
          </div>
        </HudCard>

        {/* Inbox */}
        <HudCard className="p-6" delay={.2}>
          <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: "var(--t3)" }}>Inbox</p>
          <div className="text-5xl font-black leading-none mb-2" style={{ color: "#f43f5e" }}>3</div>
          <div className="text-base font-semibold mb-1" style={{ color: "#f43f5e" }}>Urgent — reply today</div>
          <div className="text-sm" style={{ color: "var(--t3)" }}>12 total · 4 need a response</div>
        </HudCard>
      </div>

      {/* ── MAIN GRID ── */}
      <div className="grid grid-cols-3 gap-5">

        {/* ── LEFT 2 COLS ── */}
        <div className="col-span-2 flex flex-col gap-5">

          {/* M.A.X. Daily Brief */}
          <HudCard className="p-6" delay={.22}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold" style={{ color: "var(--t1)" }}>M.A.X. Daily Brief</h2>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ background: "rgba(6,182,212,0.08)", color: "var(--teal)", border: "1px solid rgba(6,182,212,0.15)" }}>
                AI Generated
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {BRIEF.map((b, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3.5 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(6,182,212,0.07)" }}>
                  <span className="text-xl flex-shrink-0">{b.icon}</span>
                  <span className="text-sm leading-relaxed" style={{ color: "var(--t2)" }}>{b.text}</span>
                </div>
              ))}
            </div>
          </HudCard>

          {/* Today's Mission */}
          <HudCard className="p-6" delay={.26}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold" style={{ color: "var(--t1)" }}>Today&apos;s Mission</h2>
              <span className="text-sm" style={{ color: "var(--t3)" }}>Sunday · {EVENTS.length} events</span>
            </div>
            <div className="relative">
              <div className="absolute left-[68px] top-3 bottom-3 w-px" style={{ background: "rgba(6,182,212,0.08)" }} />
              <div className="space-y-2">
                {EVENTS.map((ev, i) => (
                  <div key={i} className="flex items-center gap-4 group">
                    <span className="text-sm font-mono w-16 text-right flex-shrink-0 font-medium" style={{ color: "var(--t3)" }}>
                      {ev.time.split(" ")[0]}
                    </span>
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 z-10"
                      style={{
                        background: ev.type === "Health" ? "var(--green)" : "var(--teal)",
                        boxShadow: `0 0 10px ${ev.type === "Health" ? "var(--green)" : "var(--teal)"}`
                      }} />
                    <div className="flex-1 flex items-center justify-between px-4 py-3.5 rounded-xl transition-colors duration-150 group-hover:bg-white/[0.025]"
                      style={{ border: "1px solid rgba(6,182,212,0.06)" }}>
                      <div>
                        <div className="text-base font-semibold" style={{ color: "var(--t1)" }}>{ev.title}</div>
                        <div className="text-sm mt-0.5" style={{ color: "var(--t3)" }}>{ev.duration}</div>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full ml-4"
                        style={{
                          background: ev.type === "Health" ? "rgba(16,185,129,0.1)" : "rgba(6,182,212,0.08)",
                          color: ev.type === "Health" ? "var(--green)" : "var(--teal)",
                        }}>
                        {ev.type}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </HudCard>

          {/* Intel Feed */}
          <HudCard className="p-6" delay={.3}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold" style={{ color: "var(--t1)" }}>Intel Feed</h2>
              <div className="flex items-center gap-2 text-sm" style={{ color: "var(--t3)" }}>
                <span className="w-2 h-2 rounded-full" style={{ background: "var(--green)", animation: "pulse-dot 2s ease-in-out infinite", color: "var(--green)" }} />
                Bias labeled
              </div>
            </div>
            <div className="space-y-2">
              {(news.length ? news : NEWS).map((n, i) => (
                <a key={i} href={"link" in n ? (n as {link: string}).link : "#"} target="_blank" rel="noopener noreferrer"
                  className="flex items-start gap-4 px-4 py-4 rounded-xl cursor-pointer transition-all duration-150 hover:bg-white/[0.025] group"
                  style={{ border: "1px solid rgba(6,182,212,0.06)", display: "flex", textDecoration: "none" }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-medium leading-snug mb-2.5" style={{ color: "var(--t1)" }}>
                      {n.title}
                    </p>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-sm font-medium" style={{ color: "var(--t3)" }}>{n.source}</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded"
                        style={{ background: `${TAG_C[n.tag] || "var(--teal)"}12`, color: TAG_C[n.tag] || "var(--teal)" }}>
                        {n.tag}
                      </span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded"
                        style={{ background: `${BIAS_C[n.bias]}12`, color: BIAS_C[n.bias] }}>
                        {n.bias}
                      </span>
                    </div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    className="flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: "var(--teal)" }}>
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </a>
              ))}
            </div>
          </HudCard>
        </div>

        {/* ── RIGHT COL ── */}
        <div className="flex flex-col gap-5">

          {/* Crypto */}
          <HudCard className="p-6" delay={.2}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold" style={{ color: "var(--t1)" }}>Crypto</h2>
              <div className="flex items-center gap-1.5 text-sm" style={{ color: "var(--t3)" }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--green)", animation: "pulse-dot 2s ease-in-out infinite", color: "var(--green)" }} />
                Live
              </div>
            </div>
            {[
              {
                symbol: "BTC", name: "Bitcoin", color: "#f97316", hold: "0.02 BTC",
                price:  btc ? `$${btc.price.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "...",
                change: btc ? `${btc.change24h >= 0 ? "+" : ""}${btc.change24h.toFixed(2)}%` : "...",
                val:    btc ? `$${(btc.price * 0.02).toFixed(2)}` : "...",
                data:   btc?.sparkline?.length ? btc.sparkline.slice(-20) : BTC_FALLBACK,
                isUp:   (btc?.change24h ?? 0) >= 0,
              },
              {
                symbol: "XRP", name: "Ripple", color: "#06b6d4", hold: "200 XRP",
                price:  xrp ? `$${xrp.price.toFixed(4)}` : "...",
                change: xrp ? `${xrp.change24h >= 0 ? "+" : ""}${xrp.change24h.toFixed(2)}%` : "...",
                val:    xrp ? `$${(xrp.price * 200).toFixed(2)}` : "...",
                data:   xrp?.sparkline?.length ? xrp.sparkline.slice(-20) : XRP_FALLBACK,
                isUp:   (xrp?.change24h ?? 0) >= 0,
              },
            ].map(a => (
              <div key={a.symbol} className="mb-5 last:mb-0">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-base font-bold" style={{ color: "var(--t1)" }}>{a.symbol}
                      <span className="text-sm font-normal ml-2" style={{ color: "var(--t3)" }}>{a.name}</span>
                    </div>
                    <div className="text-sm mt-0.5" style={{ color: "var(--t3)" }}>{a.hold} · {a.val}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-bold font-mono" style={{ color: "var(--t1)" }}>{a.price}</div>
                    <div className="text-sm font-bold" style={{ color: a.isUp ? "var(--green)" : "var(--red)" }}>
                      {a.change}
                    </div>
                  </div>
                </div>
                <Sparkline data={a.data} color={a.color} height={38} id={`d-${a.symbol}`} />
              </div>
            ))}
          </HudCard>

          {/* Habits */}
          <HudCard className="p-6" delay={.25}>
            <h2 className="text-lg font-bold mb-5" style={{ color: "var(--t1)" }}>Habits</h2>
            <div className="space-y-2.5">
              {HABITS.map((h, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3.5 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(6,182,212,0.07)" }}>
                  <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                    style={{
                      background: h.done ? "rgba(16,185,129,0.15)" : "rgba(6,182,212,0.04)",
                      border: `1.5px solid ${h.done ? "rgba(16,185,129,0.5)" : "rgba(6,182,212,0.1)"}`,
                      boxShadow: h.done ? "0 0 8px rgba(16,185,129,0.3)" : "none"
                    }}>
                    {h.done && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm font-medium flex-1" style={{ color: h.done ? "var(--t1)" : "var(--t2)" }}>
                    {h.label}
                  </span>
                  {h.streak > 0 && (
                    <span className="text-sm font-bold" style={{ color: "var(--orange)" }}>🔥{h.streak}</span>
                  )}
                </div>
              ))}
            </div>
          </HudCard>

          {/* Goals */}
          <HudCard className="p-6" delay={.3}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold" style={{ color: "var(--t1)" }}>Goal Pulse</h2>
              <a href="/dashboard/goals" className="text-sm font-medium" style={{ color: "var(--teal)" }}>View all →</a>
            </div>
            <div className="space-y-5">
              {[
                { label: "$100K Income", pct: 0,  color: "var(--green)",  note: "Starts July" },
                { label: "Emergency Fund", pct: 28, color: "var(--purple)", note: "$2.8K / $10K" },
                { label: "Gym Streak",  pct: 65, color: "var(--teal)",  note: "12 weeks in" },
              ].map(g => (
                <div key={g.label}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-sm font-semibold" style={{ color: "var(--t1)" }}>{g.label}</span>
                      <span className="text-xs ml-2" style={{ color: "var(--t3)" }}>{g.note}</span>
                    </div>
                    <span className="text-sm font-bold font-mono" style={{ color: g.color }}>{g.pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: "rgba(6,182,212,0.07)" }}>
                    <div className="h-1.5 rounded-full transition-all duration-1000"
                      style={{ width: `${g.pct || 1}%`, background: g.color, boxShadow: `0 0 8px ${g.color}60` }} />
                  </div>
                </div>
              ))}
            </div>
          </HudCard>
        </div>
      </div>

      {/* ── M.A.X. STATUS BAR ── */}
      <HudCard className="mt-5 px-6 py-4" delay={.35} noAnim={false}>
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.2)" }}>
            <span className="text-sm font-black" style={{ color: "var(--teal)" }}>M</span>
          </div>
          <p className="text-base flex-1" style={{ color: "var(--t2)" }}>
            <span style={{ color: "var(--teal)", fontWeight: 700 }}>M.A.X. · </span>
            BTC up 3.2% overnight, holding above $94K. Your Roth IRA is stable. Client call at 11 AM — review Northside notes first.
            Next briefing at <span style={{ color: "var(--t1)", fontWeight: 600 }}>7:00 AM tomorrow</span>.
          </p>
          <a href="/dashboard/chat"
            className="flex-shrink-0 flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl transition-all hover:opacity-80"
            style={{ background: "rgba(6,182,212,0.1)", color: "var(--teal)", border: "1px solid rgba(6,182,212,0.15)" }}>
            Talk to M.A.X.
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      </HudCard>
    </div>
  );
}
