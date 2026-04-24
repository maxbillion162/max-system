"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import MaxChatBubble from "@/components/ui/MaxChatBubble";
import NotificationBell from "@/components/ui/NotificationBell";

function AccessDenied() {
  const router = useRouter();
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(160deg, #07080f 0%, #080b15 40%, #06080e 100%)",
      fontFamily: "monospace", position: "relative", overflow: "hidden",
    }}>
      <style>{`
        @keyframes glitch {
          0%,100% { clip-path: inset(0 0 98% 0); transform: translate(0); }
          5%       { clip-path: inset(30% 0 50% 0); transform: translate(-4px, 2px); }
          10%      { clip-path: inset(70% 0 10% 0); transform: translate(4px, -2px); }
          15%      { clip-path: inset(0 0 98% 0); transform: translate(0); }
        }
        @keyframes scanline-err {
          0%   { transform: translateY(-8px); }
          100% { transform: translateY(100vh); }
        }
      `}</style>

      {/* Grid */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: "linear-gradient(rgba(200,90,90,0.015) 1px,transparent 1px),linear-gradient(90deg,rgba(200,90,90,0.015) 1px,transparent 1px)",
        backgroundSize: "44px 44px",
      }} />

      {/* Scan line */}
      <div style={{
        position: "absolute", left: 0, right: 0, height: 1, pointerEvents: "none",
        background: "linear-gradient(90deg,transparent,rgba(200,90,90,0.15) 50%,transparent)",
        animation: "scanline-err 5s linear infinite",
      }} />

      {/* Corner decorations */}
      {[
        { top: 20, left: 20,   borderLeft: "1px solid rgba(200,90,90,0.25)", borderTop: "1px solid rgba(200,90,90,0.25)"    },
        { top: 20, right: 20,  borderRight:"1px solid rgba(200,90,90,0.25)", borderTop: "1px solid rgba(200,90,90,0.25)"    },
        { bottom:20,left: 20,  borderLeft: "1px solid rgba(200,90,90,0.25)", borderBottom:"1px solid rgba(200,90,90,0.25)"  },
        { bottom:20,right: 20, borderRight:"1px solid rgba(200,90,90,0.25)", borderBottom:"1px solid rgba(200,90,90,0.25)" },
      ].map((s, i) => <div key={i} style={{ position: "absolute", width: 18, height: 18, ...s }} />)}

      <div style={{ textAlign: "center", maxWidth: 520, padding: "0 32px", position: "relative", zIndex: 10 }}>

        {/* Error code */}
        <div style={{ fontSize: 10, letterSpacing: "0.22em", color: "rgba(200,90,90,0.5)", marginBottom: 20, textTransform: "uppercase" }}>
          M.A.X. OS // SECURITY MODULE // EVENT 403
        </div>

        {/* Big ERROR */}
        <div style={{
          fontSize: "clamp(52px,10vw,80px)", fontWeight: 900, color: "#C85A5A",
          letterSpacing: "-0.02em", lineHeight: 1, marginBottom: 16,
          textShadow: "0 0 40px rgba(200,90,90,0.45), 0 0 80px rgba(200,90,90,0.2)",
        }}>
          ACCESS DENIED
        </div>

        {/* Message */}
        <div style={{ fontSize: 13, color: "rgba(200,90,90,0.55)", letterSpacing: "0.08em", lineHeight: 1.9, marginBottom: 10 }}>
          ERROR — SECURE USER ACCESS CREDENTIALS REQUIRED
        </div>
        <div style={{ fontSize: 11, color: "rgba(148,163,184,0.25)", letterSpacing: "0.1em", lineHeight: 1.8, marginBottom: 44 }}>
          This terminal is restricted to authorized personnel only.<br />
          Session token missing or expired. Re-authentication required.
        </div>

        {/* Log line */}
        <div style={{ fontSize: 10, color: "rgba(200,90,90,0.3)", marginBottom: 36, letterSpacing: "0.1em" }}>
          {`[${new Date().toISOString()}] UNAUTHORIZED ACCESS ATTEMPT LOGGED`}
        </div>

        {/* Button */}
        <button
          onClick={() => router.push("/")}
          style={{
            padding: "12px 36px", borderRadius: 3, cursor: "pointer",
            background: "rgba(200,90,90,0.07)", border: "1px solid rgba(200,90,90,0.3)",
            color: "rgba(200,90,90,0.8)", fontSize: 11, fontWeight: 700,
            letterSpacing: "0.18em", textTransform: "uppercase",
            transition: "all .15s",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(200,90,90,0.12)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(200,90,90,0.6)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(200,90,90,0.07)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(200,90,90,0.3)"; }}
        >
          → Authenticate
        </button>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [auth,      setAuth]      = useState<boolean | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setAuth(sessionStorage.getItem("max-auth") === "1");
    } catch {
      setAuth(false);
    }
  }, []);

  if (auth === null) {
    /* tiny flash while sessionStorage is read — invisible in practice */
    return (
      <div style={{ minHeight: "100vh", background: "#07080f" }} />
    );
  }

  if (!auth) return <AccessDenied />;

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <main
        className="flex-1 overflow-auto"
        style={{
          marginLeft: collapsed ? 56 : 224,
          transition: "margin-left 0.25s ease",
        }}
      >
        {children}
      </main>
      <NotificationBell />
      <MaxChatBubble />
    </div>
  );
}
