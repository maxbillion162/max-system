"use client";

import { useState, useEffect } from "react";
import { HudCard } from "@/components/ui/HudCard";
import { Sparkline } from "@/components/ui/Sparkline";

const PORT_DATA    = [5620, 5750, 6100, 5890, 6030, 6220, 6320];
const BTC_FALLBACK = [88200, 89100, 91400, 90800, 92300, 93100, 94210];
const XRP_FALLBACK = [2.31, 2.18, 2.25, 2.09, 2.14, 2.29, 2.18];

interface LiveCrypto { symbol: string; price: number; change24h: number; change7d: number; sparkline?: number[] }
interface LiveWeather { tempF: number; condition: string; precipChance: number; windMph: number; feelsLikeF: number; forecast?: { day: string; high: number; low: number }[] }
interface NewsItem    { title: string; source: string; bias: string; tag: string; link: string }

const EVENTS = [
  { time: "9:00 AM",  title: "Team standup",                    duration: "30 min", type: "Work"   },
  { time: "11:00 AM", title: "Client call — Northside Staffing", duration: "1 hr",   type: "Work"   },
  { time: "2:00 PM",  title: "Review Q2 pipeline",              duration: "45 min", type: "Work"   },
  { time: "6:00 PM",  title: "Gym — Pull Day",                  duration: "1 hr",   type: "Health" },
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
  { title: "Senate passes budget bill with crypto provision attached",             source: "Reuters",   bias: "C",   tag: "Finance", link: "#" },
];

const ALL_TAGS  = ["All", "Breaking", "Finance", "Crypto", "AI", "Tech", "Local", "Politics"];
const BIAS_COLOR: Record<string, string> = {
  L: "#ef4444", "C-L": "#f59e0b", C: "#22c55e", "C-R": "#4589ff", R: "#a78bfa",
};

/* Label */
function Label({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--t3)", marginBottom: 16 }}>
      {children}
    </p>
  );
}

/* Section divider */
function Divider() {
  return <div style={{ height: 1, background: "var(--border)", margin: "0 0 16px" }} />;
}

export default function Dashboard() {
  const [time, setTime]           = useState(new Date());
  const [crypto, setCrypto]       = useState<LiveCrypto[]>([]);
  const [weather, setWeather]     = useState<LiveWeather | null>(null);
  const [news, setNews]           = useState<NewsItem[]>([]);
  const [activeTag, setActiveTag] = useState("All");

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    fetch("/api/crypto").then(r => r.json()).then(j => { if (j.data) setCrypto(j.data); }).catch(() => {});
    fetch("/api/weather?location=orlando").then(r => r.json()).then(j => { if (j.data) setWeather(j.data); }).catch(() => {});
    fetch("/api/news?count=20").then(r => r.json()).then(j => { if (j.data) setNews(j.data); }).catch(() => {});
  }, []);

  const btc = crypto.find(c => c.symbol === "BTC");
  const xrp = crypto.find(c => c.symbol === "XRP");

  const h        = time.getHours();
  const greeting = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  const dayLabel = time.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const timeStr  = time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const habitsDone = HABITS.filter(h => h.done).length;
  const C    = 2 * Math.PI * 22;
  const dash = C - (habitsDone / HABITS.length) * C;

  const displayNews = (news.length ? news : NEWS_FALLBACK).filter(n =>
    activeTag === "All" || activeTag === "Breaking" ? true : n.tag === activeTag
  );

  const CRYPTO_ROWS = [
    {
      symbol: "BTC", name: "Bitcoin", hold: "0.02 BTC",
      price:  btc ? `$${btc.price.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "—",
      change: btc ? `${btc.change24h >= 0 ? "+" : ""}${btc.change24h.toFixed(2)}%` : "—",
      val:    btc ? `$${(btc.price * 0.02).toFixed(2)}` : "—",
      data:   btc?.sparkline?.length ? btc.sparkline.slice(-20) : BTC_FALLBACK,
      isUp:   (btc?.change24h ?? 0) >= 0,
    },
    {
      symbol: "XRP", name: "Ripple", hold: "200 XRP",
      price:  xrp ? `$${xrp.price.toFixed(4)}` : "—",
      change: xrp ? `${xrp.change24h >= 0 ? "+" : ""}${xrp.change24h.toFixed(2)}%` : "—",
      val:    xrp ? `$${(xrp.price * 200).toFixed(2)}` : "—",
      data:   xrp?.sparkline?.length ? xrp.sparkline.slice(-20) : XRP_FALLBACK,
      isUp:   (xrp?.change24h ?? 0) >= 0,
    },
  ];

  return (
    <div style={{ padding: "32px 40px", background: "var(--bg)", minHeight: "100vh" }}>

      {/* ── HEADER ── */}
      <div className="afu" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--t3)", marginBottom: 8 }}>
            {dayLabel}
          </p>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: "var(--t1)", letterSpacing: "-0.02em", marginBottom: 10 }}>
            {greeting}, Max.
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 13, color: "var(--t3)" }}>
            <span>{habitsDone}/{HABITS.length} habits done</span>
            <span style={{ color: "var(--border2)" }}>·</span>
            <span>{EVENTS.length} events today</span>
            <span style={{ color: "var(--border2)" }}>·</span>
            <span style={{ color: btc && btc.change24h >= 0 ? "var(--green)" : "var(--red)", fontWeight: 600 }}>
              BTC {btc ? `${btc.change24h >= 0 ? "+" : ""}${btc.change24h.toFixed(2)}%` : "—"}
            </span>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "monospace", fontSize: 36, fontWeight: 800, color: "var(--t1)", letterSpacing: "-0.02em" }}>
            {timeStr}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end", marginTop: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green)", animation: "pulse-dot 2s ease-in-out infinite", display: "inline-block" }} />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", color: "var(--green)", textTransform: "uppercase" }}>M.A.X. Online</span>
          </div>
        </div>
      </div>

      {/* ── STAT CARDS ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>

        {/* Weather */}
        <HudCard className="afu" delay={.05} style={{ padding: 20 }}>
          <Label>Orlando</Label>
          {weather ? (
            <>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 44, fontWeight: 800, color: "var(--t1)", lineHeight: 1, fontFamily: "monospace" }}>{weather.tempF}°</span>
                <span style={{ fontSize: 13, color: "var(--t2)", marginBottom: 4 }}>{weather.condition}</span>
              </div>
              <div style={{ display: "flex", gap: 12, fontSize: 12, color: "var(--t3)" }}>
                <span>Rain {weather.precipChance}%</span>
                <span>Wind {weather.windMph}mph</span>
                <span>Feels {weather.feelsLikeF}°</span>
              </div>
            </>
          ) : (
            <div style={{ fontSize: 32, fontWeight: 800, color: "var(--t3)" }}>—</div>
          )}
        </HudCard>

        {/* Portfolio */}
        <HudCard className="afu" delay={.1} style={{ padding: 20 }}>
          <Label>Portfolio</Label>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 36, fontWeight: 800, color: "var(--t1)", lineHeight: 1, fontFamily: "monospace" }}>$6,320</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--green)" }}>+1.18%</span>
          </div>
          <Sparkline data={PORT_DATA} color="var(--green)" height={30} id="port-stat" />
        </HudCard>

        {/* Habits ring */}
        <HudCard className="afu" delay={.15} style={{ padding: 20 }}>
          <Label>Habits Today</Label>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <svg width="52" height="52" viewBox="0 0 52 52" style={{ flexShrink: 0 }}>
              <circle cx="26" cy="26" r="22" fill="none" stroke="var(--border2)" strokeWidth="4" />
              <circle cx="26" cy="26" r="22" fill="none" stroke="var(--blue)" strokeWidth="4"
                strokeDasharray={C} strokeDashoffset={dash} strokeLinecap="round" transform="rotate(-90 26 26)"
                style={{ transition: "stroke-dashoffset .6s ease" }} />
              <text x="26" y="30" textAnchor="middle" fontSize="12" fontWeight="800" fill="var(--t1)">{habitsDone}/{HABITS.length}</text>
            </svg>
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "var(--t1)" }}>{Math.round((habitsDone / HABITS.length) * 100)}%</div>
              <div style={{ fontSize: 12, color: "var(--amber)", marginTop: 2, fontWeight: 600 }}>🔥 12-day streak</div>
            </div>
          </div>
        </HudCard>

        {/* Inbox */}
        <HudCard className="afu" delay={.2} style={{ padding: 20 }}>
          <Label>Inbox</Label>
          <div style={{ fontSize: 44, fontWeight: 800, color: "var(--red)", lineHeight: 1, fontFamily: "monospace", marginBottom: 8 }}>3</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--red)" }}>Urgent — reply today</div>
          <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 3 }}>12 total · 4 need response</div>
        </HudCard>
      </div>

      {/* ── MAIN 3-COL GRID ── */}
      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr 280px", gap: 12 }}>

        {/* ── LEFT: SCHEDULE + HABITS + GOALS ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Schedule */}
          <HudCard delay={.22} style={{ padding: "24px 24px 20px" }}>
            <Label>Today&apos;s Schedule</Label>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {EVENTS.map((ev, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "12px 12px", borderRadius: 4,
                  background: "var(--surface2)",
                  borderLeft: `2px solid ${ev.type === "Health" ? "var(--green)" : "var(--blue)"}`,
                }}>
                  <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--t3)", width: 42, flexShrink: 0 }}>
                    {ev.time.replace(" AM", "a").replace(" PM", "p")}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--t1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ev.title}</div>
                    <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 1 }}>{ev.duration}</div>
                  </div>
                </div>
              ))}
            </div>
          </HudCard>

          {/* Habits */}
          <HudCard delay={.26} style={{ padding: "20px 20px 16px" }}>
            <Label>Habits</Label>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {HABITS.map((h, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 10px", borderRadius: 4,
                  background: "var(--surface2)",
                }}>
                  <div style={{
                    width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                    background: h.done ? "rgba(34,197,94,0.15)" : "transparent",
                    border: `1px solid ${h.done ? "rgba(34,197,94,0.5)" : "var(--border2)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {h.done && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3.5"><polyline points="20 6 9 17 4 12" /></svg>}
                  </div>
                  <span style={{ fontSize: 12, flex: 1, color: h.done ? "var(--t1)" : "var(--t3)", fontWeight: h.done ? 500 : 400 }}>{h.label}</span>
                  {h.streak > 0 && <span style={{ fontSize: 11, color: "var(--amber)", fontWeight: 700 }}>🔥{h.streak}</span>}
                </div>
              ))}
            </div>
          </HudCard>

          {/* Goal Pulse */}
          <HudCard delay={.30} style={{ padding: "20px 20px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--t3)" }}>Goal Pulse</p>
              <a href="/dashboard/goals" style={{ fontSize: 11, color: "var(--blue)", textDecoration: "none" }}>View all →</a>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {[
                { label: "$100K Income",   pct: 0,  note: "Starts July 2026" },
                { label: "Emergency Fund", pct: 28, note: "$2.8K / $10K"     },
                { label: "Gym Streak",     pct: 65, note: "12 weeks"         },
              ].map(g => (
                <div key={g.label}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--t1)" }}>{g.label}</span>
                      <span style={{ fontSize: 11, color: "var(--t3)", marginLeft: 6 }}>{g.note}</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "monospace", color: g.pct > 0 ? "var(--green)" : "var(--t3)" }}>{g.pct}%</span>
                  </div>
                  <div style={{ height: 3, borderRadius: 2, background: "var(--border2)" }}>
                    <div style={{ height: 3, borderRadius: 2, width: `${g.pct || 1}%`, background: g.pct > 0 ? "var(--green)" : "var(--border2)", transition: "width 1s ease" }} />
                  </div>
                </div>
              ))}
            </div>
          </HudCard>
        </div>

        {/* ── CENTER: INTEL FEED (full height) ── */}
        <HudCard delay={.24} style={{ padding: "24px 24px 20px", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--t3)" }}>Intel Feed</p>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green)", animation: "pulse-dot 2s ease-in-out infinite", display: "inline-block" }} />
              <span style={{ fontSize: 11, color: "var(--t3)" }}>Live · {(news.length || NEWS_FALLBACK.length)} articles</span>
            </div>
          </div>

          {/* Filter tabs */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
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

          <Divider />

          {/* Articles */}
          <div style={{ display: "flex", flexDirection: "column", gap: 1, overflow: "auto", flex: 1 }}>
            {displayNews.slice(0, 10).map((n, i) => (
              <a key={i} href={n.link} target="_blank" rel="noopener noreferrer" style={{
                display: "block", padding: "14px 10px", borderRadius: 4, textDecoration: "none",
                borderBottom: i < displayNews.slice(0, 10).length - 1 ? "1px solid var(--border)" : "none",
              }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: "var(--t1)", lineHeight: 1.5, marginBottom: 6 }}>{n.title}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, color: "var(--t3)" }}>{n.source}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 2, background: "var(--surface3)", color: "var(--t2)" }}>{n.tag}</span>
                </div>
              </a>
            ))}
            {displayNews.length === 0 && (
              <p style={{ fontSize: 13, color: "var(--t3)", padding: "20px 10px" }}>No articles in this category.</p>
            )}
          </div>
        </HudCard>

        {/* ── RIGHT: CRYPTO + BRIEF ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Crypto */}
          <HudCard delay={.2} style={{ padding: "20px 20px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <Label>Crypto</Label>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 16 }}>
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
                    <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 2 }}>{a.hold} · {a.val}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "monospace", color: "var(--t1)" }}>{a.price}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: a.isUp ? "var(--green)" : "var(--red)" }}>{a.change}</div>
                  </div>
                </div>
                <Sparkline data={a.data} color={a.isUp ? "var(--green)" : "var(--red)"} height={32} id={`d-${a.symbol}`} />
              </div>
            ))}
          </HudCard>

          {/* M.A.X. Brief */}
          <HudCard delay={.28} style={{ padding: "20px 20px 20px" }}>
            <Label>M.A.X. Brief</Label>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { icon: "↗", text: "BTC above key support. XRP ETF odds at 72% — hold position.", c: "var(--green)" },
                { icon: "◎", text: "Client call at 11 AM is your highest-leverage event today.",  c: "var(--blue)"  },
                { icon: "↑", text: "12-day gym streak. Pull day at 6 PM — don't skip.",           c: "var(--amber)" },
                { icon: "!", text: "3 urgent emails. Reply before the client call.",               c: "var(--red)"   },
              ].map((b, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: b.c, flexShrink: 0, marginTop: 1, width: 14, textAlign: "center" }}>{b.icon}</span>
                  <span style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.5 }}>{b.text}</span>
                </div>
              ))}
            </div>
            <a href="/dashboard/chat" style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              marginTop: 16, padding: "10px 0", borderRadius: 4, fontSize: 12, fontWeight: 700,
              background: "rgba(69,137,255,0.1)", color: "var(--blue)", border: "1px solid rgba(69,137,255,0.2)",
              textDecoration: "none",
            }}>
              Talk to M.A.X. →
            </a>
          </HudCard>
        </div>
      </div>
    </div>
  );
}
