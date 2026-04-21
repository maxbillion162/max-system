"use client";

import { useState } from "react";
import { HudCard } from "@/components/ui/HudCard";

interface Email {
  id: string;
  from: string;
  fromEmail: string;
  subject: string;
  preview: string;
  time: string;
  unread: boolean;
  category: "action" | "fyi" | "noise";
  starred?: boolean;
}

const EMAILS: Email[] = [
  { id: "1", from: "Sarah M.",      fromEmail: "sarah@northside.com",  category: "action", subject: "Contract revision needed — Northside Staffing",  preview: "Hey Max, the client needs a few changes to the contract before they can sign. Can you review and get back to me by EOD?",           time: "9:14 AM",   unread: true,  starred: true  },
  { id: "2", from: "HR Department", fromEmail: "hr@yourstaffingco.com", category: "action", subject: "Onboarding paperwork due Friday",                 preview: "Reminder: your onboarding documents must be submitted before your start date. Log in to the portal to complete all required forms.", time: "8:02 AM",   unread: true,  starred: false },
  { id: "3", from: "Schwab",        fromEmail: "alerts@schwab.com",     category: "action", subject: "Action required: Roth IRA contribution window",   preview: "Your 2025 contribution window closes in 30 days. Review your current contributions and consider maximizing before the deadline.",   time: "Yesterday", unread: false, starred: false },
  { id: "4", from: "LinkedIn",      fromEmail: "jobs@linkedin.com",     category: "fyi",    subject: "You appeared in 12 searches this week",            preview: "Your profile was viewed by recruiters at 3 companies in the staffing industry this week. See who's been looking at your profile.",  time: "10:30 AM",  unread: true,  starred: false },
  { id: "5", from: "CoinDesk",      fromEmail: "news@coindesk.com",     category: "fyi",    subject: "BTC breaks $94K — analyst sets $110K target",      preview: "Bitcoin surged past $94,000 this morning on strong institutional inflows. Multiple analysts are now revising price targets upward.",  time: "7:45 AM",   unread: false, starred: false },
  { id: "6", from: "FSU Alumni",    fromEmail: "alumni@fsu.edu",        category: "fyi",    subject: "Networking mixer — Orlando, May 15",               preview: "Join fellow Seminole alumni for a networking event at Armature Works. RSVP by May 10th. Drinks and appetizers provided.",            time: "Yesterday", unread: false, starred: false },
  { id: "7", from: "Spotify",       fromEmail: "no-reply@spotify.com",  category: "noise",  subject: "Your Weekly Discover playlist is ready",           preview: "We found 30 new songs based on your listening history. Check out your Discover Weekly playlist now.",                               time: "6:00 AM",   unread: false, starred: false },
  { id: "8", from: "DoorDash",      fromEmail: "offers@doordash.com",   category: "noise",  subject: "Limited time: $5 off your next order",             preview: "Use code SAVE5 at checkout. Offer expires tonight at midnight. Order from your favorite restaurants.",                              time: "Yesterday", unread: false, starred: false },
  { id: "9", from: "Amazon",        fromEmail: "ship@amazon.com",       category: "noise",  subject: "Your order has shipped",                           preview: "Your package is on its way. Estimated delivery: Thursday, April 24. Track your package in the app.",                                  time: "2 days ago", unread: false, starred: false },
];

const AI_SUMMARY = "2 items need your attention today: Sarah is waiting on the Northside Staffing contract revision, and HR onboarding paperwork is due Friday. Your Schwab IRA contribution window closes in 30 days — worth acting on. Everything else is informational or noise.";

const CAT_META = {
  action: { label: "Action Required", color: "var(--red)",   dot: "#ef4444", bg: "rgba(239,68,68,0.06)",   border: "rgba(239,68,68,0.14)"   },
  fyi:    { label: "FYI",             color: "var(--blue)",  dot: "#4589ff", bg: "rgba(69,137,255,0.06)",  border: "rgba(69,137,255,0.14)"  },
  noise:  { label: "Noise",           color: "var(--t3)",    dot: "#50596a", bg: "rgba(255,255,255,0.02)", border: "var(--border)"          },
};

type Cat = "all" | "action" | "fyi" | "noise";

function Avatar({ name, color }: { name: string; color: string }) {
  return (
    <div style={{
      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
      background: `${color}18`, border: `1px solid ${color}25`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 13, fontWeight: 700, color,
    }}>
      {name.split(" ").map(w => w[0]).join("").slice(0, 2)}
    </div>
  );
}

export default function EmailPage() {
  const [cat,      setCat]      = useState<Cat>("all");
  const [selected, setSelected] = useState<Email | null>(EMAILS[0]);
  const [search,   setSearch]   = useState("");

  const filtered = EMAILS.filter(e => {
    const matchCat    = cat === "all" || e.category === cat;
    const matchSearch = !search || e.subject.toLowerCase().includes(search.toLowerCase()) || e.from.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const unreadCount   = EMAILS.filter(e => e.unread).length;
  const actionCount   = EMAILS.filter(e => e.category === "action").length;
  const actionUnread  = EMAILS.filter(e => e.category === "action" && e.unread).length;

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--bg)", overflow: "hidden" }}>

      {/* ── LEFT NAV ── */}
      <div style={{ width: 220, flexShrink: 0, borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", padding: "28px 0" }}>
        <div style={{ padding: "0 20px 24px" }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--t3)", marginBottom: 4 }}>Inbox</p>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--t1)", letterSpacing: "-0.02em" }}>Email</h2>
        </div>

        {/* Search */}
        <div style={{ padding: "0 12px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 12px" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--t4)" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
              style={{ background: "none", border: "none", outline: "none", fontSize: 12, color: "var(--t1)", flex: 1 }} />
          </div>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: "0 8px" }}>
          {([
            { id: "all",    label: "All Mail",        count: EMAILS.length,                              icon: "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6" },
            { id: "action", label: "Action Required", count: actionCount,  badge: actionUnread,          icon: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" },
            { id: "fyi",    label: "FYI",              count: EMAILS.filter(e => e.category === "fyi").length, icon: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" },
            { id: "noise",  label: "Noise",            count: EMAILS.filter(e => e.category === "noise").length, icon: "M18 6L6 18M6 6l12 12" },
          ] as { id: Cat; label: string; count: number; badge?: number; icon: string }[]).map(item => (
            <button key={item.id} onClick={() => setCat(item.id)} style={{
              display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 12px",
              borderRadius: 8, cursor: "pointer", marginBottom: 2, textAlign: "left",
              background: cat === item.id ? "rgba(69,137,255,0.08)" : "transparent",
              border: `1px solid ${cat === item.id ? "rgba(69,137,255,0.2)" : "transparent"}`,
              transition: "all .15s",
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke={cat === item.id ? "var(--blue)" : "var(--t3)"}
                strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d={item.icon} />
              </svg>
              <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: cat === item.id ? "var(--t1)" : "var(--t3)" }}>{item.label}</span>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                {item.badge ? (
                  <span style={{ fontSize: 10, fontWeight: 800, color: "var(--red)", background: "rgba(239,68,68,0.12)", padding: "1px 5px", borderRadius: 3 }}>{item.badge}</span>
                ) : null}
                <span style={{ fontSize: 10, color: "var(--t4)", fontFamily: "monospace" }}>{item.count}</span>
              </div>
            </button>
          ))}
        </nav>

        {/* Connect CTA */}
        <div style={{ margin: "0 12px", padding: "12px 14px", borderRadius: 10, background: "rgba(69,137,255,0.05)", border: "1px solid rgba(69,137,255,0.12)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--blue)" }}>Gmail · Phase 3</span>
          </div>
          <p style={{ fontSize: 10, color: "var(--t4)", lineHeight: 1.5 }}>Connect your real inbox with Google OAuth</p>
        </div>

        {/* Stats */}
        <div style={{ padding: "16px 20px 0", display: "flex", gap: 16 }}>
          <div>
            <p style={{ fontSize: 18, fontWeight: 800, color: "var(--blue)", fontFamily: "monospace" }}>{unreadCount}</p>
            <p style={{ fontSize: 9, color: "var(--t4)", fontWeight: 600 }}>UNREAD</p>
          </div>
          <div>
            <p style={{ fontSize: 18, fontWeight: 800, color: "var(--red)", fontFamily: "monospace" }}>{actionCount}</p>
            <p style={{ fontSize: 9, color: "var(--t4)", fontWeight: 600 }}>ACTION</p>
          </div>
        </div>
      </div>

      {/* ── EMAIL LIST ── */}
      <div style={{ width: 380, flexShrink: 0, borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* M.A.X. summary */}
        <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", borderRadius: 10, background: "rgba(69,137,255,0.05)", border: "1px solid rgba(69,137,255,0.1)" }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: "rgba(69,137,255,0.1)", border: "1px solid rgba(69,137,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 900, color: "var(--blue)" }}>M</span>
            </div>
            <p style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.6, flex: 1 }}>{AI_SUMMARY}</p>
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {filtered.map((email, i) => {
            const meta = CAT_META[email.category];
            const isSelected = selected?.id === email.id;
            return (
              <button key={email.id} onClick={() => setSelected(email)} style={{
                display: "flex", alignItems: "flex-start", gap: 12, width: "100%",
                padding: "14px 16px", textAlign: "left", cursor: "pointer",
                background: isSelected ? "rgba(69,137,255,0.07)" : "transparent",
                borderBottom: "1px solid var(--border)",
                borderLeft: `3px solid ${email.unread ? meta.dot : "transparent"}`,
                transition: "background .12s",
              }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.01)"; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
              >
                <Avatar name={email.from} color={meta.color} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 12, fontWeight: email.unread ? 700 : 500, color: "var(--t1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>{email.from}</span>
                    <span style={{ fontSize: 10, color: "var(--t4)", flexShrink: 0, marginLeft: 8 }}>{email.time}</span>
                  </div>
                  <p style={{ fontSize: 12, fontWeight: email.unread ? 600 : 400, color: email.unread ? "var(--t1)" : "var(--t2)", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email.subject}</p>
                  <p style={{ fontSize: 11, color: "var(--t3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.4 }}>{email.preview}</p>
                </div>
                {email.unread && <div style={{ width: 6, height: 6, borderRadius: "50%", background: meta.dot, flexShrink: 0, marginTop: 6 }} />}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p style={{ fontSize: 12, color: "var(--t4)", textAlign: "center", padding: "40px 0" }}>No emails.</p>
          )}
        </div>
      </div>

      {/* ── EMAIL DETAIL ── */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {!selected ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <p style={{ fontSize: 13, color: "var(--t4)" }}>Select an email to read</p>
          </div>
        ) : (
          <>
            {/* Detail header */}
            <div style={{ padding: "24px 32px 20px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 3,
                      background: CAT_META[selected.category].bg,
                      border: `1px solid ${CAT_META[selected.category].border}`,
                      color: CAT_META[selected.category].color,
                    }}>{CAT_META[selected.category].label}</span>
                    {selected.unread && <span style={{ fontSize: 10, fontWeight: 700, color: "var(--blue)" }}>UNREAD</span>}
                  </div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--t1)", lineHeight: 1.3, letterSpacing: "-0.01em" }}>{selected.subject}</h2>
                </div>
                <button onClick={() => window.dispatchEvent(new CustomEvent("max-open-chat"))} style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "7px 13px",
                  borderRadius: 8, cursor: "pointer", flexShrink: 0, marginLeft: 16,
                  background: "rgba(69,137,255,0.08)", border: "1px solid rgba(69,137,255,0.2)",
                  fontSize: 11, fontWeight: 700, color: "var(--blue)",
                }}>
                  <span style={{ fontSize: 11, fontWeight: 900 }}>M</span>
                  Ask M.A.X.
                </button>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Avatar name={selected.from} color={CAT_META[selected.category].color} />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>{selected.from}</p>
                  <p style={{ fontSize: 11, color: "var(--t4)" }}>{selected.fromEmail} · {selected.time}</p>
                </div>
              </div>
            </div>

            {/* Email body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px" }}>
              <div style={{ maxWidth: 640 }}>
                <p style={{ fontSize: 14, color: "var(--t2)", lineHeight: 1.8 }}>{selected.preview}</p>
                <p style={{ fontSize: 14, color: "var(--t3)", lineHeight: 1.8, marginTop: 16 }}>
                  [Connect Gmail in Phase 3 to view full email content here — including thread history, attachments, and AI-generated reply drafts.]
                </p>
              </div>
            </div>

            {/* Reply bar */}
            <div style={{ padding: "16px 32px 24px", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 16px" }}>
                <input placeholder="Reply or ask M.A.X. to draft a response…" style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 13, color: "var(--t1)" }} />
                <button style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 7, background: "rgba(69,137,255,0.1)", border: "1px solid rgba(69,137,255,0.2)", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "var(--blue)" }}>
                  Draft
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
