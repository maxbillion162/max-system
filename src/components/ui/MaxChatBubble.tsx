"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { FeedbackControl } from "@/components/ui/FeedbackControl";

type Msg = { role: "user" | "max"; content: string };

const PAGE_LABELS: Record<string, string> = {
  "/dashboard":          "Command Center",
  "/dashboard/finance":  "Finance Hub",
  "/dashboard/habits":   "Habits",
  "/dashboard/goals":    "Goals HQ",
  "/dashboard/calendar": "Calendar",
  "/dashboard/email":    "Email",
  "/dashboard/feed":     "Intel Feed",
  "/dashboard/archive":  "Archive",
};

async function fetchPageContext(pathname: string): Promise<string> {
  try {
    if (pathname === "/dashboard/feed" || pathname === "/dashboard") {
      const [newsRes, cryptoRes, weatherRes] = await Promise.allSettled([
        fetch("/api/news?count=20").then(r => r.json()),
        fetch("/api/crypto").then(r => r.json()),
        fetch("/api/weather?location=orlando").then(r => r.json()),
      ]);

      let ctx = "";

      if (cryptoRes.status === "fulfilled" && cryptoRes.value.data) {
        const btc = cryptoRes.value.data.find((c: { symbol: string; price: number; change24h: number }) => c.symbol === "BTC");
        const xrp = cryptoRes.value.data.find((c: { symbol: string; price: number; change24h: number }) => c.symbol === "XRP");
        ctx += `\n\nLIVE CRYPTO PRICES:\nBTC: $${Math.round(btc?.price ?? 0).toLocaleString()} (${(btc?.change24h ?? 0).toFixed(2)}% 24h)\nXRP: $${(xrp?.price ?? 0).toFixed(4)} (${(xrp?.change24h ?? 0).toFixed(2)}% 24h)`;
      }

      if (weatherRes.status === "fulfilled" && weatherRes.value.data) {
        const w = weatherRes.value.data;
        ctx += `\n\nCURRENT WEATHER (Orlando): ${w.tempF}°F, ${w.condition}, ${w.precipChance}% rain`;
      }

      if (newsRes.status === "fulfilled" && newsRes.value.data) {
        const articles = newsRes.value.data.slice(0, 15);
        const lines = articles.map((n: { tag: string; title: string; source: string; breaking?: boolean }, i: number) =>
          `${i + 1}. [${n.tag}${n.breaking ? " ⚡BREAKING" : ""}] ${n.title} — ${n.source}`
        ).join("\n");
        ctx += `\n\nCURRENT INTEL FEED (articles now on screen):\n${lines}`;
      }

      return ctx;
    }

    if (pathname === "/dashboard/finance") {
      const cryptoRes = await fetch("/api/crypto").then(r => r.json()).catch(() => null);
      if (cryptoRes?.data) {
        const btc = cryptoRes.data.find((c: { symbol: string; price: number; change24h: number; change7d: number }) => c.symbol === "BTC");
        const xrp = cryptoRes.data.find((c: { symbol: string; price: number; change24h: number; change7d: number }) => c.symbol === "XRP");
        return `\n\nLIVE CRYPTO PRICES:\nBTC: $${Math.round(btc?.price ?? 0).toLocaleString()} (${(btc?.change24h ?? 0).toFixed(2)}% 24h, ${(btc?.change7d ?? 0).toFixed(2)}% 7d)\nXRP: $${(xrp?.price ?? 0).toFixed(4)} (${(xrp?.change24h ?? 0).toFixed(2)}% 24h, ${(xrp?.change7d ?? 0).toFixed(2)}% 7d)`;
      }
    }
  } catch {}

  return "";
}

export default function MaxChatBubble() {
  const [open, setOpen]         = useState(false);
  const [hovered, setHovered]   = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const pathname                = usePathname();
  const bottomRef               = useRef<HTMLDivElement>(null);
  const inputRef                = useRef<HTMLInputElement>(null);
  const pageLabel               = PAGE_LABELS[pathname] ?? "Dashboard";

  useEffect(() => {
    const handler = () => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); };
    window.addEventListener("max-open-chat", handler);
    return () => window.removeEventListener("max-open-chat", handler);
  }, []);

  // Load recent conversation history once — bubble shares state with the chat page
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/chat/history");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !Array.isArray(data.messages)) return;
        // Keep last ~12 messages to fit the bubble; chat page shows more
        const recent = data.messages.slice(-12).map((m: { role: string; content: string }) => ({
          role: m.role === "max" ? "max" as const : "user" as const,
          content: m.content,
        }));
        setMessages(recent);
      } catch {} finally {
        if (!cancelled) setHistoryLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 80);
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [open, messages]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");

    const updated: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(updated);
    setLoading(true);

    // Reserve an assistant slot we'll stream into
    const asstIndex = updated.length;
    setMessages(prev => [...prev, { role: "max", content: "" }]);

    try {
      const liveData = messages.length === 0 ? await fetchPageContext(pathname) : "";
      const contextHeader = `[Context: M.A.X. dashboard — ${pageLabel} page${liveData}]`;

      const apiMessages = updated.map((m, i) => ({
        role: m.role === "max" ? "assistant" : "user",
        content: i === 0 ? `${contextHeader}\n\n${m.content}` : m.content,
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages, surface: "bubble" }),
      });

      if (!res.ok || !res.body) {
        setMessages(prev => prev.map((m, i) => i === asstIndex ? { ...m, content: "Connection error." } : m));
        return;
      }

      // Stream SSE — the chat API returns { t: 'chunk' | 'tool' | 'done' } events
      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        // Events are separated by blank lines per SSE spec
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          try {
            const evt = JSON.parse(payload) as { t: string; text?: string; full?: string };
            if (evt.t === "chunk" && evt.text) {
              full += evt.text;
              setMessages(prev => prev.map((m, i) => i === asstIndex ? { ...m, content: full } : m));
            } else if (evt.t === "done" && evt.full) {
              full = evt.full;
              setMessages(prev => prev.map((m, i) => i === asstIndex ? { ...m, content: full } : m));
            }
          } catch {}
        }
      }

      if (!full) {
        setMessages(prev => prev.map((m, i) => i === asstIndex ? { ...m, content: "No response." } : m));
      }
    } catch {
      setMessages(prev => prev.map((m, i) => i === asstIndex ? { ...m, content: "Connection error." } : m));
    }
    setLoading(false);
  }

  if (pathname === "/dashboard/chat") return null;

  return (
    <>
      {open && (
        <div style={{
          position: "fixed", bottom: 88, right: 24, zIndex: 1000,
          width: 360, height: 460,
          background: "linear-gradient(160deg, #080f1c 0%, #050c18 100%)",
          border: "1px solid rgba(125,184,232,0.14)",
          borderRadius: 16,
          boxShadow: "0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(125,184,232,0.04)",
          display: "flex", flexDirection: "column",
          animation: "fade-up 0.18s ease forwards",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: "1px solid rgba(125,184,232,0.07)", flexShrink: 0 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: "rgba(125,184,232,0.08)", border: "1px solid rgba(125,184,232,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 900, color: "var(--blue)" }}>M</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--t1)", lineHeight: 1 }}>M.A.X.</div>
              <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 2 }}>{pageLabel}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginRight: 6 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--green)", display: "inline-block", animation: "pulse-dot 2s ease-in-out infinite" }} />
              <span style={{ fontSize: 10, color: "var(--green)", fontWeight: 600 }}>Online</span>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t4)", padding: 4, borderRadius: 4, display: "flex", alignItems: "center", transition: "color 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.color = "var(--t2)")}
              onMouseLeave={e => (e.currentTarget.style.color = "var(--t4)")}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 8px", display: "flex", flexDirection: "column", gap: 10 }}>
            {historyLoaded && messages.length === 0 && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, opacity: 0.5 }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--t4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <p style={{ fontSize: 12, color: "var(--t4)", textAlign: "center" }}>Ask about your {pageLabel.toLowerCase()} data</p>
              </div>
            )}
            {messages.map((m, i) => {
              const isLastMax = m.role === "max" && i === messages.length - 1 && !loading && m.content.length > 0;
              return (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start", gap: 4 }}>
                  <div style={{
                    maxWidth: "85%", padding: "8px 12px", borderRadius: 10, fontSize: 13, lineHeight: 1.55,
                    ...(m.role === "user"
                      ? { background: "rgba(125,184,232,0.12)", color: "var(--t1)", border: "1px solid rgba(125,184,232,0.18)" }
                      : { background: "rgba(255,255,255,0.04)", color: "var(--t2)", border: "1px solid rgba(255,255,255,0.05)" }
                    ),
                  }}>
                    {m.content.split("\n").map((line, li, arr) => (
                      <span key={li}>{line}{li < arr.length - 1 && <br />}</span>
                    ))}
                  </div>
                  {isLastMax && (
                    <div style={{ paddingLeft: 4 }}>
                      <FeedbackControl artifactType="chat_response" artifactId={`bubble-${i}-${m.content.slice(0,40)}`} surface="bubble" variant="inline" />
                    </div>
                  )}
                </div>
              );
            })}
            {loading && (
              <div style={{ display: "flex", gap: 5, padding: "6px 12px" }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--blue)", opacity: 0.5, animation: `bounce 0.8s ease-in-out ${i * 0.18}s infinite` }} />
                ))}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div style={{ padding: "8px 12px 12px", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(125,184,232,0.1)", borderRadius: 8, padding: "8px 12px" }}>
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
                placeholder={`Ask about ${pageLabel.toLowerCase()}…`}
                style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 13, color: "var(--t1)" }}
              />
              <button onClick={send} disabled={!input.trim() || loading} style={{ background: "none", border: "none", cursor: input.trim() ? "pointer" : "default", color: input.trim() ? "var(--blue)" : "var(--t4)", display: "flex", alignItems: "center", padding: 2, transition: "color 0.15s" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen(o => !o)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        title="Ask M.A.X."
        style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 1001,
          width: 52, height: 52, borderRadius: "50%",
          background: open ? "linear-gradient(135deg, #1e40af, #2563eb)" : "linear-gradient(135deg, #080f1c, #060c18)",
          border: `1px solid rgba(125,184,232,${open ? "0.5" : hovered ? "0.35" : "0.18"})`,
          boxShadow: open ? "0 0 32px rgba(125,184,232,0.35), 0 4px 20px rgba(0,0,0,0.5)" : hovered ? "0 0 20px rgba(125,184,232,0.15), 0 4px 16px rgba(0,0,0,0.4)" : "0 4px 16px rgba(0,0,0,0.4)",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          opacity: open || hovered ? 1 : 0.5,
          transition: "all 0.2s ease",
        }}
      >
        {open ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
        ) : (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </button>
    </>
  );
}
