"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

/* Darker, quieter palette — greys pushed down per feedback */
const C = {
  bg: "#000000",
  bgSoft: "#030406",
  surf: "#07090d",
  surfHi: "#0b0e14",
  hair: "rgba(125,170,220,0.06)",
  hair2: "rgba(125,170,220,0.14)",
  hair3: "rgba(125,170,220,0.28)",
  accent: "#7DB8E8",
  accentDim: "rgba(125,184,232,0.55)",
  t1: "#D4DCE6",
  t2: "#5A6472",
  t3: "#2E3440",
  t4: "#1A1E24",
  err: "#C85A5A",
  ok: "#5FB07D",
};
const MONO = `ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace`;

export default function AccessPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [now, setNow] = useState<Date | null>(null);
  const [mode, setMode] = useState<"idle" | "pass">("idle");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "ok">("idle");
  const [shake, setShake] = useState(false);

  useEffect(() => {
    try { if (sessionStorage.getItem("max-auth") === "1") router.replace("/dashboard"); } catch {}
  }, [router]);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
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
        setTimeout(() => router.replace("/dashboard"), 450);
      } else {
        setStatus("error");
        setShake(true);
        setTimeout(() => { setShake(false); setStatus("idle"); setPassword(""); }, 1300);
      }
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 1300);
    }
  }, [password, status, router]);

  const timeStr = now ? now.toLocaleTimeString("en-US", { hour12: false, timeZone: "America/New_York" }) : "";

  return (
    <div style={{
      minHeight: "100vh",
      background: `
        radial-gradient(900px 500px at 50% 120%, rgba(125,184,232,0.045), transparent 70%),
        radial-gradient(1200px 700px at 50% -10%, rgba(125,184,232,0.025), transparent 60%),
        linear-gradient(180deg, ${C.bg} 0%, ${C.bgSoft} 100%)
      `,
      color: C.t1,
      fontFamily: "'Inter', system-ui, sans-serif",
      position: "relative",
      overflow: "hidden",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <style>{`
        @keyframes fade-up { from { opacity: 0; transform: translateY(10px);} to { opacity: 1; transform: translateY(0);} }
        @keyframes fade { from { opacity: 0;} to { opacity: 1;} }
        @keyframes shake { 0%,100%{transform:translateX(0);} 25%{transform:translateX(-5px);} 75%{transform:translateX(5px);} }
        @keyframes hair-breathe { 0%,100% { opacity: 0.45; } 50% { opacity: 0.8; } }
        *::selection { background: ${C.accent}; color: ${C.bg}; }
        input::placeholder { color: ${C.t3}; }
      `}</style>

      {/* Ultra-subtle grid texture */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: `
          linear-gradient(${C.hair} 1px, transparent 1px),
          linear-gradient(90deg, ${C.hair} 1px, transparent 1px)
        `,
        backgroundSize: "64px 64px",
        maskImage: "radial-gradient(ellipse at center, black 0%, transparent 75%)",
        WebkitMaskImage: "radial-gradient(ellipse at center, black 0%, transparent 75%)",
        opacity: 0.5,
      }} />

      {/* Quiet timestamp — top-right, almost invisible */}
      <div style={{
        position: "absolute", top: 28, right: 32,
        fontFamily: MONO, fontSize: 10, letterSpacing: "0.2em", color: C.t3,
        animation: "fade .8s ease .3s both",
      }}>
        {timeStr}<span style={{ color: C.t4, marginLeft: 8 }}>ET</span>
      </div>

      {/* Main composition */}
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        width: "100%", maxWidth: 360, padding: "0 24px",
        animation: shake ? "shake 0.35s ease" : "fade-up .8s ease .1s both",
      }}>

        {/* Hero mark */}
        <div style={{
          fontSize: 68,
          fontWeight: 800,
          letterSpacing: "-0.03em",
          color: C.t1,
          lineHeight: 1,
          marginBottom: 20,
          textShadow: "0 0 40px rgba(125,184,232,0.04)",
        }}>
          M.A.X.
        </div>

        {/* Accent hairline — breathes slowly */}
        <div style={{
          width: 36, height: 1,
          background: `linear-gradient(90deg, transparent, ${C.accent}, transparent)`,
          marginBottom: 20,
          animation: "hair-breathe 4s ease-in-out infinite",
        }} />

        {/* Wordmark tagline — very quiet */}
        <div style={{
          fontFamily: MONO,
          fontSize: 10,
          letterSpacing: "0.32em",
          color: C.t2,
          marginBottom: 64,
          textTransform: "uppercase",
        }}>
          Maximum Adaptive Executive
        </div>

        {/* Auth actions */}
        <div style={{ width: "100%" }}>
          {/* Primary: Touch ID */}
          <button
            disabled
            title="Enable after first sign-in"
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              padding: "15px 18px",
              background: "transparent",
              border: `1px solid ${C.hair2}`,
              borderRadius: 2,
              color: C.t2,
              fontFamily: MONO,
              fontSize: 11,
              letterSpacing: "0.22em",
              cursor: "not-allowed",
              textTransform: "uppercase",
            }}
          >
            <TouchIdIcon />
            <span>Touch ID</span>
          </button>

          {/* Passphrase — secondary, expands inline */}
          {mode === "idle" ? (
            <button
              onClick={() => { setMode("pass"); setTimeout(() => inputRef.current?.focus(), 40); }}
              style={{
                width: "100%",
                marginTop: 10,
                padding: "15px 18px",
                background: "transparent",
                border: "none",
                color: C.t2,
                fontFamily: MONO,
                fontSize: 11,
                letterSpacing: "0.22em",
                cursor: "pointer",
                textTransform: "uppercase",
                transition: "color .15s",
              }}
              onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.color = C.t1)}
              onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.color = C.t2)}
            >
              Use passphrase
            </button>
          ) : (
            <div style={{ marginTop: 10, animation: "fade .25s ease both" }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                background: C.surf,
                border: `1px solid ${status === "error" ? "rgba(200,90,90,0.5)" : status === "ok" ? "rgba(95,176,125,0.5)" : C.hair2}`,
                borderRadius: 2,
                padding: "13px 16px",
                marginBottom: 8,
                transition: "border-color .15s",
              }}>
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
                    letterSpacing: "0.1em",
                  }}
                />
              </div>
              <button
                onClick={handleLogin}
                disabled={!password.trim() || status === "loading" || status === "ok"}
                style={{
                  width: "100%",
                  padding: "13px 18px",
                  background: password.trim() && status === "idle" ? C.accent : "transparent",
                  border: `1px solid ${password.trim() && status === "idle" ? C.accent : C.hair2}`,
                  borderRadius: 2,
                  color: password.trim() && status === "idle" ? C.bg : C.t2,
                  fontFamily: MONO,
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.24em",
                  textTransform: "uppercase",
                  cursor: password.trim() && status === "idle" ? "pointer" : "not-allowed",
                  transition: "all .15s",
                }}
              >
                {status === "loading" ? "Verifying" : status === "ok" ? "Authenticated" : status === "error" ? "Rejected" : "Enter"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TouchIdIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a9 9 0 0 0-9 9" />
      <path d="M21 11a9 9 0 0 0-3.5-7.1" />
      <path d="M7 13c0-2.8 2.2-5 5-5s5 2.2 5 5v2" />
      <path d="M12 13v5" />
      <path d="M7 17c0 1.7.4 3 1 4" />
      <path d="M17 19v2" />
    </svg>
  );
}
