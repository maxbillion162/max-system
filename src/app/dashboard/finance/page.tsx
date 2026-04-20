"use client";

import { useState, useEffect } from "react";
import { HudCard } from "@/components/ui/HudCard";
import { Sparkline } from "@/components/ui/Sparkline";

const CRYPTO_FALLBACK = [
  { symbol:"BTC", name:"Bitcoin", price:94210.50, c24:3.24,  c7:8.1,  hold:"0.02 BTC",  value:1884.21, color:"#f97316", data:[88200,89100,91400,90800,92300,93100,94210] },
  { symbol:"XRP", name:"Ripple",  price:2.18,     c24:-1.45, c7:12.3, hold:"200 XRP",   value:436.00,  color:"#06b6d4", data:[2.31,2.18,2.25,2.09,2.14,2.29,2.18] },
];
const IRA = [
  { symbol:"MDDVX", name:"Mid-Cap Growth Index",  nav:42.18, chg:0.32,  value:1200, shares:28.45 },
  { symbol:"RPEAX", name:"Real Assets Fund",      nav:11.44, chg:-0.18, value:880,  shares:76.92 },
  { symbol:"PTTRX", name:"Total Return Bond",     nav:9.87,  chg:0.05,  value:640,  shares:64.84 },
];
const BILLS = [
  { name:"Rent",    amt:950,   due:11, recurring:true  },
  { name:"Spotify", amt:10.99, due:3,  recurring:true  },
  { name:"Phone",   amt:75,    due:8,  recurring:true  },
  { name:"Netflix", amt:15.49, due:18, recurring:true  },
  { name:"Gym",     amt:40,    due:22, recurring:true  },
];

export default function FinancePage() {
  const [liveData, setLiveData] = useState<typeof CRYPTO_FALLBACK>([]);

  useEffect(() => {
    fetch("/api/crypto")
      .then(r => r.json())
      .then(j => {
        if (!j.data) return;
        const btcLive = j.data.find((d: {symbol:string}) => d.symbol === "BTC");
        const xrpLive = j.data.find((d: {symbol:string}) => d.symbol === "XRP");
        setLiveData([
          {
            symbol:"BTC", name:"Bitcoin", color:"#f97316", hold:"0.02 BTC",
            price: btcLive?.price ?? CRYPTO_FALLBACK[0].price,
            c24:   btcLive?.change24h ?? CRYPTO_FALLBACK[0].c24,
            c7:    btcLive?.change7d  ?? CRYPTO_FALLBACK[0].c7,
            value: (btcLive?.price ?? CRYPTO_FALLBACK[0].price) * 0.02,
            data:  btcLive?.sparkline?.slice(-20) ?? CRYPTO_FALLBACK[0].data,
          },
          {
            symbol:"XRP", name:"Ripple", color:"#06b6d4", hold:"200 XRP",
            price: xrpLive?.price ?? CRYPTO_FALLBACK[1].price,
            c24:   xrpLive?.change24h ?? CRYPTO_FALLBACK[1].c24,
            c7:    xrpLive?.change7d  ?? CRYPTO_FALLBACK[1].c7,
            value: (xrpLive?.price ?? CRYPTO_FALLBACK[1].price) * 200,
            data:  xrpLive?.sparkline?.slice(-20) ?? CRYPTO_FALLBACK[1].data,
          },
        ]);
      })
      .catch(() => {});
  }, []);

  const CRYPTO = liveData.length ? liveData : CRYPTO_FALLBACK;
  const cryptoTotal = CRYPTO.reduce((a,c) => a + c.value, 0);
  const iraTotal    = IRA.reduce((a,c) => a + c.value, 0);
  const savings     = 2800;
  const netWorth    = cryptoTotal + iraTotal + savings;
  const billsTotal  = BILLS.reduce((a,b) => a + b.amt, 0);

  return (
    <div className="grid-bg min-h-screen" style={{ padding: "40px 48px" }}>
      <div style={{ maxWidth: 1100 }}>

        <div className="mb-8 afu">
          <p className="text-sm font-semibold tracking-widest uppercase mb-2" style={{ color: "var(--teal)", opacity:.6 }}>Finance Hub</p>
          <h1 className="text-4xl font-black tracking-tight mb-2 grad-text">Portfolio</h1>
          <p className="text-base" style={{ color: "var(--t2)" }}>Crypto · Roth IRA · Savings · Bills — all in one place.</p>
        </div>

        {/* Net worth */}
        <HudCard className="p-8 mb-6" delay={.05}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold tracking-widest uppercase mb-3" style={{ color: "var(--t3)" }}>Tracked Net Worth</p>
              <div className="text-6xl font-black mb-3 grad-text">
                ${netWorth.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold" style={{ color: "var(--green)" }}>+$73.40 today</span>
                <span className="text-base" style={{ color: "var(--t3)" }}>+1.18%</span>
              </div>
            </div>
            <div className="space-y-3 text-right">
              {[
                { l:"Crypto",  v:`$${cryptoTotal.toFixed(0)}`,        c:"var(--orange)" },
                { l:"Roth IRA",v:`$${iraTotal.toFixed(0)}`,           c:"var(--teal)"   },
                { l:"Savings", v:`$${savings.toLocaleString()}`,      c:"var(--green)"  },
              ].map(r => (
                <div key={r.l} className="flex items-center gap-4 justify-end">
                  <span className="text-base" style={{ color: "var(--t3)" }}>{r.l}</span>
                  <span className="text-xl font-black font-mono" style={{ color: r.c }}>{r.v}</span>
                </div>
              ))}
            </div>
          </div>
        </HudCard>

        <div className="grid grid-cols-2 gap-5">

          {/* Crypto */}
          <HudCard className="p-6" delay={.1}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold" style={{ color: "var(--t1)" }}>Crypto Holdings</h2>
              <div className="flex items-center gap-2 text-sm" style={{ color: "var(--t3)" }}>
                <span className="w-2 h-2 rounded-full" style={{ background: "var(--green)", animation: "pulse-dot 2s ease-in-out infinite", color: "var(--green)" }} />
                Robinhood · Live
              </div>
            </div>
            <div className="space-y-6">
              {CRYPTO.map(a => (
                <div key={a.symbol}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center text-base font-black"
                        style={{ background:`${a.color}12`, border:`1px solid ${a.color}25`, color:a.color }}>
                        {a.symbol[0]}
                      </div>
                      <div>
                        <div className="text-lg font-bold" style={{ color:"var(--t1)" }}>{a.symbol}
                          <span className="text-base font-normal ml-2" style={{ color:"var(--t3)" }}>{a.name}</span>
                        </div>
                        <div className="text-sm" style={{ color:"var(--t3)" }}>{a.hold}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold font-mono" style={{ color:"var(--t1)" }}>${a.price.toLocaleString()}</div>
                      <div className="text-base font-bold" style={{ color:a.c24>=0?"var(--green)":"var(--red)" }}>
                        {a.c24>=0?"+":""}{Number(a.c24).toFixed(2)}%
                      </div>
                    </div>
                  </div>
                  <Sparkline data={a.data} color={a.c24>=0?"var(--green)":"var(--red)"} height={44} id={`f-${a.symbol}`} />
                  <div className="flex justify-between mt-2 text-sm">
                    <span style={{ color:"var(--t3)" }}>7-day: <span style={{ color:a.c7>=0?"var(--green)":"var(--red)" }}>{a.c7>=0?"+":""}{Number(a.c7).toFixed(2)}%</span></span>
                    <span className="font-bold font-mono" style={{ color:"var(--t1)" }}>${a.value.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </HudCard>

          {/* Right col stacked */}
          <div className="flex flex-col gap-5">

            {/* Roth IRA */}
            <HudCard className="p-6" delay={.15}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-bold" style={{ color:"var(--t1)" }}>Roth IRA</h2>
                <span className="text-sm font-semibold px-2.5 py-1 rounded-full"
                  style={{ background:"rgba(6,182,212,0.08)", color:"var(--teal)", border:"1px solid rgba(6,182,212,0.15)" }}>
                  Schwab
                </span>
              </div>
              <div className="space-y-3">
                {IRA.map(f => (
                  <div key={f.symbol} className="flex items-center justify-between p-4 rounded-xl"
                    style={{ background:"rgba(6,182,212,0.03)", border:"1px solid rgba(6,182,212,0.07)" }}>
                    <div>
                      <div className="text-base font-bold" style={{ color:"var(--t1)" }}>{f.symbol}</div>
                      <div className="text-sm mt-0.5" style={{ color:"var(--t3)" }}>{f.name} · {f.shares} shares</div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-bold font-mono" style={{ color:"var(--t1)" }}>${f.value.toLocaleString()}</div>
                      <div className="text-sm" style={{ color:f.chg>=0?"var(--green)":"var(--red)" }}>
                        NAV ${f.nav} ({f.chg>=0?"+":""}{f.chg}%)
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between px-4 py-3 mt-3 rounded-xl"
                style={{ background:"rgba(6,182,212,0.05)", border:"1px solid rgba(6,182,212,0.1)" }}>
                <span className="text-base font-semibold" style={{ color:"var(--t2)" }}>Total IRA Value</span>
                <span className="text-xl font-black font-mono" style={{ color:"var(--teal)" }}>${iraTotal.toFixed(2)}</span>
              </div>
            </HudCard>

            {/* Emergency fund */}
            <HudCard className="p-6" delay={.2}>
              <h2 className="text-xl font-bold mb-5" style={{ color:"var(--t1)" }}>Emergency Fund</h2>
              <div className="flex items-center gap-6 mb-4">
                <svg width="90" height="90" viewBox="0 0 90 90">
                  <circle cx="45" cy="45" r="36" fill="none" stroke="rgba(139,92,246,0.1)" strokeWidth="5.5" />
                  <circle cx="45" cy="45" r="36" fill="none" stroke="var(--purple)" strokeWidth="5.5"
                    strokeDasharray={2*Math.PI*36} strokeDashoffset={2*Math.PI*36*(1-.28)}
                    strokeLinecap="round" transform="rotate(-90 45 45)"
                    style={{ filter:"drop-shadow(0 0 8px rgba(139,92,246,.5))", transition:"stroke-dashoffset 1s ease" }} />
                  <text x="45" y="42" textAnchor="middle" fontSize="16" fontWeight="900" fill="var(--t1)">28%</text>
                  <text x="45" y="59" textAnchor="middle" fontSize="10" fill="var(--t3)">complete</text>
                </svg>
                <div>
                  <div className="text-3xl font-black" style={{ color:"var(--t1)" }}>$2,800</div>
                  <div className="text-base mt-1" style={{ color:"var(--purple)" }}>of $10,000 goal</div>
                  <div className="text-sm mt-1" style={{ color:"var(--t3)" }}>$7,200 remaining</div>
                </div>
              </div>
              <div className="px-4 py-3 rounded-xl text-sm"
                style={{ background:"rgba(139,92,246,0.05)", border:"1px solid rgba(139,92,246,0.1)" }}>
                <span style={{ color:"var(--purple)", fontWeight:700 }}>M.A.X. · </span>
                <span style={{ color:"var(--t2)" }}>
                  At current pace: December 2026. Add $200/mo to hit October instead.
                </span>
              </div>
            </HudCard>
          </div>
        </div>

        {/* Bills */}
        <HudCard className="p-6 mt-5" delay={.25}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-bold" style={{ color:"var(--t1)" }}>Upcoming Bills</h2>
            <span className="text-base font-semibold" style={{ color:"var(--t2)" }}>
              Monthly total: <span className="font-black" style={{ color:"var(--t1)" }}>${billsTotal.toFixed(2)}</span>
            </span>
          </div>
          <div className="grid grid-cols-5 gap-3">
            {BILLS.map(b => (
              <div key={b.name} className="p-4 rounded-xl text-center"
                style={{
                  background: b.due <= 5 ? "rgba(244,63,94,0.06)" : "rgba(6,182,212,0.03)",
                  border: `1px solid ${b.due <= 5 ? "rgba(244,63,94,0.15)" : "rgba(6,182,212,0.07)"}`,
                }}>
                <div className="text-base font-bold mb-1" style={{ color:"var(--t1)" }}>{b.name}</div>
                <div className="text-xl font-black font-mono mb-1.5"
                  style={{ color: b.due <= 5 ? "var(--red)" : "var(--t1)" }}>
                  ${b.amt.toFixed(0)}
                </div>
                <div className="text-xs font-semibold" style={{ color: b.due <= 5 ? "var(--red)" : "var(--t3)" }}>
                  {b.due <= 5 ? "⚠ " : ""}In {b.due} days
                </div>
              </div>
            ))}
          </div>
        </HudCard>
      </div>
    </div>
  );
}
