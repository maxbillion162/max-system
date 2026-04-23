"use client";

const SECTIONS = [
  { icon: "◈", label: "M.A.X. Intelligence", desc: "Writing voice, personality, memory" },
  { icon: "◎", label: "Notifications", desc: "Morning brief time, Telegram toggles, thresholds" },
  { icon: "▣", label: "Privacy", desc: "Financial data visibility, blur settings" },
  { icon: "⬡", label: "Integrations", desc: "Plaid, Google, Telegram status" },
  { icon: "◆", label: "Budget", desc: "Period reset day, rollover per category" },
  { icon: "⊞", label: "Feed", desc: "Base interests, topic editor" },
  { icon: "◷", label: "Preferences", desc: "Default calendar view, task list, display" },
  { icon: "▤", label: "Data", desc: "Export transactions, goals, clear history" },
];

export default function SettingsPage() {
  return (
    <div style={{ minHeight: "100vh", padding: "40px 40px 80px", maxWidth: 900, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ fontSize: 10, letterSpacing: "0.22em", color: "rgba(6,182,212,0.45)", textTransform: "uppercase", marginBottom: 10, fontWeight: 600 }}>
          M.A.X. OS // SETTINGS
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--t1)", letterSpacing: "-0.02em", margin: 0 }}>
          Settings
        </h1>
        <p style={{ fontSize: 13, color: "var(--t3)", marginTop: 8 }}>
          Full settings build is Week 12 — this page is a placeholder.
        </p>
      </div>

      {/* Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
        gap: 12,
      }}>
        {SECTIONS.map(section => (
          <div
            key={section.label}
            style={{
              background: "rgba(255,255,255,0.025)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 12,
              padding: "20px 22px",
              display: "flex", gap: 14, alignItems: "flex-start",
              cursor: "default",
              transition: "all 0.15s",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(6,182,212,0.15)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.025)";
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)";
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 9, flexShrink: 0,
              background: "rgba(6,182,212,0.08)",
              border: "1px solid rgba(6,182,212,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 15, color: "rgba(6,182,212,0.8)",
            }}>
              {section.icon}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", marginBottom: 4 }}>
                {section.label}
              </div>
              <div style={{ fontSize: 11, color: "var(--t4)", lineHeight: 1.5 }}>
                {section.desc}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Coming soon notice */}
      <div style={{
        marginTop: 48,
        padding: "20px 24px",
        background: "rgba(6,182,212,0.04)",
        border: "1px solid rgba(6,182,212,0.1)",
        borderRadius: 12,
        display: "flex", alignItems: "center", gap: 14,
      }}>
        <div style={{ fontSize: 18, color: "rgba(6,182,212,0.6)" }}>◈</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t2)" }}>Full settings arriving Week 12</div>
          <div style={{ fontSize: 12, color: "var(--t4)", marginTop: 3 }}>
            Writing style analysis, memory viewer, Plaid management, notification tuning, and all preferences.
          </div>
        </div>
      </div>
    </div>
  );
}
