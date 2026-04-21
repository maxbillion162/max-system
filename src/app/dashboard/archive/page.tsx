"use client";

import { useState } from "react";
import { HudCard } from "@/components/ui/HudCard";

type FilterType = "all" | "chat" | "action" | "telegram";
type SortType   = "newest" | "oldest";

interface ArchiveEntry {
  id: string;
  type: "chat" | "action" | "telegram";
  title: string;
  preview: string;
  timestamp: string;
  messages?: { role: "user" | "max"; content: string }[];
  actionDetail?: string;
}

/* Placeholder data — will be replaced with real Supabase history in Phase 4 */
const SAMPLE: ArchiveEntry[] = [
  {
    id: "1", type: "chat", title: "Portfolio Analysis",
    preview: "What's my net worth right now and how is crypto performing?",
    timestamp: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    messages: [
      { role: "user", content: "What's my net worth right now and how is crypto performing?" },
      { role: "max",  content: "Your tracked net worth sits at $8,420. BTC is up 3.2% today adding $54 to your position. XRP is flat at +0.4%. IRA and cash holdings are unchanged. You're up ~$56 on the day from crypto movement alone." },
      { role: "user", content: "Should I add more to BTC this week?" },
      { role: "max",  content: "Your emergency fund is at $2,800 of a $10K target. Until that's fully funded, putting more into BTC adds risk. If you have discretionary cash above your monthly needs, small adds are fine — but the emergency fund should take priority at your stage." },
    ],
  },
  {
    id: "2", type: "action", title: "Task Added",
    preview: "Added task: Review Q2 pipeline before Thursday meeting",
    timestamp: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    actionDetail: "Task 'Review Q2 pipeline before Thursday meeting' added to task list with high priority.",
  },
  {
    id: "3", type: "telegram", title: "Telegram: /crypto",
    preview: "BTC $94,210 (+3.2%) · XRP $2.29 (+0.4%)",
    timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    messages: [
      { role: "user", content: "/crypto" },
      { role: "max",  content: "Crypto — Live\nBTC  $94,210  (+3.2% 24h)\nXRP  $2.2900  (+0.4% 24h)" },
    ],
  },
  {
    id: "4", type: "chat", title: "Habit Check-in",
    preview: "Can you summarize my habit performance this week?",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    messages: [
      { role: "user", content: "Can you summarize my habit performance this week?" },
      { role: "max",  content: "Gym streak is strong at 12 days — don't break that. Morning routine is your weakest link, 2/5 this week. Protein goal missed 3 days. The pattern is evening discipline breaks down when you miss the gym. Worth tracking that correlation." },
    ],
  },
  {
    id: "5", type: "action", title: "Wealth Updated",
    preview: "BTC holdings updated: 0.02 → 0.025 BTC",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
    actionDetail: "Portfolio updated via Finance Hub. BTC amount changed from 0.02 to 0.025 BTC. Net worth recalculated.",
  },
  {
    id: "6", type: "telegram", title: "Telegram: Morning status",
    preview: "How are my habits looking today?",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
    messages: [
      { role: "user", content: "How are my habits looking today?" },
      { role: "max",  content: "3 of 6 habits done. Gym: ✅ Workout logged: ✅ Morning routine: ✅ Read 30 min: ❌ Phone off by 11: ❌ Protein goal: ❌\n\nSolid start. Get the reading in before tonight." },
    ],
  },
];

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const TYPE_COLOR: Record<string, string> = {
  chat:     "var(--blue)",
  action:   "var(--green)",
  telegram: "var(--amber)",
};

const TYPE_LABEL: Record<string, string> = {
  chat:     "Chat",
  action:   "Action",
  telegram: "Telegram",
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  chat: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  action: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  telegram: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  ),
};

export default function ArchivePage() {
  const [filter,   setFilter]   = useState<FilterType>("all");
  const [sort,     setSort]     = useState<SortType>("newest");
  const [search,   setSearch]   = useState("");
  const [selected, setSelected] = useState<ArchiveEntry | null>(SAMPLE[0]);

  const filtered = SAMPLE
    .filter(e => filter === "all" || e.type === filter)
    .filter(e => !search || e.title.toLowerCase().includes(search.toLowerCase()) || e.preview.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sort === "newest"
      ? new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      : new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

  const stats = {
    chats:    SAMPLE.filter(e => e.type === "chat").length,
    actions:  SAMPLE.filter(e => e.type === "action").length,
    telegram: SAMPLE.filter(e => e.type === "telegram").length,
  };

  return (
    <div style={{ padding: "28px 36px", background: "var(--bg)", minHeight: "100vh" }}>

      {/* ── HEADER ── */}
      <div className="afu" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--t3)", marginBottom: 6 }}>M.A.X. History</p>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--t1)", letterSpacing: "-0.02em" }}>Archive</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { label: "Conversations", value: stats.chats,    color: "var(--blue)"  },
            { label: "Actions",       value: stats.actions,  color: "var(--green)" },
            { label: "Telegram",      value: stats.telegram, color: "var(--amber)" },
          ].map(s => (
            <div key={s.label} style={{ padding: "10px 16px", borderRadius: 8, background: "var(--surface)", border: "1px solid var(--border)", textAlign: "center" }}>
              <p style={{ fontSize: 22, fontWeight: 800, color: s.color, fontFamily: "monospace" }}>{s.value}</p>
              <p style={{ fontSize: 10, color: "var(--t3)", fontWeight: 600, marginTop: 2 }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 16, height: "calc(100vh - 180px)" }}>

        {/* ── LEFT: Entry list ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

          {/* Controls */}
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 12px" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--t4)" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search archive…"
                style={{ background: "none", border: "none", outline: "none", fontSize: 12, color: "var(--t1)", flex: 1 }} />
            </div>
            <select value={sort} onChange={e => setSort(e.target.value as SortType)} style={{
              background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8,
              padding: "7px 10px", fontSize: 11, color: "var(--t2)", outline: "none", cursor: "pointer",
            }}>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </select>
          </div>

          {/* Filter tabs */}
          <div style={{ display: "flex", gap: 4 }}>
            {(["all","chat","action","telegram"] as FilterType[]).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                flex: 1, padding: "6px 0", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600,
                background: filter === f ? "rgba(69,137,255,0.12)" : "transparent",
                border: `1px solid ${filter === f ? "rgba(69,137,255,0.3)" : "var(--border)"}`,
                color: filter === f ? "var(--blue)" : "var(--t3)", transition: "all .15s",
                textTransform: "capitalize",
              }}>{f}</button>
            ))}
          </div>

          {/* Entry list */}
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
            {filtered.length === 0 && (
              <p style={{ fontSize: 12, color: "var(--t4)", textAlign: "center", padding: "40px 0" }}>No entries found.</p>
            )}
            {filtered.map(entry => (
              <button key={entry.id} onClick={() => setSelected(entry)} style={{
                textAlign: "left", padding: "12px 14px", borderRadius: 8, cursor: "pointer",
                background: selected?.id === entry.id ? "rgba(69,137,255,0.08)" : "var(--surface)",
                border: `1px solid ${selected?.id === entry.id ? "rgba(69,137,255,0.25)" : "var(--border)"}`,
                transition: "all .15s",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ color: TYPE_COLOR[entry.type], display: "flex" }}>{TYPE_ICON[entry.type]}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: TYPE_COLOR[entry.type], letterSpacing: "0.06em" }}>{TYPE_LABEL[entry.type].toUpperCase()}</span>
                  <span style={{ fontSize: 10, color: "var(--t4)", marginLeft: "auto" }}>{timeAgo(entry.timestamp)}</span>
                </div>
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--t1)", marginBottom: 4, lineHeight: 1.4 }}>{entry.title}</p>
                <p style={{ fontSize: 11, color: "var(--t3)", lineHeight: 1.4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{entry.preview}</p>
              </button>
            ))}
          </div>
        </div>

        {/* ── RIGHT: Detail view ── */}
        <HudCard style={{ padding: "20px 24px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {!selected ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <p style={{ fontSize: 13, color: "var(--t4)" }}>Select an entry to view details.</p>
            </div>
          ) : (
            <>
              {/* Detail header */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16, paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ color: TYPE_COLOR[selected.type], display: "flex" }}>{TYPE_ICON[selected.type]}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: TYPE_COLOR[selected.type], letterSpacing: "0.08em" }}>{TYPE_LABEL[selected.type].toUpperCase()}</span>
                  </div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--t1)", marginBottom: 4 }}>{selected.title}</h2>
                  <p style={{ fontSize: 11, color: "var(--t4)" }}>
                    {new Date(selected.timestamp).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                    {" · "}
                    {new Date(selected.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <div style={{ padding: "4px 10px", borderRadius: 20, background: `${TYPE_COLOR[selected.type]}15`, border: `1px solid ${TYPE_COLOR[selected.type]}30` }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: TYPE_COLOR[selected.type] }}>{timeAgo(selected.timestamp)}</span>
                </div>
              </div>

              {/* Action detail */}
              {selected.type === "action" && selected.actionDetail && (
                <div style={{ padding: "14px 16px", borderRadius: 8, background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.12)", marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "var(--green)", letterSpacing: "0.08em" }}>ACTION COMPLETED</span>
                  </div>
                  <p style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.6 }}>{selected.actionDetail}</p>
                </div>
              )}

              {/* Conversation */}
              {selected.messages && (
                <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
                  {selected.messages.map((m, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                      <div style={{
                        maxWidth: "78%", padding: "10px 14px", borderRadius: 10,
                        fontSize: 13, lineHeight: 1.6,
                        ...(m.role === "user"
                          ? { background: "rgba(69,137,255,0.1)", color: "var(--t1)", border: "1px solid rgba(69,137,255,0.2)" }
                          : { background: "var(--surface2)", color: "var(--t2)", border: "1px solid var(--border)" }
                        ),
                      }}>
                        {m.role === "max" && (
                          <p style={{ fontSize: 9, fontWeight: 700, color: "var(--blue)", letterSpacing: "0.1em", marginBottom: 4 }}>M.A.X.</p>
                        )}
                        {m.content.split("\n").map((line, li, arr) => (
                          <span key={li}>{line}{li < arr.length - 1 && <br />}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </HudCard>
      </div>
    </div>
  );
}
