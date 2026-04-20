import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden grid-bg scan-bg"
      style={{ background: "var(--bg)" }}>

      {/* Radial glow fields */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(56,189,248,0.06) 0%, transparent 70%)" }} />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(251,146,60,0.04) 0%, transparent 70%)" }} />
      </div>

      {/* Animated ring system */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[500px] h-[500px] rounded-full animate-spin-slow opacity-10"
          style={{ border: "1px solid var(--cyan)" }} />
        <div className="absolute w-[380px] h-[380px] rounded-full animate-spin-rev opacity-8"
          style={{ border: "1px dashed var(--cyan)" }} />
        <div className="absolute w-[260px] h-[260px] rounded-full opacity-15"
          style={{ border: "1px solid rgba(56,189,248,0.3)" }} />
      </div>

      {/* Main content */}
      <div className="relative z-10 text-center px-8 animate-fade-up">

        {/* Logo mark */}
        <div className="flex items-center justify-center mb-10">
          <div className="relative w-24 h-24">
            {/* Outer ring */}
            <svg className="absolute inset-0 w-full h-full animate-spin-slow" viewBox="0 0 96 96">
              <circle cx="48" cy="48" r="44" fill="none" stroke="rgba(56,189,248,0.2)" strokeWidth="1"
                strokeDasharray="8 4" />
            </svg>
            {/* Inner container */}
            <div className="absolute inset-3 rounded-xl flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #0b1f3a, #071428)",
                border: "1px solid rgba(56,189,248,0.4)",
                boxShadow: "0 0 40px rgba(56,189,248,0.15), inset 0 0 20px rgba(56,189,248,0.05)"
              }}>
              <span className="text-3xl font-black tracking-tighter" style={{ color: "var(--cyan)" }}>M</span>
            </div>
          </div>
        </div>

        <div className="text-xs font-semibold tracking-[0.3em] uppercase mb-4" style={{ color: "var(--cyan)", opacity: 0.7 }}>
          System v1.0 · Online
        </div>

        <h1 className="text-6xl font-black tracking-tight mb-3" style={{ color: "var(--t1)" }}>
          M.A.X.
        </h1>
        <p className="text-sm font-medium tracking-widest uppercase mb-2" style={{ color: "var(--orange)" }}>
          Maximum Adaptive eXecutive
        </p>
        <p className="text-base mt-4 mb-12 max-w-sm mx-auto leading-relaxed" style={{ color: "var(--t2)", opacity: 0.7 }}>
          Your personal AI operating system.<br />Built exclusively for Max.
        </p>

        <Link href="/dashboard"
          className="inline-flex items-center gap-3 rounded-xl font-bold text-white transition-all duration-300 hover:scale-105 hover:shadow-2xl"
          style={{
            padding: "14px 32px",
            whiteSpace: "nowrap",
            background: "linear-gradient(135deg, #0369a1, #0ea5e9)",
            boxShadow: "0 0 30px rgba(56,189,248,0.25), 0 4px 20px rgba(0,0,0,0.4)"
          }}>
          <span>Enter M.A.X.</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </Link>

        {/* Status row */}
        <div className="mt-12 flex items-center justify-center gap-6">
          {["AI Online", "Secure", "Real-time"].map((s, i) => (
            <div key={s} className="flex items-center gap-1.5 text-xs" style={{ color: "var(--muted)" }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse-dot"
                style={{ background: "var(--green)", color: "var(--green)" }} />
              {s}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
