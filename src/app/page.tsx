import Link from "next/link";

export default function Home() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--bg)",
      position: "relative",
      overflow: "hidden",
    }}>

      {/* Grid texture */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: "linear-gradient(rgba(69,137,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(69,137,255,0.025) 1px, transparent 1px)",
        backgroundSize: "56px 56px",
      }} />

      {/* Radial glow */}
      <div style={{
        position: "absolute", top: "45%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: 600, height: 600, borderRadius: "50%", pointerEvents: "none",
        background: "radial-gradient(circle, rgba(69,137,255,0.06) 0%, transparent 65%)",
      }} />
      <div style={{
        position: "absolute", bottom: "15%", right: "20%",
        width: 300, height: 300, borderRadius: "50%", pointerEvents: "none",
        background: "radial-gradient(circle, rgba(245,158,11,0.03) 0%, transparent 70%)",
      }} />

      {/* Content */}
      <div style={{
        position: "relative", zIndex: 10,
        textAlign: "center", padding: "0 32px",
        opacity: 0, animation: "fade-up 0.6s ease 0.1s forwards",
      }}>

        {/* Logo mark */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 44 }}>
          <div style={{ position: "relative", width: 88, height: 88 }}>
            <svg style={{
              position: "absolute", inset: 0, width: "100%", height: "100%",
              animation: "spin-slow 20s linear infinite",
            }} viewBox="0 0 88 88">
              <circle cx="44" cy="44" r="40" fill="none"
                stroke="rgba(69,137,255,0.15)" strokeWidth="1" strokeDasharray="5 5" />
            </svg>
            <svg style={{
              position: "absolute", inset: 0, width: "100%", height: "100%",
              animation: "spin-slow 30s linear infinite reverse",
            }} viewBox="0 0 88 88">
              <circle cx="44" cy="44" r="32" fill="none"
                stroke="rgba(69,137,255,0.08)" strokeWidth="1" strokeDasharray="2 8" />
            </svg>
            <div style={{
              position: "absolute", top: 14, left: 14, right: 14, bottom: 14,
              borderRadius: 16,
              background: "linear-gradient(135deg, #0a1929 0%, #060f1e 100%)",
              border: "1px solid rgba(69,137,255,0.3)",
              boxShadow: "0 0 40px rgba(69,137,255,0.1), inset 0 0 20px rgba(69,137,255,0.04)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{
                fontSize: 28, fontWeight: 900, letterSpacing: "-0.03em",
                color: "var(--blue)",
                textShadow: "0 0 20px rgba(69,137,255,0.4)",
              }}>M</span>
            </div>
          </div>
        </div>

        {/* Status badge */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 7,
          padding: "4px 12px", borderRadius: 20, marginBottom: 20,
          background: "rgba(34,197,94,0.06)",
          border: "1px solid rgba(34,197,94,0.15)",
        }}>
          <span style={{
            width: 5, height: 5, borderRadius: "50%",
            background: "var(--green)",
            display: "inline-block",
            boxShadow: "0 0 6px var(--green)",
            animation: "pulse-dot 2s ease-in-out infinite",
          }} />
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--green)" }}>
            System Online
          </span>
        </div>

        {/* Title */}
        <h1 style={{
          fontSize: 72, fontWeight: 900, letterSpacing: "-0.05em",
          color: "var(--t1)", lineHeight: 1, marginBottom: 10,
        }}>
          M.A.X.
        </h1>
        <p style={{
          fontSize: 11, fontWeight: 700, letterSpacing: "0.22em",
          textTransform: "uppercase", color: "var(--amber)", opacity: 0.8,
          marginBottom: 20,
        }}>
          Maximum Adaptive eXecutive
        </p>
        <p style={{
          fontSize: 14, color: "var(--t3)", lineHeight: 1.7,
          marginBottom: 48, maxWidth: 300, marginLeft: "auto", marginRight: "auto",
        }}>
          Personal AI operating system.<br />Built exclusively for Max.
        </p>

        {/* CTA */}
        <Link href="/dashboard" style={{
          display: "inline-flex", alignItems: "center", gap: 10,
          padding: "13px 32px", borderRadius: 10,
          fontWeight: 700, fontSize: 12, letterSpacing: "0.12em",
          textTransform: "uppercase", color: "#fff", textDecoration: "none",
          background: "linear-gradient(135deg, #1e40af, #2563eb, #0ea5e9)",
          boxShadow: "0 0 48px rgba(69,137,255,0.2), 0 4px 28px rgba(0,0,0,0.5)",
          transition: "all 0.2s ease",
        }}>
          <span>Access Agent</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </Link>

        {/* Status row */}
        <div style={{
          marginTop: 52, display: "flex",
          alignItems: "center", justifyContent: "center", gap: 32,
        }}>
          {["AI Core Active", "End-to-End Encrypted", "Real-time Data"].map(s => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{
                width: 4, height: 4, borderRadius: "50%",
                background: "var(--blue)", display: "inline-block",
                opacity: 0.6,
              }} />
              <span style={{ fontSize: 11, color: "var(--t4)", fontWeight: 500 }}>{s}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
