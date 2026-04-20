"use client";

import { useState, useEffect } from "react";
import { HudCard } from "@/components/ui/HudCard";
import { Sparkline } from "@/components/ui/Sparkline";

const PORT_DATA = [5620, 5750, 6100, 5890, 6030, 6220, 6320];
const BTC_FALLBACK = [88200, 89100, 91400, 90800, 92300, 93100, 94210];
const XRP_FALLBACK = [2.31, 2.18, 2.25, 2.09, 2.14, 2.29, 2.18];

interface LiveCrypto { symbol: string; price: number; change24h: number; change7d: number; sparkline?: number[] }
interface LiveWeather { tempF: number; condition: string; precipChance: number; windMph: number; feelsLikeF: number; forecast?: { day: string; high: number; low: number }[] }
interface NewsItem { title: string; source: string; bias: string; tag: string; link: string }

const EVENTS = [
  { time: "9:00 AM",  title: "Team standup",                    duration: "30 min",  type: "Work"   },
  { time: "11:00 AM", title: "Client call — Northside Staffing", duration: "1 hr",    type: "Work"   },
  { time: "2:00 PM",  title: "Review Q2 pipeline",              duration: "45 min",  type: "Work"   },
  { time: "6:00 PM",  title: "Gym — Pull Day",                  duration: "1 hr",    type: "Health" },
];

const HABITS = [
  { label: "Up by 7:30 AM", done: true,  streak: 4  },
  { label: "Gym",           done: true,  streak: 12 },
  { label: "Read / Learn",  done: false, streak: 3  },
  { label: "Protein goal",  done: false, streak: 0  },
];

const NEWS_FALLBACK: NewsItem[] = [
  { title: "Fed holds rates — implications for crypto ETF approvals this quarter", source: "Bloomberg", bias: "C",   tag: "Finance", link: "#" },
  { title: "OpenAI launches GPT-5 with breakthrough reasoning capabilities",       source: "The Verge", bias: "C-L", tag: "AI",      link: "#" },
  { title: "XRP ETF approval odds climb to 72% on Polymarket amid SEC signals",   source: "CoinDesk",  bias: "C",   tag: "Crypto",  link: "#" },
  { title: "Florida unemployment hits 3.1% — staffing sector hiring up 8%",       source: "Sun Sentinel", bias: "C", tag: "Local",  link: "#" },
  { title: "Apple unveils Vision Pro 2 with spatial computing breakthrough",       source: "TechCrunch", bias: "C-L", tag: "Tech",   link: "#" },
];

const ALL_TAGS = ["All", "Breaking", "Finance", "Crypto", "AI", "Tech", "Local", "Politics"];
const BIAS_C: Record<string, string> = { L: "#f43f5e", "C-L": "#f97316", C: "#10b981", "C-R": "#06b6d4", R: "#8b5cf6" };

export default function Dashboard() {
  const [time, setTime]         = useState(new Date());
  const [crypto, setCrypto]     = useState<LiveCrypto[]>([]);
  const [weather, setWeather]   = useState<LiveWeather | null>(null);
  const [news, setNews]         = useState<NewsItem[]>([]);
  const [activeTag, setActiveTag] = useState("All");

  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);

  useEffect(() => {
    fetch("/api/crypto").then(r => r.json()).then(j => { if (j.data) setCrypto(j.data); }).catch(() => {});
    fetch("/api/weather?location=orlando").then(r => r.json()).then(j => { if (j.data) setWeather(j.data); }).catch(() => {});
    fetch("/api/news?count=20").then(r => r.json()).then(j => { if (j.data) setNews(j.data); }).catch(() => {});
  }, []);

  const btc = crypto.find(c => c.symbol === "BTC");
  const xrp = crypto.find(c => c.symbol === "XRP");

  const h = time.getHours();
  const greeting   = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  const dayLabel   = time.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const timeStr    = time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const habitsDone = HABITS.filter(h => h.done).length;
  const C          = 2 * Math.PI * 26;
  const dash       = C - (habitsDone / HABITS.length) * C;

  const displayNews = (news.length ? news : NEWS_FALLBACK).filter(n =>
    activeTag === "All" || activeTag === "Breaking" ? true : n.tag === activeTag
  );

  const CRYPTO_CARDS = [
    {
      symbol: "BTC", name: "Bitcoin", color: "#10b981", hold: "0.02 BTC",
      price:  btc ? `$${btc.price.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "—",
      change: btc ? `${btc.change24h >= 0 ? "+" : ""}${btc.change24h.toFixed(2)}%` : "—",
      val:    btc ? `$${(btc.price * 0.02).toFixed(2)}` : "—",
      data:   btc?.sparkline?.length ? btc.sparkline.slice(-20) : BTC_FALLBACK,
      isUp:   (btc?.change24h ?? 0) >= 0,
    },
    {
      symbol: "XRP", name: "Ripple", color: "#10b981", hold: "200 XRP",
      price:  xrp ? `$${xrp.price.toFixed(4)}` : "—",
      change: xrp ? `${xrp.change24h >= 0 ? "+" : ""}${xrp.change24h.toFixed(2)}%` : "—",
      val:    xrp ? `$${(xrp.price * 200).toFixed(2)}` : "—",
      data:   xrp?.sparkline?.length ? xrp.sparkline.slice(-20) : XRP_FALLBACK,
      isUp:   (xrp?.change24h ?? 0) >= 0,
    },
  ];

  return (
    <div className="min-h-screen" style={{ padding: "36px 48px", background: "var(--bg)" }}>

      {/* ── HEADER ── */}
      <div className="flex items-start justify-between mb-8 afu">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: "rgba(6,182,212,0.4)", letterSpacing: "0.18em" }}>
            {dayLabel}
          </p>
          <h1 className="text-4xl font-black tracking-tight mb-3" style={{ color: "var(--t1)", letterSpacing: "-0.02em" }}>
            {greeting}, Max.
          </h1>
          <div className="flex items-center gap-5 text-sm">
            <span style={{ color: "var(--t3)" }}>{habitsDone}/{HABITS.length} habits</span>
            <span style={{ color: "rgba(6,182,212,0.15)" }}>|</span>
            <span style={{ color: "var(--t3)" }}>{EVENTS.length} events today</span>
            <span style={{ color: "rgba(6,182,212,0.15)" }}>|</span>
            <span style={{ color: btc && btc.change24h >= 0 ? "#10b981" : "#f43f5e" }}>
              BTC {btc ? `${btc.change24h >= 0 ? "+" : ""}${btc.change24h.toFixed(2)}%` : "—"}
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-4xl font-black tabular-nums" style={{ color: "var(--t1)", letterSpacing: "-0.02em" }}>{timeStr}</div>
          <div className="flex items-center gap-2 justify-end mt-2">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#10b981", boxShadow: "0 0 6px #10b981", animation: "pulse-dot 2s ease-in-out infinite" }} />
            <span className="text-xs font-semibold tracking-widest" style={{ color: "#10b981", letterSpacing: "0.12em" }}>M.A.X. ONLINE</span>
          </div>
        </div>
      </div>

      {/* ── STAT ROW ── */}
      <div className="grid grid-cols-4 gap-4 mb-6">

        {/* Weather */}
        <HudCard className="p-5" delay={.05}>
          <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: "var(--t3)", letterSpacing: "0.14em" }}>Orlando</p>
          {weather ? (
            <>
              <div className="flex items-end gap-2 mb-2">
                <span className="text-5xl font-black leading-none" style={{ color: "var(--t1)" }}>{weather.tempF}°</span>
                <span className="text-sm font-medium mb-1.5" style={{ color: "var(--t2)" }}>{weather.condition}</span>
              </div>
              <div className="flex gap-3 text-xs" style={{ color: "var(--t3)" }}>
                <span>Rain {weather.precipChance}%</span>
                <span>·</span>
                <span>Wind {weather.windMph}mph</span>
                <span>·</span>
                <span>Feels {weather.feelsLikeF}°</span>
              </div>
            </>
          ) : (
            <div className="text-2xl font-black animate-pulse" style={{ color: "var(--t3)" }}>—</div>
          )}
        </HudCard>

        {/* Portfolio */}
        <HudCard className="p-5" delay={.1}>
          <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: "var(--t3)", letterSpacing: "0.14em" }}>Portfolio</p>
          <div className="flex items-end justify-between mb-2">
            <span className="text-4xl font-black leading-none" style={{ color: "var(--t1)" }}>$6,320</span>
            <span className="text-base font-bold" style={{ color: "#10b981" }}>+1.18%</span>
          </div>
          <Sparkline data={PORT_DATA} color="#10b981" height={32} id="port-stat" />
        </HudCard>

        {/* Habits */}
        <HudCard className="p-5" delay={.15}>
          <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: "var(--t3)", letterSpacing: "0.14em" }}>Habits Today</p>
          <div className="flex items-center gap-4">
            <svg width="58" height="58" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(6,182,212,0.06)" strokeWidth="5" />
              <circle cx="32" cy="32" r="26" fill="none" stroke="var(--teal)" strokeWidth="5"
                strokeDasharray={C} strokeDashoffset={dash} strokeLinecap="round" transform="rotate(-90 32 32)"
                style={{ filter: "drop-shadow(0 0 6px rgba(6,182,212,.4))", transition: "stroke-dashoffset .6s ease" }} />
              <text x="32" y="36" textAnchor="middle" fontSize="14" fontWeight="900" fill="var(--t1)">{habitsDone}/{HABITS.length}</text>
            </svg>
            <div>
              <div className="text-3xl font-black" style={{ color: "var(--t1)" }}>{Math.round((habitsDone / HABITS.length) * 100)}%</div>
              <div className="text-xs mt-1 font-semibold" style={{ color: "var(--orange)" }}>🔥 12-day streak</div>
            </div>
          </div>
        </HudCard>

        {/* Inbox */}
        <HudCard className="p-5" delay={.2}>
          <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: "var(--t3)", letterSpacing: "0.14em" }}>Inbox</p>
          <div className="text-5xl font-black leading-none mb-2" style={{ color: "#f43f5e" }}>3</div>
          <div className="text-sm font-semibold" style={{ color: "#f43f5e" }}>Urgent · reply today</div>
          <div className="text-xs mt-1" style={{ color: "var(--t3)" }}>12 total · 4 need response</div>
        </HudCard>
      </div>

      {/* ── MAIN GRID ── */}
      <div className="grid gap-5" style={{ gridTemplateColumns: "1fr 1fr 320px" }}>

        {/* ── COL 1 ── */}
        <div className="flex flex-col gap-5">

          {/* Calendar / Today's Mission */}
          <HudCard className="p-6" delay={.22}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.15)" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                </div>
                <h2 className="text-base font-bold" style={{ color: "var(--t1)" }}>Today&apos;s Schedule</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: "rgba(6,182,212,0.06)", color: "var(--teal)", border: "1px solid rgba(6,182,212,0.12)" }}>
                  {EVENTS.length} events
                </span>
                <span className="text-xs" style={{ color: "var(--t3)" }}>
                  {time.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              {EVENTS.map((ev, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl group"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(6,182,212,0.06)" }}>
                  <span className="text-xs font-mono w-14 text-right flex-shrink-0" style={{ color: "var(--t3)" }}>
                    {ev.time.replace(" AM","a").replace(" PM","p")}
                  </span>
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: ev.type === "Health" ? "#10b981" : "var(--teal)" }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate" style={{ color: "var(--t1)" }}>{ev.title}</div>
                    <div className="text-xs" style={{ color: "var(--t3)" }}>{ev.duration}</div>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded flex-shrink-0"
                    style={{
                      background: ev.type === "Health" ? "rgba(16,185,129,0.08)" : "rgba(6,182,212,0.06)",
                      color: ev.type === "Health" ? "#10b981" : "var(--teal)",
                    }}>
                    {ev.type}
                  </span>
                </div>
              ))}
            </div>
          </HudCard>

          {/* Goal Pulse */}
          <HudCard className="p-6" delay={.26}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold" style={{ color: "var(--t1)" }}>Goal Pulse</h2>
              <a href="/dashboard/goals" className="text-xs font-semibold" style={{ color: "var(--teal)" }}>View all →</a>
            </div>
            <div className="space-y-5">
              {[
                { label: "$100K Income",    pct: 0,  note: "Starts July 2026" },
                { label: "Emergency Fund",  pct: 28, note: "$2.8K / $10K" },
                { label: "Gym Streak",      pct: 65, note: "12 weeks in" },
              ].map(g => (
                <div key={g.label}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-sm font-semibold" style={{ color: "var(--t1)" }}>{g.label}</span>
                      <span className="text-xs ml-2" style={{ color: "var(--t3)" }}>{g.note}</span>
                    </div>
                    <span className="text-sm font-bold font-mono" style={{ color: g.pct > 0 ? "#10b981" : "var(--t3)" }}>{g.pct}%</span>
                  </div>
                  <div className="h-1 rounded-full" style={{ background: "rgba(255,255,255,0.04)" }}>
                    <div className="h-1 rounded-full transition-all duration-1000"
                      style={{ width: `${g.pct || 1}%`, background: "#10b981", boxShadow: g.pct > 0 ? "0 0 6px rgba(16,185,129,0.5)" : "none" }} />
                  </div>
                </div>
              ))}
            </div>
          </HudCard>

          {/* Habits */}
          <HudCard className="p-6" delay={.3}>
            <h2 className="text-base font-bold mb-4" style={{ color: "var(--t1)" }}>Habits</h2>
            <div className="space-y-2">
              {HABITS.map((h, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(6,182,212,0.06)" }}>
                  <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                    style={{
                      background: h.done ? "rgba(16,185,129,0.12)" : "transparent",
                      border: `1px solid ${h.done ? "rgba(16,185,129,0.4)" : "rgba(6,182,212,0.12)"}`,
                    }}>
                    {h.done && (
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm flex-1" style={{ color: h.done ? "var(--t1)" : "var(--t3)" }}>{h.label}</span>
                  {h.streak > 0 && <span className="text-xs font-bold" style={{ color: "var(--orange)" }}>🔥{h.streak}</span>}
                </div>
              ))}
            </div>
          </HudCard>
        </div>

        {/* ── COL 2 — NEWS ── */}
        <div className="flex flex-col gap-5">
          <HudCard className="p-6 flex-1" delay={.24}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.15)" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2">
                    <path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/>
                  </svg>
                </div>
                <h2 className="text-base font-bold" style={{ color: "var(--t1)" }}>Intel Feed</h2>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#10b981", animation: "pulse-dot 2s ease-in-out infinite" }} />
                <span className="text-xs" style={{ color: "var(--t3)" }}>Live</span>
              </div>
            </div>

            {/* Filters */}
            <div className="flex gap-1.5 flex-wrap mb-4">
              {ALL_TAGS.map(tag => (
                <button key={tag} onClick={() => setActiveTag(tag)}
                  className="text-xs font-semibold px-2.5 py-1 rounded-full transition-all"
                  style={{
                    background: activeTag === tag ? "rgba(6,182,212,0.15)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${activeTag === tag ? "rgba(6,182,212,0.35)" : "rgba(6,182,212,0.08)"}`,
                    color: activeTag === tag ? "var(--teal)" : "var(--t3)",
                  }}>
                  {tag === "Breaking" ? "🔴 Breaking" : tag}
                </button>
              ))}
            </div>

            {/* Articles */}
            <div className="space-y-1">
              {displayNews.slice(0, 8).map((n, i) => (
                <a key={i} href={n.link} target="_blank" rel="noopener noreferrer"
                  className="flex items-start gap-3 px-4 py-3.5 rounded-xl group transition-colors"
                  style={{ border: "1px solid rgba(6,182,212,0.05)", display: "flex", textDecoration: "none", background: "rgba(255,255,255,0.01)" }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-snug mb-2" style={{ color: "var(--t1)" }}>{n.title}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs" style={{ color: "var(--t3)" }}>{n.source}</span>
                      <span className="text-xs font-semibold px-1.5 py-0.5 rounded"
                        style={{ background: "rgba(6,182,212,0.07)", color: "var(--teal)" }}>
                        {n.tag}
                      </span>
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded"
                        style={{ background: `${BIAS_C[n.bias] || "#999"}15`, color: BIAS_C[n.bias] || "#999" }}>
                        {n.bias}
                      </span>
                    </div>
                  </div>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    className="flex-shrink-0 mt-1 opacity-0 group-hover:opacity-40 transition-opacity"
                    style={{ color: "var(--teal)" }}>
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </a>
              ))}
              {displayNews.length === 0 && (
                <div className="text-sm text-center py-8" style={{ color: "var(--t3)" }}>No articles in this category.</div>
              )}
            </div>
          </HudCard>
        </div>

        {/* ── COL 3 — CRYPTO + STATUS ── */}
        <div className="flex flex-col gap-5">

          {/* Crypto */}
          <HudCard className="p-6" delay={.2}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold" style={{ color: "var(--t1)" }}>Crypto</h2>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#10b981", animation: "pulse-dot 2s ease-in-out infinite" }} />
                <span className="text-xs" style={{ color: "var(--t3)" }}>Live</span>
              </div>
            </div>
            {CRYPTO_CARDS.map(a => (
              <div key={a.symbol} className="mb-5 last:mb-0">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-sm font-bold" style={{ color: "var(--t1)" }}>{a.symbol}
                      <span className="text-xs font-normal ml-1.5" style={{ color: "var(--t3)" }}>{a.name}</span>
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--t3)" }}>{a.hold} · {a.val}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold font-mono" style={{ color: "var(--t1)" }}>{a.price}</div>
                    <div className="text-xs font-bold" style={{ color: a.isUp ? "#10b981" : "#f43f5e" }}>{a.change}</div>
                  </div>
                </div>
                <Sparkline data={a.data} color="#10b981" height={36} id={`d-${a.symbol}`} />
              </div>
            ))}
          </HudCard>

          {/* M.A.X. Brief */}
          <HudCard className="p-6" delay={.28}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.2)" }}>
                <span className="text-xs font-black" style={{ color: "var(--teal)" }}>M</span>
              </div>
              <span className="text-sm font-bold" style={{ color: "var(--t1)" }}>M.A.X. Brief</span>
            </div>
            <div className="space-y-3">
              {[
                { icon: "📈", text: "BTC holding above key support. XRP ETF odds rising — watch CoinDesk." },
                { icon: "📅", text: "Client call at 11 AM is your highest-leverage event today." },
                { icon: "💪", text: "Gym streak at 12. Pull day tonight — don't skip." },
                { icon: "📬", text: "3 urgent emails. Reply before the client call." },
              ].map((b, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="text-base flex-shrink-0">{b.icon}</span>
                  <span className="text-xs leading-relaxed" style={{ color: "var(--t2)" }}>{b.text}</span>
                </div>
              ))}
            </div>
            <a href="/dashboard/chat" className="flex items-center justify-center gap-2 w-full mt-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
              style={{ background: "rgba(6,182,212,0.08)", color: "var(--teal)", border: "1px solid rgba(6,182,212,0.15)" }}>
              Talk to M.A.X.
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </a>
          </HudCard>
        </div>
      </div>
    </div>
  );
}
