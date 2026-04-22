"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface Email {
  id: string;
  threadId: string;
  from: string;
  fromEmail: string;
  subject: string;
  preview: string;
  body: string;
  time: string;
  unread: boolean;
  category: "action" | "fyi" | "noise";
  labels: string[];
  snoozed?: boolean;
  pinned?: boolean;
}

function categorize(labels: string[]): "action" | "fyi" | "noise" {
  if (labels.includes("IMPORTANT") || labels.includes("STARRED")) return "action";
  if (labels.includes("CATEGORY_PROMOTIONS") || labels.includes("CATEGORY_UPDATES") || labels.includes("CATEGORY_SOCIAL")) return "noise";
  return "fyi";
}

function parseSender(from: string): { name: string; email: string } {
  const match = from.match(/^(.*?)\s*<(.+?)>$/);
  if (match) return { name: match[1].replace(/"/g, "").trim() || match[2], email: match[2] };
  return { name: from, email: from };
}

function relativeTime(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7)   return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function initials(name: string): string {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?";
}

const AVATAR_COLORS = ["#8b5cf6","#06b6d4","#10b981","#f97316","#ec4899","#4589ff","#f59e0b","#ef4444"];
function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
}

const PLACEHOLDER_EMAILS: Email[] = [
  { id: "1", threadId: "1", from: "Sarah M.", fromEmail: "sarah@example.com", category: "action", subject: "Contract revision needed", preview: "Hey Max, the client needs a few changes to the contract before they can sign. Can you review and get back to me by EOD?", body: "Hey Max,\n\nThe client needs a few changes to the contract before they can sign. Specifically they want to revise the payment terms from Net-30 to Net-15 and need an updated SLA section.\n\nCan you review and get back to me by EOD?\n\nThanks,\nSarah", time: "9:14 AM", unread: true, labels: ["IMPORTANT"] },
  { id: "2", threadId: "2", from: "HR Department", fromEmail: "hr@example.com", category: "action", subject: "Onboarding paperwork due Friday", preview: "Your onboarding documents must be submitted before your start date.", body: "Hi Max,\n\nYour onboarding documents must be submitted by Friday, July 5th before your start date on July 8th.\n\nPlease log in to the HR portal to complete:\n- I-9 verification\n- Direct deposit setup\n- Benefits enrollment\n- Employee handbook acknowledgment\n\nLet me know if you have any questions.\n\nHR Team", time: "8:02 AM", unread: true, labels: ["IMPORTANT"] },
  { id: "3", threadId: "3", from: "CoinDesk", fromEmail: "news@coindesk.com", category: "fyi", subject: "BTC breaks $94K — weekly analysis", preview: "Bitcoin surged past $94,000 this morning on strong institutional inflows.", body: "Bitcoin surged past $94,000 this morning on strong institutional inflows. Multiple analysts are now revising their year-end price targets upward toward $120K–$150K.\n\nKey drivers:\n- BlackRock ETF inflows hit $800M this week\n- Positive macro sentiment after Fed pause\n- XRP ETF approval odds rising on Polymarket (72%)\n\nFull analysis at coindesk.com", time: "7:45 AM", unread: false, labels: [] },
  { id: "4", threadId: "4", from: "Robinhood", fromEmail: "alerts@robinhood.com", category: "fyi", subject: "Price alert: XRP +6.2% today", preview: "Your XRP holdings have moved +6.2% in the last 24 hours.", body: "Your XRP holdings have moved +6.2% in the last 24 hours.\n\nXRP is currently trading at $2.41.\nYour position: 200 XRP = $482.00\n24h gain: +$28.14\n\nView your portfolio in the Robinhood app.", time: "6:30 AM", unread: false, labels: [] },
  { id: "5", threadId: "5", from: "Spotify", fromEmail: "no-reply@spotify.com", category: "noise", subject: "Your Weekly Discover playlist is ready", preview: "We found 30 new songs based on your listening history.", body: "We found 30 new songs based on your listening history. Check out your Discover Weekly playlist now.", time: "6:00 AM", unread: false, labels: ["CATEGORY_UPDATES"] },
  { id: "6", threadId: "6", from: "LinkedIn", fromEmail: "news@linkedin.com", category: "noise", subject: "5 new connections viewed your profile", preview: "See who's been looking at your LinkedIn profile this week.", body: "See who's been looking at your LinkedIn profile this week.", time: "Yesterday", unread: false, labels: ["CATEGORY_SOCIAL"] },
];

export default function EmailPage() {
  const router = useRouter();
  const [emails,      setEmails]      = useState<Email[]>([]);
  const [connected,   setConnected]   = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [selected,    setSelected]    = useState<Email | null>(null);
  const [digest,      setDigest]      = useState("");
  const [digestLoad,  setDigestLoad]  = useState(false);
  const [aiActions,   setAiActions]   = useState<Record<string, string>>({});
  const [draftText,   setDraftText]   = useState("");
  const [drafting,    setDrafting]    = useState(false);
  const [draftSaved,  setDraftSaved]  = useState(false);
  const [noiseOpen,   setNoiseOpen]   = useState(false);
  const [aiReply,     setAiReply]     = useState("");
  const [aiReplyLoad, setAiReplyLoad] = useState(false);
  const [search,      setSearch]      = useState("");
  const composeRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch("/api/google/gmail?maxResults=50")
      .then(r => r.json())
      .then(d => {
        if (d.connected && d.emails?.length > 0) {
          setConnected(true);
          const parsed: Email[] = d.emails.map((e: {
            id: string; threadId: string; from: string; subject: string;
            snippet: string; body: string; date: string; unread: boolean; labels: string[];
          }) => {
            const { name, email } = parseSender(e.from);
            return { id: e.id, threadId: e.threadId, from: name, fromEmail: email, subject: e.subject, preview: e.snippet, body: e.body, time: relativeTime(e.date), unread: e.unread, labels: e.labels, category: categorize(e.labels) };
          });
          setEmails(parsed);
          setSelected(parsed.find(e => e.category === "action") ?? parsed[0] ?? null);

          setDigestLoad(true);
          fetch("/api/email/digest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ emails: parsed.map(e => ({ from: e.from, subject: e.subject, snippet: e.preview, category: e.category })) }),
          })
            .then(r => r.json())
            .then(j => { if (j.digest) setDigest(j.digest); if (j.actions) setAiActions(j.actions); })
            .catch(() => {})
            .finally(() => setDigestLoad(false));
        } else {
          setEmails(PLACEHOLDER_EMAILS);
          setSelected(PLACEHOLDER_EMAILS[0]);
        }
      })
      .catch(() => { setEmails(PLACEHOLDER_EMAILS); setSelected(PLACEHOLDER_EMAILS[0]); })
      .finally(() => setLoading(false));
  }, []);

  async function saveDraft() {
    if (!selected || !draftText.trim()) return;
    setDrafting(true);
    try {
      await fetch("/api/google/gmail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: selected.fromEmail, subject: `Re: ${selected.subject}`, body: draftText, threadId: selected.threadId }),
      });
      setDraftSaved(true);
      setDraftText("");
      setTimeout(() => setDraftSaved(false), 3000);
    } finally {
      setDrafting(false);
    }
  }

  function snooze(id: string) {
    setEmails(prev => prev.map(e => e.id === id ? { ...e, snoozed: true } : e));
    if (selected?.id === id) setSelected(null);
  }

  function pin(id: string) {
    setEmails(prev => prev.map(e => e.id === id ? { ...e, pinned: !e.pinned } : e));
  }

  function openDraftChat(email: Email) {
    const ctx = `Draft a reply to ${email.from} about "${email.subject}". Here's what they said:\n\n${email.body || email.preview}\n\nWrite a professional but direct reply on behalf of Max. Keep it concise.`;
    try { localStorage.setItem("max-draft-context", ctx); } catch {}
    router.push("/dashboard/chat");
  }

  async function generateAiReply(email: Email) {
    setAiReplyLoad(true);
    setAiReply("");
    try {
      const res  = await fetch("/api/email/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: email.from, subject: email.subject, body: email.body || email.preview }),
      });
      const data = await res.json();
      if (data.reply) {
        setAiReply(data.reply);
        setDraftText(data.reply);
        setTimeout(() => composeRef.current?.focus(), 100);
      }
    } catch {}
    setAiReplyLoad(false);
  }

  const visibleEmails = emails.filter(e => !e.snoozed);
  const searchFiltered = visibleEmails.filter(e =>
    !search || e.subject.toLowerCase().includes(search.toLowerCase()) || e.from.toLowerCase().includes(search.toLowerCase())
  );

  const actOn     = (visibleEmails.find(e => e.pinned) ? [visibleEmails.find(e => e.pinned)!] : []).concat(
    searchFiltered.filter(e => e.category === "action" && !e.pinned)
  );
  const worthRead = searchFiltered.filter(e => e.category === "fyi");
  const noise     = searchFiltered.filter(e => e.category === "noise");

  const unread      = visibleEmails.filter(e => e.unread).length;
  const actionCount = actOn.length;

  const situationReport = connected
    ? (digest || (digestLoad ? "Scanning inbox…" : `${actionCount} email${actionCount !== 1 ? "s" : ""} need attention.${unread > 0 ? ` ${unread} unread.` : ""} ${worthRead.length} informational.`))
    : "Connect Gmail to activate M.A.X. inbox intelligence.";

  if (loading) return (
    <div style={{ display: "flex", height: "100vh", background: "var(--bg)", alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <div style={{ display: "flex", gap: 6 }}>
          {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--blue)", opacity: 0.5, animation: `bounce 0.8s ease-in-out ${i * 0.18}s infinite` }} />)}
        </div>
        <p style={{ fontSize: 12, color: "var(--t4)" }}>Loading inbox…</p>
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--bg)", overflow: "hidden" }}>

      {/* ── LEFT: SECTIONS + STATS ── */}
      <div style={{ width: 300, flexShrink: 0, borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", overflowY: "auto" }}>

        {/* Header */}
        <div style={{ padding: "24px 20px 16px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--t3)", marginBottom: 4 }}>Email</p>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--t1)", letterSpacing: "-0.02em" }}>Inbox</h2>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: connected ? "var(--green)" : "var(--t4)", display: "inline-block", animation: connected ? "pulse-dot 2s ease-in-out infinite" : "none" }} />
              <span style={{ fontSize: 10, color: connected ? "var(--green)" : "var(--t4)", fontWeight: 600 }}>{connected ? "Gmail live" : "Demo"}</span>
            </div>
          </div>

          {/* Search */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 12px" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--t4)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" style={{ background: "none", border: "none", outline: "none", fontSize: 12, color: "var(--t1)", flex: 1 }} />
          </div>
        </div>

        {/* M.A.X. Situation Report */}
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", borderRadius: 10, background: "rgba(69,137,255,0.05)", border: "1px solid rgba(69,137,255,0.12)" }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, background: "rgba(69,137,255,0.12)", border: "1px solid rgba(69,137,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
              <span style={{ fontSize: 9, fontWeight: 900, color: "var(--blue)" }}>M</span>
            </div>
            <div>
              <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--blue)", marginBottom: 4 }}>Situation Report</p>
              <p style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.7 }}>
                {digestLoad ? (
                  <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                    <span style={{ color: "var(--t4)" }}>Analyzing inbox</span>
                    {[0,1,2].map(i => <span key={i} style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--blue)", opacity: 0.5, display: "inline-block", animation: `bounce 0.8s ease-in-out ${i*0.2}s infinite` }} />)}
                  </span>
                ) : situationReport}
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "12px 20px", borderBottom: "1px solid var(--border)", gap: 0 }}>
          {[
            { n: actionCount,     label: "ACT ON",  color: "#ef4444" },
            { n: worthRead.length, label: "FYI",     color: "#4589ff" },
            { n: noise.length,    label: "NOISE",   color: "var(--t4)" },
          ].map(s => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color, fontFamily: "monospace" }}>{s.n}</div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: "var(--t4)" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Section: ACT ON THESE */}
        <div style={{ padding: "12px 20px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", boxShadow: "0 0 6px #ef4444" }} />
            <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#ef4444" }}>Act on These</p>
            <span style={{ fontSize: 10, color: "var(--t4)", fontFamily: "monospace" }}>{actOn.length}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
            {actOn.length === 0 && <p style={{ fontSize: 11, color: "var(--t4)", padding: "8px 0" }}>Inbox zero for actions.</p>}
            {actOn.slice(0, 8).map(e => (
              <EmailRow key={e.id} email={e} selected={selected?.id === e.id} onSelect={() => { setSelected(e); setDraftText(""); setAiReply(""); }} onSnooze={() => snooze(e.id)} onPin={() => pin(e.id)} accentColor="#ef4444" />
            ))}
          </div>
        </div>

        {/* Section: WORTH READING */}
        <div style={{ padding: "0 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4589ff" }} />
            <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#4589ff" }}>Worth Reading</p>
            <span style={{ fontSize: 10, color: "var(--t4)", fontFamily: "monospace" }}>{worthRead.length}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
            {worthRead.length === 0 && <p style={{ fontSize: 11, color: "var(--t4)", padding: "8px 0" }}>Nothing in FYI.</p>}
            {worthRead.slice(0, 8).map(e => (
              <EmailRow key={e.id} email={e} selected={selected?.id === e.id} onSelect={() => { setSelected(e); setDraftText(""); setAiReply(""); }} onSnooze={() => snooze(e.id)} onPin={() => pin(e.id)} accentColor="#4589ff" />
            ))}
          </div>
        </div>

        {/* Section: NOISE (collapsed) */}
        <div style={{ padding: "0 20px 16px" }}>
          <button onClick={() => setNoiseOpen(v => !v)} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: noiseOpen ? 8 : 0, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--t4)" strokeWidth="2.5" strokeLinecap="round"
              style={{ transform: noiseOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform .2s" }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--t4)" }}>Noise</p>
            <span style={{ fontSize: 10, color: "var(--t4)", fontFamily: "monospace" }}>{noise.length}</span>
          </button>
          {noiseOpen && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {noise.slice(0, 10).map(e => (
                <EmailRow key={e.id} email={e} selected={selected?.id === e.id} onSelect={() => { setSelected(e); setDraftText(""); setAiReply(""); }} onSnooze={() => snooze(e.id)} onPin={() => pin(e.id)} accentColor="var(--t4)" />
              ))}
            </div>
          )}
        </div>

        {/* Connect Gmail */}
        {!connected && (
          <div style={{ margin: "0 20px 20px", padding: "14px 16px", borderRadius: 10, background: "rgba(69,137,255,0.05)", border: "1px solid rgba(69,137,255,0.15)" }}>
            <p style={{ fontSize: 11, color: "var(--t3)", lineHeight: 1.5, marginBottom: 10 }}>Connect real Gmail inbox for live M.A.X. triage</p>
            <a href="/api/auth/google" style={{ display: "block", textAlign: "center", padding: "8px 0", borderRadius: 7, background: "rgba(69,137,255,0.12)", border: "1px solid rgba(69,137,255,0.3)", color: "var(--blue)", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
              Connect Gmail →
            </a>
          </div>
        )}
      </div>

      {/* ── RIGHT: DETAIL PANEL ── */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {!selected ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--t4)" strokeWidth="1.5" strokeLinecap="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            <p style={{ fontSize: 13, color: "var(--t4)" }}>Select an email to read</p>
          </div>
        ) : (
          <>
            {/* Email header */}
            <div style={{ padding: "24px 32px 20px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16, gap: 16 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 4,
                      color: selected.category === "action" ? "#ef4444" : selected.category === "fyi" ? "#4589ff" : "var(--t4)",
                      background: selected.category === "action" ? "rgba(239,68,68,0.1)" : selected.category === "fyi" ? "rgba(69,137,255,0.1)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${selected.category === "action" ? "rgba(239,68,68,0.25)" : selected.category === "fyi" ? "rgba(69,137,255,0.2)" : "var(--border)"}`,
                      letterSpacing: "0.1em",
                    }}>
                      {selected.category === "action" ? "ACT ON THIS" : selected.category === "fyi" ? "WORTH READING" : "NOISE"}
                    </span>
                    {selected.unread && <span style={{ fontSize: 10, fontWeight: 700, color: "var(--blue)" }}>UNREAD</span>}
                    {selected.pinned && <span style={{ fontSize: 10, fontWeight: 700, color: "var(--amber)" }}>PINNED</span>}
                  </div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--t1)", lineHeight: 1.3, letterSpacing: "-0.01em" }}>{selected.subject}</h2>
                </div>

                {/* Quick actions */}
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <ActionBtn onClick={() => pin(selected.id)} label={selected.pinned ? "Unpin" : "Pin"} color="var(--amber)" />
                  <ActionBtn onClick={() => snooze(selected.id)} label="Snooze" color="var(--t3)" />
                  <ActionBtn onClick={() => openDraftChat(selected)} label="Open in Chat" color="var(--blue)" primary />
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                  background: `${avatarColor(selected.from)}18`, border: `1px solid ${avatarColor(selected.from)}30`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 700, color: avatarColor(selected.from),
                }}>
                  {initials(selected.from)}
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "var(--t1)" }}>{selected.from}</p>
                  <p style={{ fontSize: 11, color: "var(--t4)" }}>{selected.fromEmail} · {selected.time}</p>
                </div>
              </div>
            </div>

            {/* M.A.X. action hint */}
            {selected.category === "action" && aiActions[selected.subject] && (
              <div style={{ padding: "12px 32px 0", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.12)" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 2 }}>
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <p style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.6 }}>
                    <span style={{ fontWeight: 700, color: "#ef4444" }}>Suggested action: </span>
                    {aiActions[selected.subject]}
                  </p>
                </div>
              </div>
            )}

            {/* Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px" }}>
              <div style={{ maxWidth: 680 }}>
                <pre style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.9, whiteSpace: "pre-wrap", fontFamily: "inherit", margin: 0 }}>
                  {selected.body || selected.preview}
                </pre>
              </div>
            </div>

            {/* Compose area */}
            <div style={{ padding: "16px 32px 24px", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
              {draftSaved ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderRadius: 10, background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.18)" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                  <p style={{ fontSize: 12, color: "var(--green)", fontWeight: 600 }}>Draft saved to Gmail</p>
                </div>
              ) : (
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                  {/* Compose toolbar */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ fontSize: 11, color: "var(--t3)", flex: 1 }}>
                      Re: {selected.from}
                    </span>
                    <button
                      onClick={() => generateAiReply(selected)}
                      disabled={aiReplyLoad}
                      style={{
                        display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 6,
                        background: "rgba(69,137,255,0.1)", border: "1px solid rgba(69,137,255,0.25)",
                        color: "var(--blue)", fontSize: 11, fontWeight: 700, cursor: "pointer",
                        opacity: aiReplyLoad ? 0.6 : 1, transition: "all .15s",
                      }}>
                      {aiReplyLoad ? (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ animation: "spin-slow 1s linear infinite" }}>
                          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/>
                        </svg>
                      ) : (
                        <span style={{ fontWeight: 900, fontSize: 10 }}>M</span>
                      )}
                      {aiReplyLoad ? "Drafting…" : "Write with M.A.X."}
                    </button>
                  </div>
                  <textarea
                    ref={composeRef}
                    value={draftText}
                    onChange={e => setDraftText(e.target.value)}
                    placeholder={connected ? `Reply to ${selected.from}… or click "Write with M.A.X." for an AI draft` : "Connect Gmail to compose replies"}
                    disabled={!connected}
                    rows={4}
                    style={{
                      width: "100%", background: "none", border: "none", outline: "none",
                      fontSize: 13, color: "var(--t1)", padding: "14px 16px",
                      resize: "none", fontFamily: "inherit", lineHeight: 1.7,
                      opacity: connected ? 1 : 0.5,
                      boxSizing: "border-box",
                    }}
                  />
                  {connected && (
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "8px 14px 12px" }}>
                      {draftText && <button onClick={() => setDraftText("")} style={{ padding: "6px 12px", borderRadius: 6, background: "none", border: "1px solid var(--border)", fontSize: 11, fontWeight: 600, color: "var(--t3)", cursor: "pointer" }}>Clear</button>}
                      <button onClick={saveDraft} disabled={drafting || !draftText.trim()} style={{ padding: "6px 16px", borderRadius: 6, background: "rgba(69,137,255,0.12)", border: "1px solid rgba(69,137,255,0.3)", fontSize: 12, fontWeight: 700, color: "var(--blue)", cursor: "pointer", opacity: draftText.trim() ? 1 : 0.4 }}>
                        {drafting ? "Saving…" : "Save Draft"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Email row in left panel ──────────────────────────────────────────── */
function EmailRow({ email, selected, onSelect, onSnooze, onPin, accentColor }: {
  email: Email; selected: boolean; onSelect: () => void;
  onSnooze: () => void; onPin: () => void; accentColor: string;
}) {
  const [hover, setHover] = useState(false);
  const color = avatarColor(email.from);

  return (
    <div style={{ position: "relative" }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button onClick={onSelect} style={{
        display: "flex", alignItems: "flex-start", gap: 10, width: "100%",
        padding: "9px 10px", borderRadius: 8, textAlign: "left", cursor: "pointer",
        background: selected ? `${accentColor}10` : hover ? "rgba(255,255,255,0.02)" : "transparent",
        border: `1px solid ${selected ? accentColor + "30" : "transparent"}`,
        transition: "all .12s",
        borderLeft: email.unread ? `3px solid ${accentColor}` : "3px solid transparent",
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
          background: `${color}15`, border: `1px solid ${color}20`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 10, fontWeight: 700, color,
        }}>
          {initials(email.from)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 2 }}>
            <span style={{ fontSize: 11, fontWeight: email.unread ? 700 : 500, color: email.unread ? "var(--t1)" : "var(--t2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 140 }}>{email.from}</span>
            <span style={{ fontSize: 9, color: "var(--t4)", flexShrink: 0, marginLeft: 4 }}>{email.time}</span>
          </div>
          <p style={{ fontSize: 11, color: email.unread ? "var(--t2)" : "var(--t3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: email.unread ? 500 : 400 }}>{email.subject}</p>
          {email.pinned && <span style={{ fontSize: 9, color: "var(--amber)", fontWeight: 700 }}>◆ Pinned</span>}
        </div>
      </button>

      {/* Hover actions */}
      {hover && (
        <div style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", display: "flex", gap: 4, zIndex: 2 }}>
          <button onClick={e => { e.stopPropagation(); onPin(); }} title="Pin" style={{ width: 22, height: 22, borderRadius: 5, border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--amber)", fontSize: 10 }}>◆</button>
          <button onClick={e => { e.stopPropagation(); onSnooze(); }} title="Dismiss" style={{ width: 22, height: 22, borderRadius: 5, border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--t3)" }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Quick action button ──────────────────────────────────────────────── */
function ActionBtn({ onClick, label, color, primary }: { onClick: () => void; label: string; color: string; primary?: boolean }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 7,
      cursor: "pointer", fontSize: 11, fontWeight: 700,
      background: primary ? `${color}15` : "transparent",
      border: `1px solid ${primary ? color + "40" : "var(--border)"}`,
      color: primary ? color : "var(--t3)", transition: "all .15s",
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = color; (e.currentTarget as HTMLElement).style.color = color; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = primary ? color + "40" : "var(--border)"; (e.currentTarget as HTMLElement).style.color = primary ? color : "var(--t3)"; }}
    >
      {label}
    </button>
  );
}
