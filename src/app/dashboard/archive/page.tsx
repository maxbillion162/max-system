"use client";

import { useState, useEffect } from "react";
import { HudCard } from "@/components/ui/HudCard";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ChatMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

interface Session {
  session_id: string;
  messages: ChatMessage[];
  first_at: string;
  last_at: string;
  preview: string;
  title: string;
}

interface TelegramMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

interface TelegramPair {
  user: TelegramMsg;
  assistant: TelegramMsg | null;
}

type TabType = "chat" | "telegram";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)   return "just now";
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Yesterday";
  if (d < 7)   return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function dateGroup(iso: string): string {
  const now  = new Date();
  const d    = new Date(iso);
  const diff = Math.floor(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() -
     new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000
  );
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7)  return "This Week";
  return "Older";
}

const GROUP_ORDER = ["Today", "Yesterday", "This Week", "Older"];

function groupBySession(messages: ChatMessage[]): Session[] {
  const map = new Map<string, ChatMessage[]>();
  for (const m of messages) {
    if (!map.has(m.session_id)) map.set(m.session_id, []);
    map.get(m.session_id)!.push(m);
  }
  return Array.from(map.entries())
    .map(([session_id, msgs]) => {
      const sorted    = msgs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      const firstUser = sorted.find(m => m.role === "user");
      const last      = sorted[sorted.length - 1];
      const title     = firstUser?.content.slice(0, 60) ?? "Conversation";
      const preview   = sorted.find(m => m.role === "assistant")?.content.slice(0, 100) ?? "";
      return { session_id, messages: sorted, first_at: sorted[0].created_at, last_at: last.created_at, preview, title };
    })
    .sort((a, b) => new Date(b.last_at).getTime() - new Date(a.last_at).getTime());
}

export default function ArchivePage() {
  const [tab,       setTab]       = useState<TabType>("chat");
  const [sessions,  setSessions]  = useState<Session[]>([]);
  const [telegram,  setTelegram]  = useState<TelegramMsg[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [selected,  setSelected]  = useState<Session | null>(null);
  const [selectedTg,setSelectedTg]= useState<TelegramPair | null>(null);
  const [search,    setSearch]    = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [chatRes, tgRes] = await Promise.all([
        supabase.from("chat_messages").select("*").order("created_at", { ascending: false }).limit(400),
        supabase.from("telegram_history").select("*").order("created_at", { ascending: false }).limit(200),
      ]);
      if (chatRes.data) {
        const grouped = groupBySession(chatRes.data as ChatMessage[]);
        setSessions(grouped);
        if (grouped.length > 0) setSelected(grouped[0]);
      }
      if (tgRes.data) setTelegram(tgRes.data as TelegramMsg[]);
      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredSessions = sessions.filter(s =>
    !search || s.title.toLowerCase().includes(search.toLowerCase()) || s.preview.toLowerCase().includes(search.toLowerCase())
  );

  const telegramPairs: TelegramPair[] = [];
  const sorted = [...telegram].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].role === "user") {
      telegramPairs.push({ user: sorted[i], assistant: sorted[i + 1]?.role === "assistant" ? sorted[i + 1] : null });
      if (sorted[i + 1]?.role === "assistant") i++;
    }
  }
  telegramPairs.reverse();

  const filteredTg = telegramPairs.filter(p =>
    !search ||
    p.user.content.toLowerCase().includes(search.toLowerCase()) ||
    (p.assistant?.content ?? "").toLowerCase().includes(search.toLowerCase())
  );

  // Group filtered sessions by date
  const groupedSessions = GROUP_ORDER.reduce((acc, g) => {
    acc[g] = filteredSessions.filter(s => dateGroup(s.last_at) === g);
    return acc;
  }, {} as Record<string, Session[]>);

  return (
    <div style={{ padding: "28px 36px", background: "var(--bg)", minHeight: "100vh" }}>

      {/* Header */}
      <div className="afu" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--t3)", marginBottom: 6 }}>M.A.X. History</p>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--t1)", letterSpacing: "-0.02em" }}>Archive</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { label: "Conversations", value: sessions.length,      color: "var(--blue)"  },
            { label: "Telegram",      value: telegramPairs.length, color: "var(--amber)" },
          ].map(s => (
            <div key={s.label} style={{ padding: "10px 20px", borderRadius: 8, background: "var(--surface)", border: "1px solid var(--border)", textAlign: "center" }}>
              <p style={{ fontSize: 22, fontWeight: 800, color: s.color, fontFamily: "monospace" }}>{s.value}</p>
              <p style={{ fontSize: 10, color: "var(--t3)", fontWeight: 600, marginTop: 2 }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Search + Tabs */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 12px", flex: 1, maxWidth: 360 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--t4)" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search all history…"
            style={{ background: "none", border: "none", outline: "none", fontSize: 12, color: "var(--t1)", flex: 1 }} />
          {search && (
            <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t4)", padding: 0, fontSize: 14, lineHeight: 1 }}>×</button>
          )}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {(["chat", "telegram"] as TabType[]).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "7px 18px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600,
              background: tab === t ? "rgba(125,184,232,0.12)" : "transparent",
              border: `1px solid ${tab === t ? "rgba(125,184,232,0.3)" : "var(--border)"}`,
              color: tab === t ? "var(--blue)" : "var(--t3)", transition: "all .15s", textTransform: "capitalize",
            }}>{t === "chat" ? "Web Chat" : "Telegram"}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
          <div style={{ display: "flex", gap: 6 }}>
            {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--blue)", opacity: 0.5, animation: `bounce 0.8s ease-in-out ${i*0.18}s infinite` }} />)}
          </div>
        </div>
      ) : tab === "chat" ? (

        <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 16, height: "calc(100vh - 240px)" }}>

          {/* Left: session list with date groups */}
          <div style={{ display: "flex", flexDirection: "column", gap: 0, overflowY: "auto" }}>
            {filteredSessions.length === 0 && (
              <div style={{ padding: "40px 20px", textAlign: "center" }}>
                <p style={{ fontSize: 13, color: "var(--t3)", marginBottom: 8 }}>
                  {sessions.length === 0 ? "No conversations yet." : "No results."}
                </p>
                {sessions.length === 0 && (
                  <p style={{ fontSize: 11, color: "var(--t4)", lineHeight: 1.6 }}>Start a chat with M.A.X. and it will appear here.</p>
                )}
              </div>
            )}
            {GROUP_ORDER.map(group => {
              const items = groupedSessions[group];
              if (!items || items.length === 0) return null;
              return (
                <div key={group}>
                  <div style={{ padding: "10px 4px 6px", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(6,182,212,0.35)" }}>
                    {group}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
                    {items.map(s => (
                      <button key={s.session_id} onClick={() => setSelected(s)} style={{
                        textAlign: "left", padding: "12px 14px", borderRadius: 8, cursor: "pointer",
                        background: selected?.session_id === s.session_id ? "rgba(125,184,232,0.08)" : "var(--surface)",
                        border: `1px solid ${selected?.session_id === s.session_id ? "rgba(125,184,232,0.25)" : "var(--border)"}`,
                        transition: "all .15s",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2" strokeLinecap="round">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                          </svg>
                          <span style={{ fontSize: 10, fontWeight: 700, color: "var(--blue)", letterSpacing: "0.06em" }}>CHAT</span>
                          <span style={{ fontSize: 10, color: "var(--t4)", marginLeft: "auto" }}>{timeAgo(s.last_at)}</span>
                        </div>
                        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--t1)", marginBottom: 4, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {s.title}{s.title.length >= 60 ? "…" : ""}
                        </p>
                        <p style={{ fontSize: 11, color: "var(--t3)", lineHeight: 1.4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {s.preview}
                        </p>
                        <p style={{ fontSize: 10, color: "var(--t4)", marginTop: 4 }}>{s.messages.length} messages</p>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: conversation detail */}
          <HudCard style={{ padding: "20px 24px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {!selected ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <p style={{ fontSize: 13, color: "var(--t4)" }}>Select a conversation to view.</p>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 16, paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--t1)", marginBottom: 4, lineHeight: 1.4 }}>
                    {selected.title}{selected.title.length >= 60 ? "…" : ""}
                  </h2>
                  <p style={{ fontSize: 11, color: "var(--t4)" }}>
                    {new Date(selected.first_at).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                    {" · "}
                    {new Date(selected.first_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                    {" · "}
                    {selected.messages.length} messages
                  </p>
                </div>
                <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
                  {selected.messages.map((m, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                      <div style={{
                        maxWidth: "78%", padding: "10px 14px", borderRadius: 10,
                        fontSize: 13, lineHeight: 1.6,
                        ...(m.role === "user"
                          ? { background: "rgba(125,184,232,0.1)", color: "var(--t1)", border: "1px solid rgba(125,184,232,0.2)" }
                          : { background: "var(--surface2)", color: "var(--t2)", border: "1px solid var(--border)" }
                        ),
                      }}>
                        {m.role === "assistant" && (
                          <p style={{ fontSize: 9, fontWeight: 700, color: "var(--blue)", letterSpacing: "0.1em", marginBottom: 4 }}>M.A.X.</p>
                        )}
                        {m.content.split("\n").map((line, li, arr) => (
                          <span key={li}>{line}{li < arr.length - 1 && <br />}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </HudCard>
        </div>

      ) : (

        /* Telegram tab */
        <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 16, height: "calc(100vh - 240px)" }}>
          <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
            {filteredTg.length === 0 && (
              <div style={{ padding: "40px 20px", textAlign: "center" }}>
                <p style={{ fontSize: 13, color: "var(--t3)", marginBottom: 8 }}>
                  {telegramPairs.length === 0 ? "No Telegram messages yet." : "No results."}
                </p>
                {telegramPairs.length === 0 && (
                  <p style={{ fontSize: 11, color: "var(--t4)" }}>Message M.A.X. on Telegram and it will appear here.</p>
                )}
              </div>
            )}
            {filteredTg.map((pair, i) => (
              <button key={i} onClick={() => setSelectedTg(pair)} style={{
                textAlign: "left", padding: "12px 14px", borderRadius: 8, cursor: "pointer",
                background: selectedTg === pair ? "rgba(245,158,11,0.08)" : "var(--surface)",
                border: `1px solid ${selectedTg === pair ? "rgba(245,158,11,0.25)" : "var(--border)"}`,
                transition: "all .15s",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="2" strokeLinecap="round">
                    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "var(--amber)", letterSpacing: "0.06em" }}>TELEGRAM</span>
                  <span style={{ fontSize: 10, color: "var(--t4)", marginLeft: "auto" }}>{timeAgo(pair.user.created_at)}</span>
                </div>
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--t1)", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {pair.user.content}
                </p>
                {pair.assistant && (
                  <p style={{ fontSize: 11, color: "var(--t3)", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 4 }}>
                    {pair.assistant.content}
                  </p>
                )}
              </button>
            ))}
          </div>

          <HudCard style={{ padding: "20px 24px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {!selectedTg ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <p style={{ fontSize: 13, color: "var(--t4)" }}>Select a message to view the full exchange.</p>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 16, paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="2" strokeLinecap="round">
                      <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "var(--amber)", letterSpacing: "0.1em" }}>TELEGRAM</span>
                  </div>
                  <p style={{ fontSize: 11, color: "var(--t4)" }}>
                    {new Date(selectedTg.user.created_at).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                    {" · "}
                    {new Date(selectedTg.user.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <div style={{ maxWidth: "78%", padding: "10px 14px", borderRadius: 10, fontSize: 13, lineHeight: 1.6, background: "rgba(245,158,11,0.08)", color: "var(--t1)", border: "1px solid rgba(245,158,11,0.18)" }}>
                      {selectedTg.user.content}
                    </div>
                  </div>
                  {selectedTg.assistant && (
                    <div style={{ display: "flex", justifyContent: "flex-start" }}>
                      <div style={{ maxWidth: "78%", padding: "10px 14px", borderRadius: 10, fontSize: 13, lineHeight: 1.6, background: "var(--surface2)", color: "var(--t2)", border: "1px solid var(--border)" }}>
                        <p style={{ fontSize: 9, fontWeight: 700, color: "var(--amber)", letterSpacing: "0.1em", marginBottom: 4 }}>M.A.X.</p>
                        {selectedTg.assistant.content.split("\n").map((line, li, arr) => (
                          <span key={li}>{line}{li < arr.length - 1 && <br />}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </HudCard>
        </div>
      )}
    </div>
  );
}
