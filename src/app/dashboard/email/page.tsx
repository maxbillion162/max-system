"use client";

import { useState, useEffect } from "react";
import { HudCard } from "@/components/ui/HudCard";

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
}

const CAT_META = {
  action: { label: "Action Required", color: "var(--red)",   dot: "#ef4444", bg: "rgba(239,68,68,0.06)",   border: "rgba(239,68,68,0.14)"   },
  fyi:    { label: "FYI",             color: "var(--blue)",  dot: "#4589ff", bg: "rgba(69,137,255,0.06)",  border: "rgba(69,137,255,0.14)"  },
  noise:  { label: "Noise",           color: "var(--t3)",    dot: "#50596a", bg: "rgba(255,255,255,0.02)", border: "var(--border)"          },
};

type Cat = "all" | "action" | "fyi" | "noise";

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
  const now  = Date.now();
  const diff = now - d.getTime();
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

function Avatar({ name, color }: { name: string; color: string }) {
  const initials = name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: `${color}18`, border: `1px solid ${color}25`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color }}>
      {initials || "?"}
    </div>
  );
}

const PLACEHOLDER_EMAILS: Email[] = [
  { id: "1", threadId: "1", from: "Sarah M.", fromEmail: "sarah@example.com", category: "action", subject: "Contract revision needed", preview: "Hey Max, the client needs a few changes to the contract before they can sign.", body: "Hey Max, the client needs a few changes to the contract before they can sign. Can you review and get back to me by EOD?", time: "9:14 AM", unread: true, labels: ["IMPORTANT"] },
  { id: "2", threadId: "2", from: "HR Department", fromEmail: "hr@example.com", category: "action", subject: "Onboarding paperwork due Friday", preview: "Your onboarding documents must be submitted before your start date.", body: "Your onboarding documents must be submitted before your start date. Log in to the portal to complete all required forms.", time: "8:02 AM", unread: true, labels: ["IMPORTANT"] },
  { id: "3", threadId: "3", from: "CoinDesk", fromEmail: "news@coindesk.com", category: "fyi", subject: "BTC breaks $94K", preview: "Bitcoin surged past $94,000 this morning on strong institutional inflows.", body: "Bitcoin surged past $94,000 this morning on strong institutional inflows. Multiple analysts are now revising price targets upward.", time: "7:45 AM", unread: false, labels: [] },
  { id: "4", threadId: "4", from: "Spotify", fromEmail: "no-reply@spotify.com", category: "noise", subject: "Your Weekly Discover playlist is ready", preview: "We found 30 new songs based on your listening history.", body: "We found 30 new songs based on your listening history. Check out your Discover Weekly playlist now.", time: "6:00 AM", unread: false, labels: ["CATEGORY_UPDATES"] },
];

export default function EmailPage() {
  const [emails,    setEmails]    = useState<Email[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading,   setLoading]   = useState(true);
  const [cat,       setCat]       = useState<Cat>("all");
  const [selected,  setSelected]  = useState<Email | null>(null);
  const [search,    setSearch]    = useState("");
  const [drafting,     setDrafting]     = useState(false);
  const [draftText,    setDraftText]    = useState("");
  const [draftSent,    setDraftSent]    = useState(false);
  const [aiDigest,     setAiDigest]     = useState("");
  const [aiActions,    setAiActions]    = useState<Record<string, string>>({});
  const [digestLoading,setDigestLoading]= useState(false);

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
            return {
              id: e.id,
              threadId: e.threadId,
              from: name,
              fromEmail: email,
              subject: e.subject,
              preview: e.snippet,
              body: e.body,
              time: relativeTime(e.date),
              unread: e.unread,
              labels: e.labels,
              category: categorize(e.labels),
            };
          });
          setEmails(parsed);
          setSelected(parsed[0] ?? null);

          // Generate AI inbox digest
          setDigestLoading(true);
          fetch("/api/email/digest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              emails: parsed.map(e => ({ from: e.from, subject: e.subject, snippet: e.preview, category: e.category })),
            }),
          })
            .then(r => r.json())
            .then(j => {
              if (j.digest) setAiDigest(j.digest);
              if (j.actions) setAiActions(j.actions);
            })
            .catch(() => {})
            .finally(() => setDigestLoading(false));
        } else {
          setEmails(PLACEHOLDER_EMAILS);
          setSelected(PLACEHOLDER_EMAILS[0]);
        }
      })
      .catch(() => {
        setEmails(PLACEHOLDER_EMAILS);
        setSelected(PLACEHOLDER_EMAILS[0]);
      })
      .finally(() => setLoading(false));
  }, []);

  async function sendDraft() {
    if (!selected || !draftText.trim()) return;
    setDrafting(true);
    try {
      await fetch("/api/google/gmail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: selected.fromEmail,
          subject: `Re: ${selected.subject}`,
          body: draftText,
          threadId: selected.threadId,
        }),
      });
      setDraftSent(true);
      setDraftText("");
      setTimeout(() => setDraftSent(false), 3000);
    } finally {
      setDrafting(false);
    }
  }

  const filtered = emails.filter(e => {
    const matchCat    = cat === "all" || e.category === cat;
    const matchSearch = !search || e.subject.toLowerCase().includes(search.toLowerCase()) || e.from.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const unreadCount  = emails.filter(e => e.unread).length;
  const actionCount  = emails.filter(e => e.category === "action").length;
  const actionUnread = emails.filter(e => e.category === "action" && e.unread).length;
  const fyi          = emails.filter(e => e.category === "fyi");
  const noise        = emails.filter(e => e.category === "noise");

  const aiSummary = connected
    ? (aiDigest || (digestLoading ? "Analyzing your inbox…" : `${actionCount} action item${actionCount !== 1 ? "s" : ""}${actionUnread > 0 ? ` (${actionUnread} unread)` : ""}. ${fyi.length} FYI, ${noise.length} noise.`))
    : "Connect Gmail to get your real inbox with M.A.X. AI triage.";

  if (loading) {
    return (
      <div style={{ display: "flex", height: "100vh", background: "var(--bg)", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", gap: 6 }}>
            {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--blue)", opacity: 0.5, animation: `bounce 0.8s ease-in-out ${i * 0.18}s infinite` }} />)}
          </div>
          <p style={{ fontSize: 12, color: "var(--t4)" }}>Loading inbox…</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--bg)", overflow: "hidden" }}>

      {/* LEFT NAV */}
      <div style={{ width: 220, flexShrink: 0, borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", padding: "28px 0" }}>
        <div style={{ padding: "0 20px 24px" }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--t3)", marginBottom: 4 }}>Inbox</p>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--t1)", letterSpacing: "-0.02em" }}>Email</h2>
          {connected && <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 5 }}><span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--green)", display: "inline-block" }} /><span style={{ fontSize: 10, color: "var(--green)", fontWeight: 600 }}>Gmail live</span></div>}
        </div>

        <div style={{ padding: "0 12px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 12px" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--t4)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" style={{ background: "none", border: "none", outline: "none", fontSize: 12, color: "var(--t1)", flex: 1 }} />
          </div>
        </div>

        <nav style={{ flex: 1, padding: "0 8px" }}>
          {([
            { id: "all",    label: "All Mail",        count: emails.length,   badge: 0,           icon: "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6" },
            { id: "action", label: "Action Required", count: actionCount,      badge: actionUnread, icon: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" },
            { id: "fyi",    label: "FYI",              count: fyi.length,       badge: 0,           icon: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" },
            { id: "noise",  label: "Noise",            count: noise.length,     badge: 0,           icon: "M18 6L6 18M6 6l12 12" },
          ] as { id: Cat; label: string; count: number; badge: number; icon: string }[]).map(item => (
            <button key={item.id} onClick={() => setCat(item.id)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 12px", borderRadius: 8, cursor: "pointer", marginBottom: 2, textAlign: "left", background: cat === item.id ? "rgba(69,137,255,0.08)" : "transparent", border: `1px solid ${cat === item.id ? "rgba(69,137,255,0.2)" : "transparent"}`, transition: "all .15s" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={cat === item.id ? "var(--blue)" : "var(--t3)"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={item.icon} /></svg>
              <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: cat === item.id ? "var(--t1)" : "var(--t3)" }}>{item.label}</span>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                {item.badge > 0 && <span style={{ fontSize: 10, fontWeight: 800, color: "var(--red)", background: "rgba(239,68,68,0.12)", padding: "1px 5px", borderRadius: 3 }}>{item.badge}</span>}
                <span style={{ fontSize: 10, color: "var(--t4)", fontFamily: "monospace" }}>{item.count}</span>
              </div>
            </button>
          ))}
        </nav>

        {!connected && (
          <div style={{ margin: "0 12px 12px", padding: "12px 14px", borderRadius: 10, background: "rgba(69,137,255,0.05)", border: "1px solid rgba(69,137,255,0.15)" }}>
            <p style={{ fontSize: 10, color: "var(--t4)", lineHeight: 1.5, marginBottom: 8 }}>Connect your real Gmail inbox</p>
            <a href="/api/auth/google" style={{ display: "block", textAlign: "center", padding: "7px 12px", borderRadius: 7, background: "rgba(69,137,255,0.12)", border: "1px solid rgba(69,137,255,0.3)", color: "var(--blue)", fontSize: 11, fontWeight: 700, textDecoration: "none" }}>Connect Gmail</a>
          </div>
        )}

        <div style={{ padding: "16px 20px 0", display: "flex", gap: 16 }}>
          <div><p style={{ fontSize: 18, fontWeight: 800, color: "var(--blue)", fontFamily: "monospace" }}>{unreadCount}</p><p style={{ fontSize: 9, color: "var(--t4)", fontWeight: 600 }}>UNREAD</p></div>
          <div><p style={{ fontSize: 18, fontWeight: 800, color: "var(--red)", fontFamily: "monospace" }}>{actionCount}</p><p style={{ fontSize: 9, color: "var(--t4)", fontWeight: 600 }}>ACTION</p></div>
        </div>
      </div>

      {/* EMAIL LIST */}
      <div style={{ width: 380, flexShrink: 0, borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", borderRadius: 10, background: "rgba(69,137,255,0.05)", border: "1px solid rgba(69,137,255,0.1)" }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: "rgba(69,137,255,0.1)", border: "1px solid rgba(69,137,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 900, color: "var(--blue)" }}>M</span>
            </div>
            <p style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.6, flex: 1 }}>{aiSummary}</p>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {filtered.map(email => {
            const meta       = CAT_META[email.category];
            const isSelected = selected?.id === email.id;
            return (
              <button key={email.id} onClick={() => setSelected(email)} style={{ display: "flex", alignItems: "flex-start", gap: 12, width: "100%", padding: "14px 16px", textAlign: "left", cursor: "pointer", background: isSelected ? "rgba(69,137,255,0.07)" : "transparent", borderBottom: "1px solid var(--border)", borderLeft: `3px solid ${email.unread ? meta.dot : "transparent"}`, transition: "background .12s" }}
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
          {filtered.length === 0 && <p style={{ fontSize: 12, color: "var(--t4)", textAlign: "center", padding: "40px 0" }}>No emails.</p>}
        </div>
      </div>

      {/* EMAIL DETAIL */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {!selected ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <p style={{ fontSize: 13, color: "var(--t4)" }}>Select an email to read</p>
          </div>
        ) : (
          <>
            <div style={{ padding: "24px 32px 20px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 3, background: CAT_META[selected.category].bg, border: `1px solid ${CAT_META[selected.category].border}`, color: CAT_META[selected.category].color }}>{CAT_META[selected.category].label}</span>
                    {selected.unread && <span style={{ fontSize: 10, fontWeight: 700, color: "var(--blue)" }}>UNREAD</span>}
                  </div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--t1)", lineHeight: 1.3, letterSpacing: "-0.01em" }}>{selected.subject}</h2>
                </div>
                <button onClick={() => window.dispatchEvent(new CustomEvent("max-open-chat"))} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 8, cursor: "pointer", flexShrink: 0, marginLeft: 16, background: "rgba(69,137,255,0.08)", border: "1px solid rgba(69,137,255,0.2)", fontSize: 11, fontWeight: 700, color: "var(--blue)" }}>
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

            <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px" }}>
              <div style={{ maxWidth: 640 }}>
                {/* M.A.X. action hint for action-category emails */}
                {selected.category === "action" && aiActions[selected.subject] && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 14px", borderRadius: 8, marginBottom: 20, background: "rgba(69,137,255,0.05)", border: "1px solid rgba(69,137,255,0.15)" }}>
                    <div style={{ width: 20, height: 20, borderRadius: 5, background: "rgba(69,137,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ fontSize: 9, fontWeight: 900, color: "var(--blue)" }}>M</span>
                    </div>
                    <p style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.6 }}>
                      <span style={{ fontWeight: 700, color: "var(--blue)" }}>Action: </span>
                      {aiActions[selected.subject]}
                    </p>
                  </div>
                )}
                {selected.body ? (
                  <pre style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.8, whiteSpace: "pre-wrap", fontFamily: "inherit", margin: 0 }}>{selected.body}</pre>
                ) : (
                  <p style={{ fontSize: 14, color: "var(--t2)", lineHeight: 1.8 }}>{selected.preview}</p>
                )}
              </div>
            </div>

            <div style={{ padding: "16px 32px 24px", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
              {draftSent ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderRadius: 10, background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.18)" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                  <p style={{ fontSize: 12, color: "var(--green)", fontWeight: 600 }}>Draft saved to Gmail</p>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 10, alignItems: "center", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 16px" }}>
                  <input
                    value={draftText}
                    onChange={e => setDraftText(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendDraft()}
                    placeholder={connected ? `Reply to ${selected.from}…` : "Connect Gmail to reply…"}
                    disabled={!connected}
                    style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 13, color: "var(--t1)", opacity: connected ? 1 : 0.5 }}
                  />
                  {connected && (
                    <button onClick={sendDraft} disabled={drafting || !draftText.trim()} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 7, background: "rgba(69,137,255,0.1)", border: "1px solid rgba(69,137,255,0.2)", cursor: draftText.trim() ? "pointer" : "default", fontSize: 12, fontWeight: 700, color: "var(--blue)", opacity: draftText.trim() ? 1 : 0.4 }}>
                      {drafting ? "Saving…" : "Draft"}
                    </button>
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
