"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

/* ── Design tokens — locked to the v2 Quant Terminal system ── */
const C = {
  bg0: "#000000",
  bg1: "#060708",
  surf1: "#0a0c10",
  surf2: "#0e1218",
  surf3: "#131821",
  hair: "rgba(125,170,220,0.10)",
  hair2: "rgba(125,170,220,0.20)",
  hair3: "rgba(125,170,220,0.35)",
  accent: "#7DB8E8",
  accentHi: "#9DD4FF",
  accentLo: "#3B6E9C",
  t1: "#E8EEF5",
  t1b: "#B4C0D0",
  t2: "#8A98AD",
  t3: "#4A5566",
  t4: "#2A3140",
  up: "#4ADE80",
  down: "#F87171",
};
const MONO = `ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace`;

type Crypto = { symbol: string; price: number; change24h: number };

export default function AccessPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [now, setNow] = useState<Date | null>(null);
  const [mounted, setMounted] = useState<number>(0);
  const [uptime, setUptime] = useState(0);
  const [crypto, setCrypto] = useState<Crypto[] | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "ok">("idle");
  const [shake, setShake] = useState(false);
  const [clientMeta, setClientMeta] = useState<{ platform: string; tz: string; ua: string } | null>(null);

  /* Bounce if already authenticated */
  useEffect(() => {
    try {
      if (sessionStorage.getItem("max-auth") === "1") router.replace("/dashboard");
    } catch {}
  }, [router]);

  /* Live clock — updates every second */
  useEffect(() => {
    setNow(new Date());
    setMounted(Date.now());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  /* Uptime ticker */
  useEffect(() => {
    if (!mounted) return;
    const id = setInterval(() => setUptime(Math.floor((Date.now() - mounted) / 1000)), 1000);
    return () => clearInterval(id);
  }, [mounted]);

  /* Client metadata — real values only */
  useEffect(() => {
    setClientMeta({
      platform: navigator.platform || "—",
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "—",
      ua: /Chrome/.test(navigator.userAgent) ? "Chrome" : /Safari/.test(navigator.userAgent) ? "Safari" : /Firefox/.test(navigator.userAgent) ? "Firefox" : "Browser",
    });
  }, []);

  /* Live market data (public — safe to fetch pre-auth) */
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const r = await fetch("/api/crypto", { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        if (alive && Array.isArray(j.data)) setCrypto(j.data);
      } catch {}
    }
    load();
    const id = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const handleLogin = useCallback(async () => {
    if (!password.trim() || status === "loading") return;
    setStatus("loading");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        setStatus("ok");
        try { sessionStorage.setItem("max-auth", "1"); } catch {}
        setTimeout(() => router.replace("/dashboard"), 500);
      } else {
        setStatus("error");
        setShake(true);
        setTimeout(() => { setShake(false); setStatus("idle"); setPassword(""); }, 1400);
      }
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 1400);
    }
  }, [password, status, router]);

  const timeStr = now ? now.toLocaleTimeString("en-US", { hour12: false, timeZone: "America/New_York" }) : "--:--:--";
  const dateStr = now ? now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "2-digit", year: "numeric" }).toUpperCase() : "";
  const doy = now ? Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86_400_000) : 0;
  const upStr = `${String(Math.floor(uptime / 3600)).padStart(2, "0")}:${String(Math.floor((uptime % 3600) / 60)).padStart(2, "0")}:${String(uptime % 60).padStart(2, "0")}`;

  const nyMarketOpen = (() => {
    if (!now) return false;
    const ny = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const day = ny.getDay();
    const mins = ny.getHours() * 60 + ny.getMinutes();
    return day >= 1 && day <= 5 && mins >= 570 && mins < 960;
  })();

  return (
    <div style={{
      minHeight: "100vh",
      background: `radial-gradient(1200px 600px at 50% 110%, rgba(61,107,160,0.08), transparent 70%), linear-gradient(180deg, ${C.bg0} 0%, ${C.bg1} 100%)`,
      color: C.t1,
      fontFamily: "'Inter', system-ui, sans-serif",
      display: "grid",
      gridTemplateRows: "44px 1fr 28px",
      overflow: "hidden",
    }}>
      <style>{`
        @keyframes boot { from { opacity:0; transform: translateY(6px); } to { opacity:1; transform: translateY(0);} }
        @keyframes pulse { 0%,100% { opacity: 0.55; } 50% { opacity: 1; } }
        @keyframes shake { 0%,100%{transform:translateX(0);} 25%{transform:translateX(-6px);} 75%{transform:translateX(6px);} }
        @keyframes sweep { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        *::selection { background: ${C.accent}; color: ${C.bg0}; }
        input::placeholder { color: ${C.t3}; }
      `}</style>

      {/* ═══ TOP BAR ═══ */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "center",
        padding: "0 20px",
        borderBottom: `1px solid ${C.hair}`,
        background: C.bg1,
        fontFamily: MONO,
        fontSize: 11,
        color: C.t2,
        letterSpacing: "0.08em",
      }}>
        <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
          <span style={{ color: C.accent, fontWeight: 700, fontSize: 10, letterSpacing: "0.24em" }}>M.A.X.</span>
          <span style={{ color: C.t3 }}>MAXIMUM ADAPTIVE EXECUTIVE</span>
        </div>
        <div style={{ display: "flex", gap: 22, alignItems: "center", justifyContent: "center", color: C.t1 }}>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{timeStr}</span>
          <span style={{ color: C.t3 }}>ET</span>
          <span style={{ color: C.t2 }}>{dateStr}</span>
          <span style={{ color: C.t3 }}>DOY {String(doy).padStart(3, "0")}</span>
        </div>
        <div style={{ display: "flex", gap: 14, justifyContent: "flex-end", alignItems: "center" }}>
          <StatusDot color={nyMarketOpen ? C.up : C.t3} />
          <span style={{ color: nyMarketOpen ? C.t1b : C.t2 }}>NYSE {nyMarketOpen ? "OPEN" : "CLOSED"}</span>
          <span style={{ color: C.t3 }}>|</span>
          <StatusDot color={C.up} />
          <span style={{ color: C.t1b }}>CRYPTO 24/7</span>
        </div>
      </div>

      {/* ═══ MAIN GRID ═══ */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "320px 1fr 320px",
        gap: 16,
        padding: 16,
        minHeight: 0,
      }}>

        {/* ── LEFT RAIL ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, animation: "boot .5s ease .05s both" }}>
          <Panel label="MARKETS / LIVE">
            <div style={{ display: "flex", flexDirection: "column" }}>
              {(crypto ?? [{ symbol: "BTC", price: 0, change24h: 0 }, { symbol: "XRP", price: 0, change24h: 0 }]).map((a, i) => (
                <TickerRow key={a.symbol} symbol={a.symbol} price={a.price} change={a.change24h} loading={!crypto} divider={i < 1} />
              ))}
            </div>
          </Panel>

          <Panel label="LOCAL">
            <KV label="TIMEZONE" value={clientMeta?.tz ?? "—"} />
            <KV label="CLIENT" value={clientMeta?.ua ?? "—"} />
            <KV label="PLATFORM" value={clientMeta?.platform ?? "—"} />
          </Panel>

          <Panel label="SESSION">
            <KV label="UPTIME" value={upStr} mono />
            <KV label="STATUS" value={<span style={{ color: C.up }}>● READY</span>} />
            <KV label="PROTOCOL" value="HTTPS / TLS 1.3" />
          </Panel>
        </div>

        {/* ── CENTER / AUTH ── */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          animation: "boot .6s ease 0s both",
        }}>
          <div style={{
            width: "100%",
            maxWidth: 440,
            background: `linear-gradient(180deg, ${C.surf2} 0%, ${C.surf1} 100%)`,
            border: `1px solid ${status === "error" ? "rgba(248,113,113,0.35)" : status === "ok" ? "rgba(74,222,128,0.35)" : C.hair2}`,
            borderRadius: 2,
            boxShadow: `inset 0 1px 0 rgba(125,170,220,0.06), 0 24px 60px rgba(0,0,0,0.6)`,
            padding: "28px 32px 24px",
            animation: shake ? "shake 0.35s ease" : undefined,
          }}>
            {/* Panel header */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontFamily: MONO,
              fontSize: 10,
              letterSpacing: "0.22em",
              color: C.t2,
              marginBottom: 28,
            }}>
              <span>AUTHENTICATION</span>
              <span style={{ color: C.t3 }}>v2.0</span>
            </div>

            {/* Hero mark */}
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <div style={{
                fontSize: 52,
                fontWeight: 800,
                letterSpacing: "-0.02em",
                color: C.t1,
                lineHeight: 1,
                marginBottom: 10,
              }}>
                M.A.X.
              </div>
              <div style={{
                fontFamily: MONO,
                fontSize: 10,
                letterSpacing: "0.28em",
                color: C.t3,
              }}>
                PERSONAL OPERATING SYSTEM
              </div>
            </div>

            {/* Touch ID — primary */}
            <button
              disabled
              title="Enable in Settings after first login"
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                padding: "14px 16px",
                marginBottom: 10,
                background: C.surf3,
                border: `1px solid ${C.hair}`,
                borderRadius: 2,
                color: C.t2,
                fontFamily: MONO,
                fontSize: 12,
                letterSpacing: "0.16em",
                cursor: "not-allowed",
                opacity: 0.75,
              }}
            >
              <TouchIdIcon />
              <span>SIGN IN WITH TOUCH ID</span>
              <span style={{ color: C.t3, fontSize: 9, letterSpacing: "0.2em", marginLeft: 6 }}>SETUP REQUIRED</span>
            </button>

            {/* Divider */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0" }}>
              <div style={{ flex: 1, height: 1, background: C.hair }} />
              <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.24em", color: C.t3 }}>OR</span>
              <div style={{ flex: 1, height: 1, background: C.hair }} />
            </div>

            {/* Passphrase */}
            {!showPass ? (
              <button
                onClick={() => { setShowPass(true); setTimeout(() => inputRef.current?.focus(), 50); }}
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  background: "transparent",
                  border: `1px solid ${C.hair2}`,
                  borderRadius: 2,
                  color: C.t1b,
                  fontFamily: MONO,
                  fontSize: 12,
                  letterSpacing: "0.16em",
                  cursor: "pointer",
                  transition: "border-color .15s, color .15s, background .15s",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = C.hair3;
                  (e.currentTarget as HTMLButtonElement).style.color = C.t1;
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(125,170,220,0.03)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = C.hair2;
                  (e.currentTarget as HTMLButtonElement).style.color = C.t1b;
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                }}
              >
                ENTER PASSPHRASE
              </button>
            ) : (
              <div>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  background: C.bg1,
                  border: `1px solid ${status === "error" ? "rgba(248,113,113,0.5)" : status === "ok" ? "rgba(74,222,128,0.5)" : C.hair2}`,
                  borderRadius: 2,
                  padding: "12px 14px",
                  marginBottom: 10,
                  transition: "border-color .15s",
                }}>
                  <span style={{ fontFamily: MONO, fontSize: 12, color: C.t3, marginRight: 10 }}>›</span>
                  <input
                    ref={inputRef}
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleLogin()}
                    placeholder="passphrase"
                    disabled={status === "loading" || status === "ok"}
                    style={{
                      flex: 1,
                      background: "transparent",
                      border: "none",
                      outline: "none",
                      fontFamily: MONO,
                      fontSize: 13,
                      color: C.t1,
                      letterSpacing: "0.08em",
                    }}
                  />
                </div>
                <button
                  onClick={handleLogin}
                  disabled={!password.trim() || status === "loading" || status === "ok"}
                  style={{
                    width: "100%",
                    padding: "13px 16px",
                    background: password.trim() && status === "idle"
                      ? `linear-gradient(180deg, ${C.accent}, ${C.accentLo})`
                      : C.surf3,
                    border: `1px solid ${password.trim() && status === "idle" ? C.accent : C.hair}`,
                    borderRadius: 2,
                    color: password.trim() && status === "idle" ? C.bg0 : C.t3,
                    fontFamily: MONO,
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: "0.2em",
                    cursor: password.trim() && status === "idle" ? "pointer" : "not-allowed",
                    transition: "all .15s",
                  }}
                >
                  {status === "loading" ? "AUTHENTICATING…" : status === "ok" ? "ACCESS GRANTED" : status === "error" ? "REJECTED" : "AUTHENTICATE"}
                </button>
              </div>
            )}

            {/* Footer strip */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 24,
              paddingTop: 14,
              borderTop: `1px solid ${C.hair}`,
              fontFamily: MONO,
              fontSize: 9,
              letterSpacing: "0.2em",
              color: C.t3,
            }}>
              <span>SINGLE-OPERATOR TERMINAL</span>
              <span>ENCRYPTED SESSION</span>
            </div>
          </div>
        </div>

        {/* ── RIGHT RAIL ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, animation: "boot .5s ease .1s both" }}>
          <Panel label="SYSTEM">
            <KV label="BUILD" value="v2.0.0" />
            <KV label="ENV" value="PRODUCTION" />
            <KV label="REGION" value="US-EAST" />
            <KV label="NODE" value="ACTIVE" valueColor={C.up} />
          </Panel>

          <Panel label="INTELLIGENCE">
            <KV label="MODEL" value="HAIKU 4.5" />
            <KV label="CONTEXT" value="200K" />
            <KV label="TOOLS" value="35 ONLINE" valueColor={C.accent} />
          </Panel>

          <Panel label="SURFACES">
            <SurfaceRow label="WEB" active />
            <SurfaceRow label="CHAT BUBBLE" active />
            <SurfaceRow label="TELEGRAM" active />
            <SurfaceRow label="VOICE" active={false} />
          </Panel>
        </div>
      </div>

      {/* ═══ BOTTOM BAR ═══ */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "0 20px",
        borderTop: `1px solid ${C.hair}`,
        background: C.bg1,
        fontFamily: MONO,
        fontSize: 10,
        letterSpacing: "0.16em",
        color: C.t3,
      }}>
        <span>© MAXWELL OPERATING SYSTEM · ALL RIGHTS RESERVED</span>
        <span style={{ display: "flex", gap: 18 }}>
          <span>VERCEL / EDGE</span>
          <span style={{ color: C.t2 }}>{now ? `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}` : ""}</span>
        </span>
      </div>
    </div>
  );
}

/* ══════════════ Subcomponents ══════════════ */

function Panel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: C.surf1,
      border: `1px solid ${C.hair}`,
      borderRadius: 2,
      boxShadow: `inset 0 1px 0 rgba(125,170,220,0.04)`,
    }}>
      <div style={{
        padding: "9px 14px",
        borderBottom: `1px solid ${C.hair}`,
        fontFamily: MONO,
        fontSize: 10,
        letterSpacing: "0.24em",
        color: C.t2,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <span>{label}</span>
        <span style={{ color: C.t4 }}>●</span>
      </div>
      <div style={{ padding: "10px 14px" }}>
        {children}
      </div>
    </div>
  );
}

function KV({ label, value, mono, valueColor }: { label: string; value: React.ReactNode; mono?: boolean; valueColor?: string }) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline",
      padding: "6px 0",
      fontSize: 11,
    }}>
      <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.18em", color: C.t3 }}>{label}</span>
      <span style={{
        fontFamily: mono ? MONO : "'Inter', sans-serif",
        fontVariantNumeric: "tabular-nums",
        color: valueColor ?? C.t1b,
        fontSize: mono ? 11 : 12,
      }}>{value}</span>
    </div>
  );
}

function TickerRow({ symbol, price, change, loading, divider }: { symbol: string; price: number; change: number; loading: boolean; divider: boolean }) {
  const up = change >= 0;
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "auto 1fr auto",
      alignItems: "center",
      gap: 10,
      padding: "10px 0",
      borderBottom: divider ? `1px solid ${C.hair}` : undefined,
    }}>
      <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.12em", color: C.t1, fontWeight: 600 }}>{symbol}</span>
      <span style={{
        fontFamily: MONO,
        fontSize: 13,
        color: loading ? C.t3 : C.t1,
        fontVariantNumeric: "tabular-nums",
        textAlign: "right",
      }}>
        {loading ? "—" : `$${price.toLocaleString(undefined, { maximumFractionDigits: price < 10 ? 4 : 2 })}`}
      </span>
      <span style={{
        fontFamily: MONO,
        fontSize: 10,
        color: loading ? C.t3 : up ? C.up : C.down,
        fontVariantNumeric: "tabular-nums",
        minWidth: 56,
        textAlign: "right",
      }}>
        {loading ? "—" : `${up ? "+" : ""}${change.toFixed(2)}%`}
      </span>
    </div>
  );
}

function SurfaceRow({ label, active }: { label: string; active: boolean }) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "6px 0",
    }}>
      <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.2em", color: C.t2 }}>{label}</span>
      <span style={{
        fontFamily: MONO,
        fontSize: 9,
        letterSpacing: "0.22em",
        color: active ? C.up : C.t3,
      }}>
        {active ? "● ONLINE" : "○ OFFLINE"}
      </span>
    </div>
  );
}

function StatusDot({ color }: { color: string }) {
  return (
    <span style={{
      width: 6,
      height: 6,
      borderRadius: "50%",
      background: color,
      boxShadow: `0 0 6px ${color}`,
      display: "inline-block",
      animation: "pulse 2.4s ease-in-out infinite",
    }} />
  );
}

function TouchIdIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a9 9 0 0 0-9 9" />
      <path d="M21 11a9 9 0 0 0-3.5-7.1" />
      <path d="M7 13c0-2.8 2.2-5 5-5s5 2.2 5 5v2" />
      <path d="M12 13v5" />
      <path d="M7 17c0 1.7.4 3 1 4" />
      <path d="M17 19v2" />
    </svg>
  );
}
