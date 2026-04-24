"use client";

import { useState, useEffect, useRef } from "react";
import { HudCard } from "@/components/ui/HudCard";

interface NewsItem {
  title: string; source: string; tag: string; link: string;
  snippet: string; pubDate: string; breaking?: boolean;
}
interface Top3Pick { idx: number; reason: string }

const TAGS = ["All","Breaking","Finance","Crypto","Politics","AI","Tech","World","Markets"];
const BASE_INTERESTS = ["Crypto","AI","Sales","Entrepreneurship","Investing","Orlando"];

const CAPITALS = [
  { city:"New York",   lat:40.71, lon:-74.01, tz:"America/New_York" },
  { city:"Washington", lat:38.89, lon:-77.04, tz:"America/New_York" },
  { city:"London",     lat:51.51, lon:-0.13,  tz:"Europe/London"    },
  { city:"Tokyo",      lat:35.68, lon:139.69, tz:"Asia/Tokyo"       },
  { city:"Dubai",      lat:25.20, lon:55.27,  tz:"Asia/Dubai"       },
  { city:"Paris",      lat:48.86, lon:2.35,   tz:"Europe/Paris"     },
];

function wxIcon(code: number) {
  if (code === 0) return "☀️"; if (code <= 2) return "⛅"; if (code === 3) return "☁️";
  if (code <= 49) return "🌫"; if (code <= 67) return "🌧"; if (code >= 95) return "⛈"; return "🌤";
}

function CityCard({ city, lat, lon, tz }: { city:string; lat:number; lon:number; tz:string }) {
  const [time,    setTime]    = useState("");
  const [weather, setWeather] = useState<{ temp:number; code:number }|null>(null);
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString("en-US",{timeZone:tz,hour:"2-digit",minute:"2-digit",hour12:true}));
    tick(); const id = setInterval(tick,1000); return ()=>clearInterval(id);
  },[tz]);
  useEffect(() => {
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&temperature_unit=fahrenheit`)
      .then(r=>r.json()).then(d=>setWeather({temp:Math.round(d.current.temperature_2m),code:d.current.weather_code})).catch(()=>{});
  },[lat,lon]);
  return (
    <div style={{padding:"12px 14px",borderRadius:8,background:"var(--surface)",border:"1px solid var(--border)"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
        <p style={{fontSize:10,fontWeight:700,color:"var(--t3)",letterSpacing:"0.08em"}}>{city.toUpperCase()}</p>
        <span style={{width:4,height:4,borderRadius:"50%",background:"var(--green)",display:"inline-block"}}/>
      </div>
      <p style={{fontFamily:"monospace",fontSize:18,fontWeight:800,color:"var(--t1)",lineHeight:1,marginBottom:4}}>{time||"—"}</p>
      {weather&&<p style={{fontSize:10,color:"var(--t3)"}}>{wxIcon(weather.code)} {weather.temp}°F</p>}
    </div>
  );
}

function timeAgo(dateStr: string) {
  if (!dateStr) return "";
  const m = Math.floor((Date.now()-new Date(dateStr).getTime())/60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m/60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h/24)}d ago`;
}

function isRelevantTicker(n: NewsItem) {
  const t = n.title.toLowerCase();
  return n.breaking===true || n.tag==="Crypto"||n.tag==="AI"||n.tag==="Finance"||n.tag==="Markets"||
    t.includes("btc")||t.includes("xrp")||t.includes("bitcoin")||t.includes("market")||t.includes("fed");
}

function todayStr() { return new Date().toDateString(); }

export default function FeedPage() {
  const [news,           setNews]           = useState<NewsItem[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [tag,            setTag]            = useState("All");
  const [search,         setSearch]         = useState("");
  const [lastFetch,      setLastFetch]      = useState<Date|null>(null);
  const [maxSummary,     setMaxSummary]     = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [saved,          setSaved]          = useState<Set<string>>(new Set());
  const [liveCrypto,     setLiveCrypto]     = useState<{btc:number;xrp:number;btcChg:number;xrpChg:number}|null>(null);
  const [tickerHover,    setTickerHover]    = useState(false);
  const [topicInput,     setTopicInput]     = useState("");
  const [topicOverride,  setTopicOverride]  = useState("");
  const [top3,           setTop3]           = useState<Top3Pick[]>([]);
  const [top3Loading,    setTop3Loading]    = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>|undefined>(undefined);

  useEffect(() => {
    try {
      const s = localStorage.getItem("feed-saved");
      if (s) setSaved(new Set(JSON.parse(s) as string[]));
      const t = localStorage.getItem("feed-topic");
      if (t) {
        const parsed = JSON.parse(t) as { topic:string; date:string };
        if (parsed.date === todayStr()) { setTopicOverride(parsed.topic); setTopicInput(parsed.topic); }
        else localStorage.removeItem("feed-topic");
      }
    } catch {}
  },[]);

  function toggleSave(link: string) {
    setSaved(prev=>{
      const next = new Set(prev);
      next.has(link)?next.delete(link):next.add(link);
      try { localStorage.setItem("feed-saved",JSON.stringify([...next])); } catch {}
      return next;
    });
  }

  function applyTopic() {
    const t = topicInput.trim();
    if (!t) return;
    setTopicOverride(t);
    try { localStorage.setItem("feed-topic",JSON.stringify({topic:t,date:todayStr()})); } catch {}
    fetchNews(t);
  }

  function clearTopic() {
    setTopicOverride("");
    setTopicInput("");
    try { localStorage.removeItem("feed-topic"); } catch {}
    fetchNews("");
  }

  async function fetchNews(topic = topicOverride) {
    setLoading(true);
    try {
      const url = topic ? `/api/news?count=50&topic=${encodeURIComponent(topic)}` : "/api/news?count=50";
      const res = await fetch(url);
      const j   = await res.json();
      if (j.data) {
        setNews(j.data);
        setLastFetch(new Date());
        // M.A.X. Brief
        setSummaryLoading(true);
        fetch("/api/feed/summary",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({articles:(j.data as NewsItem[]).slice(0,20).map((a:NewsItem)=>({title:a.title,source:a.source,tag:a.tag,snippet:a.snippet}))})})
          .then(r=>r.json()).then(s=>{if(s.summary)setMaxSummary(s.summary);}).catch(()=>{}).finally(()=>setSummaryLoading(false));
        // M.A.X. Top 3
        setTop3Loading(true);
        fetch("/api/feed/top3",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({articles:(j.data as NewsItem[]).slice(0,25).map((a:NewsItem)=>({title:a.title,source:a.source,tag:a.tag,snippet:a.snippet}))})})
          .then(r=>r.json()).then(d=>{if(d.picks)setTop3(d.picks);}).catch(()=>{}).finally(()=>setTop3Loading(false));
      }
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    async function fetchCrypto() {
      try {
        const r = await fetch("/api/crypto"); const j = await r.json();
        if (j.data) {
          const btc = j.data.find((d:{symbol:string})=>d.symbol==="BTC");
          const xrp = j.data.find((d:{symbol:string})=>d.symbol==="XRP");
          if (btc&&xrp) setLiveCrypto({btc:btc.price,xrp:xrp.price,btcChg:btc.change24h??0,xrpChg:xrp.change24h??0});
        }
      } catch {}
    }
    fetchCrypto();
    const id = setInterval(fetchCrypto,2*60*1000); return ()=>clearInterval(id);
  },[]);

  useEffect(() => {
    fetchNews();
    intervalRef.current = setInterval(()=>fetchNews(),5*60*1000);
    return ()=>clearInterval(intervalRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  const tickerItems = news.filter(isRelevantTicker).slice(0,16);
  const filtered = news.filter(n=>{
    const matchTag = tag==="All"?true:tag==="Breaking"?n.breaking:n.tag===tag;
    const matchSearch = !search||n.title.toLowerCase().includes(search.toLowerCase())||n.source.toLowerCase().includes(search.toLowerCase());
    return matchTag&&matchSearch;
  });
  const sourceCounts = news.reduce((acc,n)=>{acc[n.source]=(acc[n.source]??0)+1;return acc;},{} as Record<string,number>);

  return (
    <div style={{padding:"28px 36px",background:"var(--bg)",minHeight:"100vh"}}>
      <style>{`@keyframes marquee{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}`}</style>

      {/* Header */}
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:14}}>
        <div>
          <p style={{fontSize:11,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:"var(--t3)",marginBottom:6}}>M.A.X. Intelligence</p>
          <h1 style={{fontSize:28,fontWeight:800,color:"var(--t1)",letterSpacing:"-0.02em"}}>World Intel Feed</h1>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontFamily:"monospace",fontSize:22,fontWeight:800,color:"var(--t1)"}}>{new Date().toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"})}</div>
          <div style={{display:"flex",alignItems:"center",gap:6,justifyContent:"flex-end",marginTop:4}}>
            <span style={{width:5,height:5,borderRadius:"50%",background:"var(--green)",display:"inline-block"}}/>
            <span style={{fontSize:10,color:"var(--green)",fontWeight:700,letterSpacing:"0.1em"}}>LIVE · {news.length} ARTICLES</span>
          </div>
          {lastFetch&&<p style={{fontSize:10,color:"var(--t4)",marginTop:2}}>Updated {timeAgo(lastFetch.toISOString())}</p>}
        </div>
      </div>

      {/* Topic Override Bar */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,flexWrap:"wrap"}}>
        {topicOverride ? (
          <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 14px",borderRadius:8,background:"rgba(200,90,90,0.07)",border:"1px solid rgba(200,90,90,0.2)"}}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <span style={{fontSize:12,fontWeight:700,color:"var(--amber)"}}>Today: {topicOverride}</span>
            <button onClick={clearTopic} style={{fontSize:11,color:"var(--t4)",background:"none",border:"none",cursor:"pointer",padding:0,marginLeft:4}}>· Reset →</button>
          </div>
        ) : (
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <input value={topicInput} onChange={e=>setTopicInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")applyTopic();}}
              placeholder="Override feed topic… (e.g. Claude Code, AI agents)"
              style={{width:280,background:"var(--surface)",border:"1px solid var(--border)",borderRadius:7,padding:"7px 12px",fontSize:12,color:"var(--t1)",outline:"none"}}
              onFocus={e=>(e.target.style.borderColor="var(--amber)")} onBlur={e=>(e.target.style.borderColor="var(--border)")}/>
            <button onClick={applyTopic} disabled={!topicInput.trim()} style={{padding:"7px 14px",borderRadius:7,cursor:"pointer",fontSize:12,fontWeight:700,background:"rgba(200,90,90,0.08)",border:"1px solid rgba(200,90,90,0.2)",color:"var(--amber)",opacity:topicInput.trim()?1:0.4}}>Apply</button>
          </div>
        )}
        <span style={{fontSize:11,color:"var(--t4)"}}>Base: {BASE_INTERESTS.join(" · ")}</span>
      </div>

      {/* Rolling Ticker */}
      {tickerItems.length > 0 && (
        <div style={{display:"flex",alignItems:"center",marginBottom:14,borderRadius:6,overflow:"hidden",border:"1px solid rgba(125,184,232,0.15)",background:"rgba(125,184,232,0.03)",cursor:"default"}}
          onMouseEnter={()=>setTickerHover(true)} onMouseLeave={()=>setTickerHover(false)}>
          <div style={{padding:"8px 12px",background:"rgba(125,184,232,0.08)",flexShrink:0,borderRight:"1px solid rgba(125,184,232,0.12)"}}>
            <span style={{fontSize:10,fontWeight:800,color:"var(--teal)",letterSpacing:"0.1em"}}>● LIVE</span>
          </div>
          <div style={{flex:1,overflow:"hidden"}}>
            <div style={{display:"flex",width:"200%",animation:"marquee 40s linear infinite",animationPlayState:tickerHover?"paused":"running"}}>
              {[...tickerItems,...tickerItems].map((n,i)=>(
                <a key={i} href={n.link} target="_blank" rel="noopener noreferrer" style={{display:"inline-flex",alignItems:"center",gap:10,padding:"8px 24px",flexShrink:0,textDecoration:"none",borderRight:"1px solid rgba(125,184,232,0.08)"}}>
                  {n.breaking&&<span style={{fontSize:9,fontWeight:800,color:"var(--red)",background:"rgba(200,90,90,0.1)",border:"1px solid rgba(200,90,90,0.2)",borderRadius:3,padding:"1px 5px",flexShrink:0}}>LIVE</span>}
                  <span style={{fontSize:12,color:"var(--t2)",whiteSpace:"nowrap",fontWeight:n.breaking?600:400}}>{n.title}</span>
                  <span style={{fontSize:10,color:"var(--t4)",whiteSpace:"nowrap",flexShrink:0}}>— {n.source}</span>
                </a>
              ))}
            </div>
          </div>
          {tickerHover&&<div style={{padding:"8px 12px",flexShrink:0,borderLeft:"1px solid rgba(125,184,232,0.08)"}}><span style={{fontSize:10,color:"var(--t4)"}}>⏸ paused</span></div>}
        </div>
      )}

      {/* M.A.X. Brief */}
      <div style={{marginBottom:16,padding:"14px 18px",borderRadius:10,background:"rgba(125,184,232,0.04)",border:"1px solid rgba(125,184,232,0.12)",display:"flex",alignItems:"flex-start",gap:12}}>
        <div style={{width:28,height:28,borderRadius:7,background:"rgba(125,184,232,0.1)",border:"1px solid rgba(125,184,232,0.2)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <span style={{fontSize:12,fontWeight:900,color:"var(--blue)"}}>M</span>
        </div>
        <div style={{flex:1}}>
          <p style={{fontSize:10,fontWeight:700,letterSpacing:"0.1em",color:"var(--blue)",marginBottom:5}}>M.A.X. BRIEF</p>
          {summaryLoading
            ? <div style={{display:"flex",gap:4,alignItems:"center"}}>{[0,1,2].map(i=><div key={i} style={{width:5,height:5,borderRadius:"50%",background:"var(--blue)",opacity:0.4}}/>)}<span style={{fontSize:12,color:"var(--t3)",marginLeft:4}}>Analyzing…</span></div>
            : <p style={{fontSize:13,color:"var(--t2)",lineHeight:1.7}}>{maxSummary||(loading?"Loading news…":"Refresh to get M.A.X. briefing.")}</p>}
        </div>
      </div>

      {/* World Clocks */}
      <div style={{marginBottom:20}}>
        <p style={{fontSize:10,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:"var(--t3)",marginBottom:10}}>Global Operations</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:8}}>
          {CAPITALS.map(c=><CityCard key={c.city} {...c}/>)}
        </div>
      </div>

      {/* Filters */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <div style={{display:"flex",gap:4,flexWrap:"wrap",flex:1}}>
          {TAGS.map(t=>(
            <button key={t} onClick={()=>setTag(t)} style={{padding:"5px 12px",borderRadius:20,cursor:"pointer",fontSize:11,fontWeight:600,background:tag===t?"rgba(125,184,232,0.15)":"transparent",border:`1px solid ${tag===t?"rgba(125,184,232,0.35)":"var(--border)"}`,color:tag===t?"var(--blue)":"var(--t3)",transition:"all .15s"}}>
              {t==="Breaking"?"● Breaking":t}
            </button>
          ))}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,background:"var(--surface)",border:"1px solid var(--border)",borderRadius:8,padding:"6px 12px"}}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--t4)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search articles…" style={{background:"none",border:"none",outline:"none",fontSize:12,color:"var(--t1)",width:160}}/>
        </div>
        <button onClick={()=>fetchNews()} style={{display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:8,background:"var(--surface)",border:"1px solid var(--border)",cursor:"pointer",fontSize:11,fontWeight:600,color:"var(--t3)"}}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
          Refresh
        </button>
      </div>

      {/* Main Grid */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 320px",gap:16}}>

        {/* Articles */}
        <div>
          {loading ? (
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:300}}>
              <div style={{display:"flex",gap:6}}>{[0,1,2].map(i=><div key={i} style={{width:8,height:8,borderRadius:"50%",background:"var(--blue)",opacity:0.5}}/>)}</div>
            </div>
          ) : (
            <div>
              {filtered.length===0&&<p style={{fontSize:13,color:"var(--t3)",padding:"40px 0",textAlign:"center"}}>No articles match.</p>}
              {filtered.map((n,i)=>(
                <div key={i} style={{padding:"16px 0",borderBottom:i<filtered.length-1?"1px solid var(--border)":"none",borderLeft:n.breaking?"2px solid var(--red)":"2px solid transparent",paddingLeft:n.breaking?14:0,position:"relative"}}>
                  <a href={n.link} target="_blank" rel="noopener noreferrer" style={{display:"block",textDecoration:"none"}}>
                    <div style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:6}}>
                      {n.breaking&&<span style={{fontSize:9,fontWeight:800,color:"var(--red)",background:"rgba(200,90,90,0.1)",border:"1px solid rgba(200,90,90,0.25)",borderRadius:3,padding:"2px 5px",flexShrink:0}}>LIVE</span>}
                      <p style={{fontSize:14,fontWeight:600,color:"var(--t1)",lineHeight:1.5,margin:0}}>{n.title}</p>
                    </div>
                    {n.snippet&&<p style={{fontSize:12,color:"var(--t3)",lineHeight:1.6,marginBottom:8}}>{n.snippet.slice(0,160)}{n.snippet.length>160?"…":""}</p>}
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:11,fontWeight:600,color:"var(--t3)"}}>{n.source}</span>
                      <span style={{fontSize:9,color:"var(--t4)"}}>·</span>
                      <span style={{fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:3,background:"var(--surface2)",color:"var(--t2)"}}>{n.tag}</span>
                      {n.pubDate&&<span style={{fontSize:10,color:"var(--t4)",marginLeft:"auto"}}>{timeAgo(n.pubDate)}</span>}
                    </div>
                  </a>
                  <button onClick={()=>toggleSave(n.link)} title={saved.has(n.link)?"Unsave":"Save"}
                    style={{position:"absolute",top:14,right:0,background:"none",border:"none",cursor:"pointer",color:saved.has(n.link)?"var(--amber)":"var(--t4)",padding:4,transition:"color .15s"}}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill={saved.has(n.link)?"currentColor":"none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div style={{display:"flex",flexDirection:"column",gap:12}}>

          {/* M.A.X. Top 3 */}
          <HudCard style={{padding:"16px 18px"}}>
            <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:12}}>
              <div style={{width:22,height:22,borderRadius:6,background:"rgba(125,184,232,0.1)",border:"1px solid rgba(125,184,232,0.2)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <span style={{fontSize:10,fontWeight:900,color:"var(--blue)"}}>M</span>
              </div>
              <p style={{fontSize:10,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:"var(--blue)"}}>Top 3 Picks</p>
            </div>
            {top3Loading ? (
              <div style={{display:"flex",gap:4,alignItems:"center"}}>{[0,1,2].map(i=><div key={i} style={{width:5,height:5,borderRadius:"50%",background:"var(--blue)",opacity:0.4}}/>)}<span style={{fontSize:11,color:"var(--t4)",marginLeft:4}}>Picking…</span></div>
            ) : top3.length > 0 ? (
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {top3.map((pick,i)=>{
                  const article = news[pick.idx-1];
                  if (!article) return null;
                  return (
                    <div key={i} style={{display:"flex",gap:8}}>
                      <span style={{fontSize:13,fontWeight:800,color:"var(--blue)",opacity:0.5,flexShrink:0,marginTop:1,fontFamily:"monospace"}}>{i+1}</span>
                      <div>
                        <a href={article.link} target="_blank" rel="noopener noreferrer" style={{textDecoration:"none"}}>
                          <p style={{fontSize:12,fontWeight:600,color:"var(--t1)",lineHeight:1.4,marginBottom:4}}>{article.title.length>75?article.title.slice(0,75)+"…":article.title}</p>
                        </a>
                        <p style={{fontSize:11,color:"var(--t3)",lineHeight:1.4}}>{pick.reason}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{fontSize:12,color:"var(--t4)"}}>Refresh for picks.</p>
            )}
          </HudCard>

          {/* Live Crypto */}
          <HudCard style={{padding:"16px 18px"}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:12}}>
              <span style={{width:5,height:5,borderRadius:"50%",background:liveCrypto?"var(--green)":"var(--amber)",display:"inline-block"}}/>
              <p style={{fontSize:10,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:"var(--t3)"}}>Live Crypto</p>
            </div>
            {liveCrypto ? (
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {[{sym:"BTC",name:"Bitcoin",price:liveCrypto.btc,chg:liveCrypto.btcChg},{sym:"XRP",name:"Ripple",price:liveCrypto.xrp,chg:liveCrypto.xrpChg}].map(c=>(
                  <div key={c.sym} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 12px",borderRadius:6,background:"var(--surface2)",border:"1px solid var(--border)"}}>
                    <div>
                      <p style={{fontSize:13,fontWeight:800,color:"var(--t1)"}}>{c.sym}</p>
                      <p style={{fontSize:10,color:"var(--t4)"}}>{c.name}</p>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <p style={{fontSize:14,fontWeight:700,fontFamily:"monospace",color:"var(--t1)"}}>{c.sym==="BTC"?`$${Math.round(c.price).toLocaleString()}`:`$${c.price.toFixed(4)}`}</p>
                      <p style={{fontSize:12,fontWeight:700,color:c.chg>=0?"var(--green)":"var(--red)"}}>{c.chg>=0?"+":""}{c.chg.toFixed(2)}%</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : <div style={{display:"flex",gap:4,padding:"8px 0"}}>{[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:"50%",background:"var(--blue)",opacity:0.4}}/>)}</div>}
          </HudCard>

          {/* Saved Articles */}
          {saved.size > 0 && (
            <HudCard style={{padding:"16px 18px"}}>
              <p style={{fontSize:10,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:"var(--amber)",marginBottom:10}}>★ Saved ({saved.size})</p>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {news.filter(n=>saved.has(n.link)).slice(0,5).map((n,i)=>(
                  <a key={i} href={n.link} target="_blank" rel="noopener noreferrer" style={{textDecoration:"none"}}>
                    <p style={{fontSize:12,fontWeight:600,color:"var(--t1)",lineHeight:1.4,marginBottom:2}}>{n.title.slice(0,70)}{n.title.length>70?"…":""}</p>
                    <p style={{fontSize:10,color:"var(--t4)"}}>{n.source}</p>
                  </a>
                ))}
              </div>
            </HudCard>
          )}

          {/* Coverage by Topic */}
          <HudCard style={{padding:"16px 18px"}}>
            <p style={{fontSize:10,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:"var(--t3)",marginBottom:12}}>Coverage by Topic</p>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {TAGS.slice(2).map(t=>{
                const count = news.filter(n=>n.tag===t).length;
                const pct = news.length>0?(count/news.length)*100:0;
                return (
                  <div key={t}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                      <span style={{fontSize:11,color:"var(--t2)"}}>{t}</span>
                      <span style={{fontSize:11,fontFamily:"monospace",color:"var(--t3)"}}>{count}</span>
                    </div>
                    <div style={{height:2,borderRadius:1,background:"var(--border2)"}}>
                      <div style={{height:2,borderRadius:1,width:`${pct}%`,background:"var(--blue)",transition:"width 1s ease"}}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </HudCard>

          {/* Top Sources */}
          <HudCard style={{padding:"16px 18px"}}>
            <p style={{fontSize:10,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:"var(--t3)",marginBottom:12}}>Top Sources</p>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {Object.entries(sourceCounts).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([src,cnt])=>(
                <div key={src} style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:12,color:"var(--t2)"}}>{src}</span>
                  <span style={{fontSize:11,fontFamily:"monospace",fontWeight:700,color:"var(--t3)"}}>{cnt}</span>
                </div>
              ))}
            </div>
          </HudCard>
        </div>
      </div>
    </div>
  );
}
