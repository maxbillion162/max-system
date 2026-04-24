"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

/* Palette — darker surfaces, but text tiers bumped for readability */
const C = {
  bg: "#000000",
  bgSoft: "#040608",
  surf: "#0a0d12",
  surfHi: "#10141c",
  hair: "rgba(125,170,220,0.08)",
  hair2: "rgba(125,170,220,0.18)",
  hair3: "rgba(125,170,220,0.35)",
  accent: "#7DB8E8",
  accentDim: "rgba(125,184,232,0.55)",
  t1: "#E4EAF2",
  t2: "#8794A6",
  t3: "#525C6B",
  t4: "#2E3440",
  err: "#C85A5A",
  ok: "#5FB07D",
};
const MONO = `ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace`;

const WORD = ["M", ".", "A", ".", "X", "."];

/* Mix two hex colors by ratio (0..1) */
function mixHex(a: string, b: string, r: number): string {
  const pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
  const pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
  const out = pa.map((v, i) => Math.round(v + (pb[i] - v) * r));
  return `rgb(${out[0]}, ${out[1]}, ${out[2]})`;
}

export default function AccessPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const wordRef = useRef<HTMLDivElement>(null);
  const letterRefs = useRef<(HTMLSpanElement | null)[]>([]);

  const [now, setNow] = useState<Date | null>(null);
  const [mode, setMode] = useState<"idle" | "pass">("idle");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "ok">("idle");
  const [shake, setShake] = useState(false);
  const [proximity, setProximity] = useState<number[]>(() => WORD.map(() => 0));

  useEffect(() => {
    try { if (sessionStorage.getItem("max-auth") === "1") router.replace("/dashboard"); } catch {}
  }, [router]);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  /* Cursor-proximity weight-breathe on the wordmark */
  useEffect(() => {
    const el = wordRef.current;
    if (!el) return;
    let raf = 0;
    function onMove(e: MouseEvent) {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const next = letterRefs.current.map(lref => {
          if (!lref) return 0;
          const r = lref.getBoundingClientRect();
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          const d = Math.hypot(e.clientX - cx, e.clientY - cy);
          return Math.max(0, Math.min(1, 1 - d / 120));
        });
        setProximity(next);
      });
    }
    function onLeave() { setProximity(WORD.map(() => 0)); }
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
      cancelAnimationFrame(raf);
    };
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
      background: C.bg,
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
        @keyframes letter-in {
          0%   { opacity: 0; transform: translateY(16px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes hair-draw { from { width: 0; opacity: 0; } to { width: 56px; opacity: 1; } }
        *::selection { background: ${C.accent}; color: ${C.bg}; }
        input::placeholder { color: ${C.t3}; }
      `}</style>


      {/* Camera framing marks — precision instrument cue, not hacker UI */}
      {[
        { top: 24, left: 24, rot: 0 },
        { top: 24, right: 24, rot: 90 },
        { bottom: 24, right: 24, rot: 180 },
        { bottom: 24, left: 24, rot: 270 },
      ].map((m, i) => (
        <div key={i} style={{
          position: "absolute", width: 14, height: 14, ...m,
          zIndex: 3, opacity: 0.22,
          animation: `fade 1.2s ease ${1.2 + i * 0.08}s both`,
        }}>
          <svg viewBox="0 0 14 14" style={{ transform: `rotate(${m.rot}deg)` }}>
            <path d="M0 0 L14 0 M0 0 L0 14" stroke={C.accent} strokeWidth="1" fill="none" />
          </svg>
        </div>
      ))}


      {/* Quiet timestamp — top-right, almost invisible */}
      <div style={{
        position: "absolute", top: 28, right: 32, zIndex: 5,
        fontFamily: MONO, fontSize: 10, letterSpacing: "0.2em", color: C.t3,
        animation: "fade .8s ease .3s both",
      }}>
        {timeStr}<span style={{ color: C.t4, marginLeft: 8 }}>ET</span>
      </div>

      {/* Main composition */}
      <div style={{
        position: "relative", zIndex: 5,
        display: "flex", flexDirection: "column", alignItems: "center",
        width: "100%", maxWidth: 420, padding: "0 24px",
        animation: shake ? "shake 0.35s ease" : "fade-up .8s ease .1s both",
      }}>

        {/* Hero mark — stagger-in with ice-blue ignition + cursor-proximity spotlight */}
        <div
          ref={wordRef}
          style={{
            display: "flex",
            fontSize: "clamp(80px, 9vw, 108px)",
            letterSpacing: "-0.035em",
            lineHeight: 1,
            marginBottom: 24,
            cursor: "default",
          }}
        >
          {WORD.map((ch, i) => {
            const p = proximity[i] ?? 0;
            /* Polished-metal fill. Hover shifts only the lower stops toward
               ice-blue — top stays near-white. Whisper, not a wash. */
            const topHex = mixHex("#F4F7FB", "#DDEBFA", p * 0.5);
            const midHex = mixHex("#D9E0EB", "#A8CDEC", p * 0.85);
            const lowHex = mixHex("#A8B4C6", "#7DB8E8", p * 0.9);
            const botHex = mixHex("#8C9AAF", "#5A9AD0", p * 0.9);
            const grad = `linear-gradient(180deg, ${topHex} 0%, ${midHex} 40%, ${lowHex} 80%, ${botHex} 100%)`;
            return (
              <span
                key={i}
                ref={el => { letterRefs.current[i] = el; }}
                style={{
                  display: "inline-block",
                  fontWeight: 800,
                  backgroundImage: grad,
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  color: "transparent",
                  filter: p > 0.05
                    ? `drop-shadow(0 0 ${6 + p * 14}px rgba(125,184,232,${0.22 + p * 0.28})) drop-shadow(0 2px 14px rgba(0,0,0,0.55))`
                    : "drop-shadow(0 2px 14px rgba(0,0,0,0.55))",
                  transition: "background-image .45s ease, filter .45s ease",
                  animation: `letter-in .8s cubic-bezier(.2,.6,.2,1) ${0.1 + i * 0.06}s both`,
                  padding: "0 0.01em",
                }}
              >
                {ch}
              </span>
            );
          })}
        </div>

        {/* Accent hairline — draws in from center, then breathes */}
        <div style={{
          height: 1,
          maxWidth: 56,
          background: `linear-gradient(90deg, transparent, ${C.accent}, transparent)`,
          marginBottom: 28,
          animation: "hair-draw .7s cubic-bezier(.2,.6,.2,1) .85s both, hair-breathe 4s ease-in-out 1.6s infinite",
        }} />

        {/* Wordmark tagline — very quiet */}
        <div style={{
          fontFamily: MONO,
          fontSize: 10,
          letterSpacing: "0.34em",
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

      {/* Serial number — one-of-one limited edition cue */}
      <div style={{
        position: "absolute",
        bottom: 28,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 5,
        fontFamily: MONO,
        fontSize: 9,
        letterSpacing: "0.42em",
        color: C.t3,
        animation: "fade 1.2s ease 1.4s both",
      }}>
        <span style={{ color: C.t4 }}>№</span>
        <span style={{ margin: "0 10px", color: C.t2 }}>01</span>
        <span style={{ color: C.t4 }}>/</span>
        <span style={{ marginLeft: 10, color: C.t3 }}>01</span>
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
