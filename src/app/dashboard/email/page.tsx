"use client";

import { HudCard } from "@/components/ui/HudCard";

/* ── Placeholder state — real Gmail connects in Phase 3 ── */

const CATEGORIES = [
  {
    id:    "action",
    label: "Action Required",
    color: "var(--red)",
    bg:    "rgba(239,68,68,0.06)",
    border:"rgba(239,68,68,0.15)",
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
    emails: [
      { from: "Sarah M.",        subject: "Contract revision needed — Northside Staffing",   time: "9:14 AM",  unread: true,  preview: "Hey Max, the client needs a few changes to the contract before they can sign. Can you review and get back to me by EOD?" },
      { from: "HR Department",   subject: "Onboarding paperwork due Friday",                  time: "8:02 AM",  unread: true,  preview: "Reminder: your onboarding documents must be completed before your start date. Please log in to the portal and submit." },
      { from: "Schwab",          subject: "Action required: Roth IRA contribution limit",     time: "Yesterday", unread: false, preview: "Your 2025 contribution window closes in 30 days. Review your current contributions and consider maximizing before the deadline." },
    ],
  },
  {
    id:    "fyi",
    label: "FYI",
    color: "var(--blue)",
    bg:    "rgba(69,137,255,0.06)",
    border:"rgba(69,137,255,0.15)",
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    ),
    emails: [
      { from: "LinkedIn",        subject: "You appeared in 12 searches this week",            time: "10:30 AM", unread: true,  preview: "Your profile was viewed by recruiters at 3 companies in the staffing industry. See who's looking." },
      { from: "CoinDesk",        subject: "BTC breaks $94K — analyst sets $110K target",      time: "7:45 AM",  unread: false, preview: "Bitcoin surged past $94,000 this morning on strong institutional inflows. Multiple analysts are now revising price targets upward." },
      { from: "FSU Alumni",      subject: "Networking event — Orlando, May 15",               time: "Yesterday", unread: false, preview: "Join fellow FSU alumni for a networking mixer at Armature Works. RSVP by May 10th to secure your spot." },
    ],
  },
  {
    id:    "noise",
    label: "Noise",
    color: "var(--t4)",
    bg:    "rgba(255,255,255,0.02)",
    border:"var(--border)",
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 6L6 18M6 6l12 12"/>
      </svg>
    ),
    emails: [
      { from: "Spotify",         subject: "Your Weekly Discover playlist is ready",           time: "6:00 AM",  unread: false, preview: "We found 30 new songs based on your listening history. Check out your Discover Weekly now." },
      { from: "DoorDash",        subject: "Limited time: $5 off your next order",             time: "Yesterday", unread: false, preview: "Use code SAVE5 at checkout. Offer expires tonight at midnight." },
      { from: "Amazon",          subject: "Your order has shipped",                           time: "2 days ago", unread: false, preview: "Your package is on its way. Estimated delivery: Thursday, April 24." },
    ],
  },
];

const AI_SUMMARY = "3 emails need your attention today. Review the Northside Staffing contract revision (Sarah is waiting), complete your HR onboarding paperwork before Friday, and check your Schwab IRA contribution window — 30 days left to max it out. Everything else is informational or noise.";

export default function EmailPage() {
  return (
    <div style={{ padding: "28px 36px", background: "var(--bg)", minHeight: "100vh" }}>

      {/* ── HEADER ── */}
      <div className="afu" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--t3)", marginBottom: 6 }}>Inbox</p>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--t1)", letterSpacing: "-0.02em" }}>Email</h1>
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
          borderRadius: 8, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)",
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="2" strokeLinecap="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          </svg>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--amber)" }}>Google OAuth required to connect Gmail</span>
          <span style={{ fontSize: 11, color: "var(--t4)" }}>— Phase 3</span>
        </div>
      </div>

      {/* ── AI SUMMARY ── */}
      <HudCard className="afu" delay={0.04} style={{ padding: "18px 22px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: "rgba(69,137,255,0.08)", border: "1px solid rgba(69,137,255,0.18)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontSize: 12, fontWeight: 900, color: "var(--blue)" }}>M</span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "var(--blue)" }}>M.A.X. Daily Inbox Summary</p>
              <span style={{ fontSize: 10, color: "var(--t4)" }}>· {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
            </div>
            <p style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.7 }}>{AI_SUMMARY}</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
            {[
              { label: "Action",  count: CATEGORIES[0].emails.filter(e => e.unread).length, color: "var(--red)"   },
              { label: "FYI",     count: CATEGORIES[1].emails.filter(e => e.unread).length, color: "var(--blue)"  },
              { label: "Noise",   count: 0,                                                  color: "var(--t4)"   },
            ].map(s => (
              <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.color, display: "inline-block" }} />
                <span style={{ fontSize: 11, color: "var(--t3)" }}>{s.label}</span>
                {s.count > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 800, color: s.color, background: `${s.color}15`, padding: "1px 5px", borderRadius: 3 }}>{s.count} new</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </HudCard>

      {/* ── STATS ROW ── */}
      <div className="afu" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 20 }}>
        {[
          { label: "Total",          value: CATEGORIES.reduce((a,c) => a + c.emails.length, 0), color: "var(--t1)"   },
          { label: "Action Required", value: CATEGORIES[0].emails.length,                        color: "var(--red)"  },
          { label: "Unread",         value: CATEGORIES.flatMap(c => c.emails).filter(e => e.unread).length, color: "var(--blue)" },
          { label: "Noise",          value: CATEGORIES[2].emails.length,                         color: "var(--t4)"  },
        ].map(s => (
          <HudCard key={s.label} style={{ padding: "12px 16px" }}>
            <p style={{ fontSize: 24, fontWeight: 800, color: s.color, fontFamily: "monospace" }}>{s.value}</p>
            <p style={{ fontSize: 10, color: "var(--t3)", fontWeight: 600, marginTop: 2 }}>{s.label}</p>
          </HudCard>
        ))}
      </div>

      {/* ── CATEGORIES ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {CATEGORIES.map((cat, ci) => (
          <div key={cat.id} className="afu" style={{ animationDelay: `${0.06 + ci * 0.04}s` }}>
            {/* Category header */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{ color: cat.color, display: "flex" }}>{cat.icon}</div>
              <p style={{ fontSize: 11, fontWeight: 700, color: cat.color, letterSpacing: "0.1em", textTransform: "uppercase" }}>{cat.label}</p>
              <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 3, background: cat.bg, border: `1px solid ${cat.border}`, color: cat.color, fontWeight: 700 }}>
                {cat.emails.length}
              </span>
              <div style={{ flex: 1, height: 1, background: cat.border }} />
            </div>

            {/* Emails */}
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {cat.emails.map((email, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "flex-start", gap: 14, padding: "14px 16px",
                  borderRadius: 8, cursor: "pointer",
                  background: email.unread ? cat.bg : "var(--surface)",
                  border: `1px solid ${email.unread ? cat.border : "var(--border)"}`,
                  borderLeft: email.unread ? `3px solid ${cat.color}` : `3px solid transparent`,
                  transition: "background .15s",
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                  onMouseLeave={e => (e.currentTarget.style.background = email.unread ? cat.bg : "var(--surface)")}
                >
                  {/* Avatar */}
                  <div style={{
                    width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                    background: `${cat.color}18`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 700, color: cat.color,
                  }}>
                    {email.from[0]}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: email.unread ? 700 : 500, color: "var(--t1)" }}>{email.from}</span>
                      <span style={{ fontSize: 11, color: "var(--t4)", flexShrink: 0, marginLeft: 12 }}>{email.time}</span>
                    </div>
                    <p style={{ fontSize: 13, fontWeight: email.unread ? 600 : 400, color: email.unread ? "var(--t1)" : "var(--t2)", marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {email.subject}
                    </p>
                    <p style={{ fontSize: 12, color: "var(--t3)", lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {email.preview}
                    </p>
                  </div>

                  {/* Unread dot */}
                  {email.unread && (
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: cat.color, flexShrink: 0, marginTop: 4 }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── CONNECT CTA ── */}
      <div className="afu" style={{ marginTop: 32, padding: "24px", borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)", textAlign: "center" }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--t2)", marginBottom: 6 }}>
          Connect Gmail to power this page with your real inbox
        </p>
        <p style={{ fontSize: 12, color: "var(--t4)", marginBottom: 14 }}>
          Google OAuth · Phase 3 — real AI categorization, live summaries, and draft replies via M.A.X.
        </p>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 18px", borderRadius: 8, background: "rgba(69,137,255,0.08)", border: "1px solid rgba(69,137,255,0.2)" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--blue)" }}>Coming in Phase 3</span>
        </div>
      </div>
    </div>
  );
}
