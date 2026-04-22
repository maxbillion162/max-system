"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router   = useRouter();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [mouse,    setMouse]    = useState({ x: 0, y: 0 });
  const [glow,     setGlow]     = useState(0.15);
  const [password, setPassword] = useState("");
  const [status,   setStatus]   = useState<"idle" | "loading" | "error" | "ok">("idle");
  const [shake,    setShake]    = useState(false);
  const [dots,     setDots]     = useState("");

  /* ── Check if already authenticated ── */
  useEffect(() => {
    try {
      if (sessionStorage.getItem("max-auth") === "1") router.replace("/dashboard");
    } catch {}
  }, [router]);

  /* ── Mouse tracking ── */
  useEffect(() => {
    function onMove(e: MouseEvent) { setMouse({ x: e.clientX, y: e.clientY }); }
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  /* ── Compute glow intensity + direction from mouse → title ── */
  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    const r  = el.getBoundingClientRect();
    const cx = r.left + r.width  / 2;
    const cy = r.top  + r.height / 2;
    const dist = Math.hypot(mouse.x - cx, mouse.y - cy);
    setGlow(Math.max(0.12, 1 - dist / 640));
  }, [mouse]);

  /* ── Loading dots animation ── */
  useEffect(() => {
    if (status !== "loading") { setDots(""); return; }
    const id = setInterval(() => setDots(d => d.length >= 3 ? "" : d + "."), 340);
    return () => clearInterval(id);
  }, [status]);

  /* ── Login ── */
  const handleLogin = useCallback(async () => {
    if (!password.trim() || status === "loading") return;
    setStatus("loading");
    try {
      const res = await fetch("/api/auth/login", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ password }),
      });
      if (res.ok) {
        setStatus("ok");
        try { sessionStorage.setItem("max-auth", "1"); } catch {}
        setTimeout(() => router.replace("/dashboard"), 600);
      } else {
        setStatus("error");
        setShake(true);
        setTimeout(() => { setShake(false); setStatus("idle"); setPassword(""); }, 1500);
      }
    } catch {
      setStatus("error");
      setTimeout(() => { setStatus("idle"); }, 1500);
    }
  }, [password, status, router]);

  /* ── Derived glow values ── */
  const el  = titleRef.current?.getBoundingClientRect();
  const cx  = el ? el.left + el.width  / 2 : (typeof window !== "undefined" ? window.innerWidth  / 2 : 760);
  const cy  = el ? el.top  + el.height / 2 : (typeof window !== "undefined" ? window.innerHeight / 2 : 300);
  const ang = Math.atan2(mouse.y - cy, mouse.x - cx);
  const sdx = Math.cos(ang) * glow * 6;
  const sdy = Math.sin(ang) * glow * 6;

  const titleShadow = [
    `${sdx}px ${sdy}px ${Math.round(8  + glow * 24)}px rgba(69,137,255,${(0.5  + glow * 0.5).toFixed(2)})`,
    `0 0 ${Math.round(30 + glow * 70)}px rgba(69,137,255,${(0.25 + glow * 0.55).toFixed(2)})`,
    `0 0 ${Math.round(60 + glow * 120)}px rgba(69,137,255,${(0.1  + glow * 0.3 ).toFixed(2)})`,
  ].join(", ");

  const borderGlow = status === "error"
    ? "rgba(239,68,68,0.6)"
    : status === "ok"
    ? "rgba(34,197,94,0.6)"
    : `rgba(69,137,255,${(0.2 + glow * 0.55).toFixed(2)})`;

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(160deg, #07080f 0%, #080b15 40%, #06080e 100%)",
      position: "relative", overflow: "hidden", fontFamily: "'Inter', 'SF Pro Display', sans-serif",
    }}>

      {/* ── CSS animations ── */}
      <style>{`
        @keyframes scanline {
          0%   { transform: translateY(-8px); opacity: 0; }
          50%  { opacity: 1; }
          100% { transform: translateY(100vh); opacity: 0; }
        }
        @keyframes flicker {
          0%,100% { opacity: 1; }
          92%     { opacity: 1; }
          93%     { opacity: 0.85; }
          94%     { opacity: 1; }
          96%     { opacity: 0.9; }
          97%     { opacity: 1; }
        }
        @keyframes corner-pulse {
          0%,100% { opacity: 0.4; }
          50%     { opacity: 0.9; }
        }
        @keyframes boot-in {
          0%   { opacity: 0; transform: translateY(18px) scale(0.98); }
          100% { opacity: 1; transform: translateY(0)    scale(1); }
        }
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%     { transform: translateX(-8px); }
          40%     { transform: translateX(8px); }
          60%     { transform: translateX(-5px); }
          80%     { transform: translateX(5px); }
        }
        @keyframes cursor-blink {
          0%,100% { opacity: 1; }
          50%     { opacity: 0; }
        }
      `}</style>

      {/* ── Fine grid ── */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: [
          "linear-gradient(rgba(69,137,255,0.018) 1px, transparent 1px)",
          "linear-gradient(90deg, rgba(69,137,255,0.018) 1px, transparent 1px)",
        ].join(","),
        backgroundSize: "44px 44px",
      }} />

      {/* ── Scan line ── */}
      <div style={{
        position: "absolute", left: 0, right: 0, height: 1, pointerEvents: "none",
        background: "linear-gradient(90deg, transparent 0%, rgba(69,137,255,0.12) 30%, rgba(69,137,255,0.25) 50%, rgba(69,137,255,0.12) 70%, transparent 100%)",
        animation: "scanline 7s linear infinite",
        zIndex: 2,
      }} />

      {/* ── Mouse-following glow behind title ── */}
      <div style={{
        position: "fixed",
        left: mouse.x, top: mouse.y,
        transform: "translate(-50%, -50%)",
        width: 500, height: 500, borderRadius: "50%",
        background: `radial-gradient(circle, rgba(69,137,255,${(glow * 0.06).toFixed(3)}) 0%, transparent 65%)`,
        pointerEvents: "none", transition: "background .15s ease", zIndex: 1,
      }} />

      {/* ── Corner HUD decorations ── */}
      {([
        { pos: { top: 20, left: 20 } as React.CSSProperties,     border: { borderLeft: "1px solid rgba(69,137,255,0.3)", borderTop: "1px solid rgba(69,137,255,0.3)" } },
        { pos: { top: 20, right: 20 } as React.CSSProperties,    border: { borderRight:"1px solid rgba(69,137,255,0.3)", borderTop: "1px solid rgba(69,137,255,0.3)" } },
        { pos: { bottom:20,left: 20 } as React.CSSProperties,    border: { borderLeft: "1px solid rgba(69,137,255,0.3)", borderBottom:"1px solid rgba(69,137,255,0.3)" } },
        { pos: { bottom:20,right: 20 } as React.CSSProperties,   border: { borderRight:"1px solid rgba(69,137,255,0.3)", borderBottom:"1px solid rgba(69,137,255,0.3)" } },
      ] as { pos: React.CSSProperties; border: React.CSSProperties }[]).map(({ pos, border }, i) => (
        <div key={i} style={{
          position: "absolute", width: 20, height: 20,
          animation: "corner-pulse 3s ease-in-out infinite",
          animationDelay: `${i * 0.4}s`,
          ...border, ...pos,
        }} />
      ))}

      {/* ── System metadata top-left ── */}
      <div style={{
        position: "absolute", top: 32, left: 40,
        fontFamily: "monospace", fontSize: 10, color: "rgba(69,137,255,0.3)",
        letterSpacing: "0.12em", lineHeight: 1.8, zIndex: 5,
        animation: "boot-in .6s ease .2s both",
      }}>
        <div>SYS // MAX-OS v3.2.1</div>
        <div>ENCRYPTION // AES-256</div>
        <div>NODE // SECURE-01</div>
      </div>

      {/* ── Timestamp top-right ── */}
      <div style={{
        position: "absolute", top: 32, right: 40,
        fontFamily: "monospace", fontSize: 10, color: "rgba(69,137,255,0.3)",
        letterSpacing: "0.12em", textAlign: "right", zIndex: 5,
        animation: "boot-in .6s ease .2s both",
      }}>
        <div>{new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</div>
        <div style={{ color: "rgba(34,197,94,0.4)" }}>● SYSTEM NOMINAL</div>
      </div>

      {/* ── MAIN CARD ── */}
      <div style={{
        position: "relative", zIndex: 10,
        display: "flex", flexDirection: "column", alignItems: "center",
        animation: "boot-in .7s ease .1s both",
      }}>

        {/* Access classification badge */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "5px 16px", borderRadius: 2, marginBottom: 32,
          background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)",
          letterSpacing: "0.2em", fontSize: 10, fontWeight: 700,
          color: "rgba(239,68,68,0.7)", textTransform: "uppercase",
        }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#ef4444", boxShadow: "0 0 6px #ef4444", display: "inline-block", animation: "pulse-dot 1.5s ease-in-out infinite" }} />
          Restricted Access — Authorized Personnel Only
        </div>

        {/* ── M.A.X. TITLE ── */}
        <h1
          ref={titleRef}
          style={{
            fontSize: "clamp(64px, 12vw, 112px)",
            fontWeight: 900,
            letterSpacing: "-0.01em",
            color: "#e8f0ff",
            lineHeight: 1,
            marginBottom: 14,
            userSelect: "none",
            animation: "flicker 8s ease-in-out infinite",
            textShadow: titleShadow,
            transition: "text-shadow .08s ease",
          }}
        >
          M.A.X.
        </h1>

        {/* Subtitle */}
        <p style={{
          fontSize: 11, fontWeight: 700, letterSpacing: "0.28em",
          textTransform: "uppercase", color: "rgba(69,137,255,0.45)",
          marginBottom: 6, fontFamily: "monospace",
        }}>
          Maximum Adaptive eXecutive
        </p>
        <p style={{
          fontSize: 11, fontWeight: 600, letterSpacing: "0.18em",
          textTransform: "uppercase", color: "rgba(148,163,184,0.25)",
          marginBottom: 52, fontFamily: "monospace",
        }}>
          Personal AI · Secure Terminal
        </p>

        {/* ── AUTH PANEL ── */}
        <div style={{
          width: 380, maxWidth: "90vw",
          background: "rgba(8,11,22,0.85)",
          border: `1px solid ${borderGlow}`,
          borderRadius: 4,
          padding: "28px 32px",
          backdropFilter: "blur(12px)",
          boxShadow: `0 0 40px rgba(69,137,255,${(glow * 0.1).toFixed(3)}), 0 24px 60px rgba(0,0,0,0.6)`,
          transition: "border-color .2s ease, box-shadow .2s ease",
          animation: shake ? "shake 0.35s ease" : "none",
        }}>

          {/* Panel header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(69,137,255,0.5)", fontFamily: "monospace" }}>
              SECURE ACCESS PORTAL
            </span>
            <div style={{ display: "flex", gap: 5 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: ["#ef4444","#f59e0b","#22c55e"][i], opacity: 0.5 }} />
              ))}
            </div>
          </div>

          <div style={{ height: 1, background: "rgba(69,137,255,0.08)", marginBottom: 24 }} />

          {/* Prompt */}
          <div style={{ fontFamily: "monospace", fontSize: 11, color: "rgba(69,137,255,0.4)", marginBottom: 12, letterSpacing: "0.08em" }}>
            {`> ENTER PASSPHRASE TO AUTHENTICATE`}
          </div>

          {/* Input */}
          <div style={{ position: "relative", marginBottom: 16 }}>
            <div style={{
              display: "flex", alignItems: "center",
              background: "rgba(69,137,255,0.04)",
              border: `1px solid ${status === "error" ? "rgba(239,68,68,0.5)" : status === "ok" ? "rgba(34,197,94,0.5)" : "rgba(69,137,255,0.15)"}`,
              borderRadius: 3, padding: "11px 14px", gap: 8,
              transition: "border-color .2s",
            }}
              onFocus={() => (inputRef.current?.focus())}
            >
              <span style={{ fontFamily: "monospace", fontSize: 12, color: "rgba(69,137,255,0.3)" }}>_</span>
              <input
                ref={inputRef}
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                autoFocus
                placeholder="••••••••••••"
                disabled={status === "loading" || status === "ok"}
                style={{
                  flex: 1, background: "none", border: "none", outline: "none",
                  fontFamily: "monospace", fontSize: 14, color: "#e8f0ff",
                  letterSpacing: "0.1em",
                }}
              />
              {status === "loading" && (
                <span style={{ fontFamily: "monospace", fontSize: 12, color: "rgba(69,137,255,0.5)", width: 24 }}>{dots}</span>
              )}
              {status === "ok" && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              )}
              {status === "error" && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              )}
            </div>
          </div>

          {/* Error message */}
          {status === "error" && (
            <div style={{
              fontFamily: "monospace", fontSize: 11, color: "rgba(239,68,68,0.8)",
              marginBottom: 14, letterSpacing: "0.06em",
            }}>
              &gt; ACCESS DENIED — INVALID CREDENTIALS
            </div>
          )}
          {status === "ok" && (
            <div style={{
              fontFamily: "monospace", fontSize: 11, color: "rgba(34,197,94,0.8)",
              marginBottom: 14, letterSpacing: "0.06em",
            }}>
              &gt; IDENTITY CONFIRMED — LOADING SYSTEM
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleLogin}
            disabled={status === "loading" || status === "ok" || !password.trim()}
            style={{
              width: "100%", padding: "11px 0", borderRadius: 3,
              fontFamily: "monospace", fontSize: 12, fontWeight: 700,
              letterSpacing: "0.18em", textTransform: "uppercase",
              cursor: password.trim() && status === "idle" ? "pointer" : "default",
              background: status === "ok"
                ? "rgba(34,197,94,0.12)"
                : `rgba(69,137,255,${password.trim() ? "0.1" : "0.04"})`,
              border: status === "ok"
                ? "1px solid rgba(34,197,94,0.4)"
                : `1px solid rgba(69,137,255,${password.trim() ? "0.3" : "0.1"})`,
              color: status === "ok"
                ? "rgba(34,197,94,0.9)"
                : password.trim() ? "#e8f0ff" : "rgba(148,163,184,0.3)",
              transition: "all .15s ease",
            }}
          >
            {status === "loading" ? `Authenticating${dots}` : status === "ok" ? "Access Granted" : "Authenticate →"}
          </button>

          {/* Footer */}
          <div style={{ marginTop: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 9, fontFamily: "monospace", color: "rgba(148,163,184,0.2)", letterSpacing: "0.12em" }}>
              SESSION ENCRYPTED
            </span>
            <span style={{ fontSize: 9, fontFamily: "monospace", color: "rgba(148,163,184,0.2)", letterSpacing: "0.12em" }}>
              M.A.X. OS
            </span>
          </div>
        </div>
      </div>

      {/* ── Bottom status bar ── */}
      <div style={{
        position: "absolute", bottom: 28, left: 0, right: 0,
        display: "flex", justifyContent: "center", gap: 32,
        animation: "boot-in .6s ease .4s both",
        zIndex: 5,
      }}>
        {[
          { dot: "rgba(34,197,94,0.6)",    label: "NEURAL CORE ACTIVE" },
          { dot: "rgba(69,137,255,0.6)",   label: "256-BIT ENCRYPTED" },
          { dot: "rgba(245,158,11,0.6)",   label: "REAL-TIME DATA FEEDS" },
        ].map(s => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 4, height: 4, borderRadius: "50%", background: s.dot, display: "inline-block", boxShadow: `0 0 4px ${s.dot}` }} />
            <span style={{ fontSize: 9, fontFamily: "monospace", color: "rgba(148,163,184,0.2)", letterSpacing: "0.14em" }}>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
