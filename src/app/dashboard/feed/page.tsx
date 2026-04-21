"use client";

import { useState, useEffect, useRef } from "react";
import { HudCard } from "@/components/ui/HudCard";

interface NewsItem {
  title: string;
  source: string;
  tag: string;
  link: string;
  snippet: string;
  pubDate: string;
  breaking?: boolean;
}

const TAGS = ["All", "Breaking", "Finance", "Crypto", "Politics", "AI", "Tech", "World", "Markets"];

const CAPITALS = [
  { city: "New York",   lat: 40.71, lon: -74.01, tz: "America/New_York"  },
  { city: "Washington", lat: 38.89, lon: -77.04, tz: "America/New_York"  },
  { city: "London",     lat: 51.51, lon: -0.13,  tz: "Europe/London"     },
  { city: "Tokyo",      lat: 35.68, lon: 139.69, tz: "Asia/Tokyo"        },
  { city: "Dubai",      lat: 25.20, lon: 55.27,  tz: "Asia/Dubai"        },
  { city: "Paris",      lat: 48.86, lon: 2.35,   tz: "Europe/Paris"      },
];

function wxIcon(code: number) {
  if (code === 0)  return "☀️";
  if (code <= 2)   return "⛅";
  if (code === 3)  return "☁️";
  if (code <= 49)  return "🌫";
  if (code <= 67)  return "🌧";
  if (code >= 95)  return "⛈";
  return "🌤";
}

function CityCard({ city, lat, lon, tz }: { city: string; lat: number; lon: number; tz: string }) {
  const [time,    setTime]    = useState("");
  const [weather, setWeather] = useState<{ temp: number; code: number } | null>(null);

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString("en-US", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: true }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [tz]);

  useEffect(() => {
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&temperature_unit=fahrenheit`)
      .then(r => r.json())
      .then(d => setWeather({ temp: Math.round(d.current.temperature_2m), code: d.current.weather_code }))
      .catch(() => {});
  }, [lat, lon]);

  return (
    <div style={{
      padding: "12px 14px", borderRadius: 8,
      background: "var(--surface)", border: "1px solid var(--border)",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: "var(--t3)", letterSpacing: "0.08em" }}>{city.toUpperCase()}</p>
        <span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--green)", display: "inline-block", animation: "pulse-dot 2s ease-in-out infinite" }} />
      </div>
      <p style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 800, color: "var(--t1)", lineHeight: 1, marginBottom: 4 }}>{time || "—"}</p>
      {weather && <p style={{ fontSize: 10, color: "var(--t3)" }}>{wxIcon(weather.code)} {weather.temp}°F</p>}
    </div>
  );
}

function timeAgo(dateStr: string) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function FeedPage() {
  const [news,      setNews]      = useState<NewsItem[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [tag,       setTag]       = useState("All");
  const [search,    setSearch]    = useState("");
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [tickIdx,   setTickIdx]   = useState(0);
  const intervalRef               = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  async function fetchNews() {
    try {
      const res = await fetch("/api/news?count=50");
      const j   = await res.json();
      if (j.data) { setNews(j.data); setLastFetch(new Date()); }
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    fetchNews();
    intervalRef.current = setInterval(fetchNews, 5 * 60 * 1000);
    return () => clearInterval(intervalRef.current);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setTickIdx(t => t + 1), 4000);
    return () => clearInterval(id);
  }, []);

  const breaking = news.filter(n => n.breaking);
  const filtered = news.filter(n => {
    const matchTag    = tag === "All" ? true : tag === "Breaking" ? n.breaking : n.tag === tag;
    const matchSearch = !search || n.title.toLowerCase().includes(search.toLowerCase()) || n.source.toLowerCase().includes(search.toLowerCase());
    return matchTag && matchSearch;
  });

  const sourceCounts = news.reduce((acc, n) => { acc[n.source] = (acc[n.source] ?? 0) + 1; return acc; }, {} as Record<string, number>);

  return (
    <div style={{ padding: "28px 36px", background: "var(--bg)", minHeight: "100vh" }}>

      {/* ── HEADER ── */}
      <div className="afu" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--t3)", marginBottom: 6 }}>M.A.X. Intelligence</p>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--t1)", letterSpacing: "-0.02em" }}>World Intel Feed</h1>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "monospace", fontSize: 22, fontWeight: 800, color: "var(--t1)" }}>
            {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end", marginTop: 4 }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--green)", display: "inline-block", animation: "pulse-dot 2s ease-in-out infinite" }} />
            <span style={{ fontSize: 10, color: "var(--green)", fontWeight: 700, letterSpacing: "0.1em" }}>LIVE · {news.length} ARTICLES</span>
          </div>
          {lastFetch && <p style={{ fontSize: 10, color: "var(--t4)", marginTop: 2 }}>Updated {timeAgo(lastFetch.toISOString())}</p>}
        </div>
      </div>

      {/* ── BREAKING TICKER ── */}
      {breaking.length > 0 && (
        <div className="afu" style={{ display: "flex", alignItems: "center", marginBottom: 16, borderRadius: 6, overflow: "hidden", border: "1px solid rgba(239,68,68,0.18)" }}>
          <div style={{ padding: "8px 12px", background: "rgba(239,68,68,0.12)", flexShrink: 0 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: "var(--red)", letterSpacing: "0.1em" }}>● LIVE</span>
          </div>
          <div style={{ flex: 1, overflow: "hidden", padding: "8px 14px" }}>
            <p style={{ fontSize: 12, color: "var(--t2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {breaking[tickIdx % breaking.length]?.title}
            </p>
          </div>
          <div style={{ padding: "8px 12px", flexShrink: 0, borderLeft: "1px solid rgba(239,68,68,0.12)" }}>
            <span style={{ fontSize: 10, color: "var(--t4)" }}>{breaking[tickIdx % breaking.length]?.source}</span>
          </div>
        </div>
      )}

      {/* ── WORLD CLOCKS ── */}
      <div className="afu" style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--t3)", marginBottom: 10 }}>Global Operations</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 8 }}>
          {CAPITALS.map(c => <CityCard key={c.city} {...c} />)}
        </div>
      </div>

      {/* ── FILTERS ── */}
      <div className="afu" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", flex: 1 }}>
          {TAGS.map(t => (
            <button key={t} onClick={() => setTag(t)} style={{
              padding: "5px 12px", borderRadius: 20, cursor: "pointer", fontSize: 11, fontWeight: 600,
              background: tag === t ? "rgba(69,137,255,0.15)" : "transparent",
              border: `1px solid ${tag === t ? "rgba(69,137,255,0.35)" : "var(--border)"}`,
              color: tag === t ? "var(--blue)" : "var(--t3)", transition: "all .15s",
            }}>{t === "Breaking" ? "● Breaking" : t}</button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--t4)" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search articles…"
            style={{ background: "none", border: "none", outline: "none", fontSize: 12, color: "var(--t1)", width: 160 }} />
        </div>
        <button onClick={fetchNews} style={{
          display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8,
          background: "var(--surface)", border: "1px solid var(--border)",
          cursor: "pointer", fontSize: 11, fontWeight: 600, color: "var(--t3)",
        }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* ── MAIN GRID ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}>

        {/* Articles */}
        <div>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
              <div style={{ display: "flex", gap: 6 }}>
                {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--blue)", opacity: 0.5, animation: `bounce 0.8s ease-in-out ${i*0.18}s infinite` }} />)}
              </div>
            </div>
          ) : (
            <div>
              {filtered.length === 0 && <p style={{ fontSize: 13, color: "var(--t3)", padding: "40px 0", textAlign: "center" }}>No articles match.</p>}
              {filtered.map((n, i) => (
                <a key={i} href={n.link} target="_blank" rel="noopener noreferrer" style={{
                  display: "block", padding: "16px 0",
                  borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none",
                  borderLeft: n.breaking ? "2px solid var(--red)" : "2px solid transparent",
                  paddingLeft: n.breaking ? 14 : 0,
                  textDecoration: "none", transition: "background .15s",
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.01)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 6 }}>
                    {n.breaking && <span style={{ fontSize: 9, fontWeight: 800, color: "var(--red)", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 3, padding: "2px 5px", flexShrink: 0, letterSpacing: "0.05em" }}>LIVE</span>}
                    <p style={{ fontSize: 14, fontWeight: 600, color: "var(--t1)", lineHeight: 1.5, margin: 0 }}>{n.title}</p>
                  </div>
                  {n.snippet && <p style={{ fontSize: 12, color: "var(--t3)", lineHeight: 1.6, marginBottom: 8 }}>{n.snippet.slice(0, 160)}{n.snippet.length > 160 ? "…" : ""}</p>}
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--t3)" }}>{n.source}</span>
                    <span style={{ fontSize: 9, color: "var(--t4)" }}>·</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 3, background: "var(--surface2)", color: "var(--t2)" }}>{n.tag}</span>
                    {n.pubDate && <span style={{ fontSize: 10, color: "var(--t4)", marginLeft: "auto" }}>{timeAgo(n.pubDate)}</span>}
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <HudCard style={{ padding: "16px 18px" }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--t3)", marginBottom: 12 }}>Coverage by Topic</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {TAGS.slice(2).map(t => {
                const count = news.filter(n => n.tag === t).length;
                const pct   = news.length > 0 ? (count / news.length) * 100 : 0;
                return (
                  <div key={t}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                      <span style={{ fontSize: 11, color: "var(--t2)" }}>{t}</span>
                      <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--t3)" }}>{count}</span>
                    </div>
                    <div style={{ height: 2, borderRadius: 1, background: "var(--border2)" }}>
                      <div style={{ height: 2, borderRadius: 1, width: `${pct}%`, background: "var(--blue)", transition: "width 1s ease" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </HudCard>

          {breaking.length > 0 && (
            <HudCard style={{ padding: "16px 18px" }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--red)", marginBottom: 12 }}>● Breaking Now</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {breaking.slice(0, 4).map((n, i) => (
                  <a key={i} href={n.link} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "var(--t1)", lineHeight: 1.5, marginBottom: 3 }}>{n.title}</p>
                    <p style={{ fontSize: 10, color: "var(--t4)" }}>{n.source} · {timeAgo(n.pubDate)}</p>
                  </a>
                ))}
              </div>
            </HudCard>
          )}

          <HudCard style={{ padding: "16px 18px" }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--t3)", marginBottom: 12 }}>Top Sources</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([src, cnt]) => (
                <div key={src} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "var(--t2)" }}>{src}</span>
                  <span style={{ fontSize: 11, fontFamily: "monospace", fontWeight: 700, color: "var(--t3)" }}>{cnt}</span>
                </div>
              ))}
            </div>
          </HudCard>
        </div>
      </div>
    </div>
  );
}
