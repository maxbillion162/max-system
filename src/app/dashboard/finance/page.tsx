"use client";

import { useState, useEffect } from "react";
import { HudCard } from "@/components/ui/HudCard";
import { Sparkline } from "@/components/ui/Sparkline";

const CRYPTO_FALLBACK = [
  { symbol:"BTC", name:"Bitcoin", price:94210.50, c24:3.24,  c7:8.1,  hold:"0.02 BTC", value:1884.21, data:[88200,89100,91400,90800,92300,93100,94210] },
  { symbol:"XRP", name:"Ripple",  price:2.18,     c24:-1.45, c7:12.3, hold:"200 XRP",  value:436.00,  data:[2.31,2.18,2.25,2.09,2.14,2.29,2.18] },
];
const IRA = [
  { symbol:"MDDVX", name:"Mid-Cap Growth Index", nav:42.18, chg:0.32,  value:1200, shares:28.45 },
  { symbol:"RPEAX", name:"Real Assets Fund",     nav:11.44, chg:-0.18, value:880,  shares:76.92 },
  { symbol:"PTTRX", name:"Total Return Bond",    nav:9.87,  chg:0.05,  value:640,  shares:64.84 },
];
const BILLS = [
  { name:"Rent",    amt:950,   due:11 },
  { name:"Spotify", amt:10.99, due:3  },
  { name:"Phone",   amt:75,    due:8  },
  { name:"Netflix", amt:15.49, due:18 },
  { name:"Gym",     amt:40,    due:22 },
];

export default function FinancePage() {
  const [liveData, setLiveData] = useState<typeof CRYPTO_FALLBACK>([]);

  useEffect(() => {
    fetch("/api/crypto").then(r => r.json()).then(j => {
      if (!j.data) return;
      const btc = j.data.find((d: {symbol:string}) => d.symbol === "BTC");
      const xrp = j.data.find((d: {symbol:string}) => d.symbol === "XRP");
      setLiveData([
        { symbol:"BTC", name:"Bitcoin", hold:"0.02 BTC",
          price: btc?.price ?? CRYPTO_FALLBACK[0].price,
          c24:   btc?.change24h ?? CRYPTO_FALLBACK[0].c24,
          c7:    btc?.change7d  ?? CRYPTO_FALLBACK[0].c7,
          value: (btc?.price ?? CRYPTO_FALLBACK[0].price) * 0.02,
          data:  btc?.sparkline?.slice(-20) ?? CRYPTO_FALLBACK[0].data },
        { symbol:"XRP", name:"Ripple", hold:"200 XRP",
          price: xrp?.price ?? CRYPTO_FALLBACK[1].price,
          c24:   xrp?.change24h ?? CRYPTO_FALLBACK[1].c24,
          c7:    xrp?.change7d  ?? CRYPTO_FALLBACK[1].c7,
          value: (xrp?.price ?? CRYPTO_FALLBACK[1].price) * 200,
          data:  xrp?.sparkline?.slice(-20) ?? CRYPTO_FALLBACK[1].data },
      ]);
    }).catch(() => {});
  }, []);

  const CRYPTO     = liveData.length ? liveData : CRYPTO_FALLBACK;
  const cryptoTotal = CRYPTO.reduce((a,c) => a + c.value, 0);
  const iraTotal    = IRA.reduce((a,c) => a + c.value, 0);
  const savings     = 2800;
  const netWorth    = cryptoTotal + iraTotal + savings;
  const billsTotal  = BILLS.reduce((a,b) => a + b.amt, 0);

  return (
    <div style={{ padding: "40px 52px", background: "var(--bg)", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1100 }}>

        {/* Header */}
        <div className="afu" style={{ marginBottom: 36 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--blue)", opacity: 0.7, marginBottom: 8 }}>Finance Hub</p>
          <h1 style={{ fontSize: 36, fontWeight: 800, color: "var(--t1)", letterSpacing: "-0.02em", marginBottom: 6 }}>Portfolio</h1>
          <p style={{ fontSize: 14, color: "var(--t2)" }}>Crypto · Roth IRA · Savings · Bills — all in one place.</p>
        </div>

        {/* Net Worth Banner */}
        <HudCard style={{ padding: "32px 36px", marginBottom: 24 }} delay={.05}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--t3)", marginBottom: 12 }}>Tracked Net Worth</p>
              <div style={{ fontSize: 52, fontWeight: 800, color: "var(--t1)", fontFamily: "monospace", letterSpacing: "-0.02em", marginBottom: 8 }}>
                ${netWorth.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: "var(--green)" }}>+$73.40 today</span>
                <span style={{ fontSize: 14, color: "var(--t3)" }}>+1.18%</span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, textAlign: "right" }}>
              {[
                { l:"Crypto",   v:`$${cryptoTotal.toFixed(0)}`,   c:"var(--amber)" },
                { l:"Roth IRA", v:`$${iraTotal.toFixed(0)}`,      c:"var(--blue)"  },
                { l:"Savings",  v:`$${savings.toLocaleString()}`, c:"var(--green)" },
              ].map(r => (
                <div key={r.l} style={{ display: "flex", alignItems: "center", gap: 16, justifyContent: "flex-end" }}>
                  <span style={{ fontSize: 13, color: "var(--t3)" }}>{r.l}</span>
                  <span style={{ fontSize: 20, fontWeight: 800, fontFamily: "monospace", color: r.c }}>{r.v}</span>
                </div>
              ))}
            </div>
          </div>
        </HudCard>

        {/* Crypto + Right col */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>

          {/* Crypto */}
          <HudCard style={{ padding: "28px 28px" }} delay={.1}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--t1)" }}>Crypto Holdings</h2>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--t3)" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green)", animation: "pulse-dot 2s ease-in-out infinite", display: "inline-block" }} />
                Robinhood · Live
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
              {CRYPTO.map(a => (
                <div key={a.symbol}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 14, fontWeight: 800, background: "var(--surface2)", border: "1px solid var(--border2)", color: "var(--t1)"
                      }}>{a.symbol[0]}</div>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--t1)" }}>{a.symbol} <span style={{ fontSize: 13, fontWeight: 400, color: "var(--t3)" }}>{a.name}</span></div>
                        <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2 }}>{a.hold}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "monospace", color: "var(--t1)" }}>${a.price.toLocaleString("en-US", { maximumFractionDigits: a.symbol === "BTC" ? 0 : 4 })}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: a.c24 >= 0 ? "var(--green)" : "var(--red)" }}>
                        {a.c24 >= 0 ? "+" : ""}{Number(a.c24).toFixed(2)}%
                      </div>
                    </div>
                  </div>
                  <Sparkline data={a.data} color={a.c24 >= 0 ? "var(--green)" : "var(--red)"} height={48} id={`f-${a.symbol}`} />
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12 }}>
                    <span style={{ color: "var(--t3)" }}>7-day: <span style={{ color: a.c7 >= 0 ? "var(--green)" : "var(--red)", fontWeight: 600 }}>{a.c7 >= 0 ? "+" : ""}{Number(a.c7).toFixed(2)}%</span></span>
                    <span style={{ fontWeight: 700, fontFamily: "monospace", color: "var(--t1)" }}>${a.value.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </HudCard>

          {/* Right: IRA + Emergency Fund */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Roth IRA */}
            <HudCard style={{ padding: "28px 28px" }} delay={.15}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--t1)" }}>Roth IRA</h2>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 4, background: "rgba(69,137,255,0.1)", color: "var(--blue)", border: "1px solid rgba(69,137,255,0.2)" }}>Schwab</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {IRA.map(f => (
                  <div key={f.symbol} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderRadius: 6, background: "var(--surface2)", border: "1px solid var(--border)" }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--t1)" }}>{f.symbol}</div>
                      <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2 }}>{f.name} · {f.shares} shares</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "monospace", color: "var(--t1)" }}>${f.value.toLocaleString()}</div>
                      <div style={{ fontSize: 12, color: f.chg >= 0 ? "var(--green)" : "var(--red)", marginTop: 2 }}>
                        NAV ${f.nav} ({f.chg >= 0 ? "+" : ""}{f.chg}%)
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", marginTop: 12, borderRadius: 6, background: "var(--surface3)", border: "1px solid var(--border2)" }}>
                <span style={{ fontSize: 13, color: "var(--t2)" }}>Total IRA Value</span>
                <span style={{ fontSize: 18, fontWeight: 800, fontFamily: "monospace", color: "var(--blue)" }}>${iraTotal.toFixed(2)}</span>
              </div>
            </HudCard>

            {/* Emergency Fund */}
            <HudCard style={{ padding: "28px 28px" }} delay={.2}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--t1)", marginBottom: 20 }}>Emergency Fund</h2>
              <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 16 }}>
                <svg width="84" height="84" viewBox="0 0 84 84" style={{ flexShrink: 0 }}>
                  <circle cx="42" cy="42" r="34" fill="none" stroke="var(--border2)" strokeWidth="5" />
                  <circle cx="42" cy="42" r="34" fill="none" stroke="var(--blue)" strokeWidth="5"
                    strokeDasharray={2*Math.PI*34} strokeDashoffset={2*Math.PI*34*(1-.28)}
                    strokeLinecap="round" transform="rotate(-90 42 42)"
                    style={{ transition: "stroke-dashoffset 1s ease" }} />
                  <text x="42" y="38" textAnchor="middle" fontSize="14" fontWeight="800" fill="var(--t1)">28%</text>
                  <text x="42" y="54" textAnchor="middle" fontSize="10" fill="var(--t3)">complete</text>
                </svg>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "var(--t1)", fontFamily: "monospace" }}>$2,800</div>
                  <div style={{ fontSize: 13, color: "var(--blue)", marginTop: 4 }}>of $10,000 goal</div>
                  <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2 }}>$7,200 remaining</div>
                </div>
              </div>
              <div style={{ padding: "12px 16px", borderRadius: 6, background: "var(--surface2)", border: "1px solid var(--border)", fontSize: 13 }}>
                <span style={{ color: "var(--blue)", fontWeight: 700 }}>M.A.X. · </span>
                <span style={{ color: "var(--t2)" }}>At current pace: December 2026. Add $200/mo to hit October instead.</span>
              </div>
            </HudCard>
          </div>
        </div>

        {/* Bills */}
        <HudCard style={{ padding: "28px 28px" }} delay={.25}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--t1)" }}>Upcoming Bills</h2>
            <span style={{ fontSize: 13, color: "var(--t2)" }}>Monthly total: <span style={{ fontWeight: 800, color: "var(--t1)" }}>${billsTotal.toFixed(2)}</span></span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
            {BILLS.map(b => (
              <div key={b.name} style={{
                padding: "20px 16px", borderRadius: 6, textAlign: "center",
                background: b.due <= 5 ? "rgba(239,68,68,0.06)" : "var(--surface2)",
                border: `1px solid ${b.due <= 5 ? "rgba(239,68,68,0.2)" : "var(--border)"}`,
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t2)", marginBottom: 8 }}>{b.name}</div>
                <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "monospace", color: b.due <= 5 ? "var(--red)" : "var(--t1)", marginBottom: 6 }}>
                  ${b.amt.toFixed(0)}
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: b.due <= 5 ? "var(--red)" : "var(--t3)" }}>
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
