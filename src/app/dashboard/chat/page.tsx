"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";

/* ─── Types ──────────────────────────────────────────────────────── */
type Msg = {
  role:    "user" | "max";
  content: string;
  time:    string;
  tools?:  string[];   // tool labels that fired to produce this message
};

interface ISpeechRecognition extends EventTarget {
  lang: string; interimResults: boolean; maxAlternatives: number;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: { results: { [i: number]: { [i: number]: { transcript: string } } } }) => void) | null;
  onerror: (() => void) | null; onend: (() => void) | null;
}
declare global {
  interface Window {
    SpeechRecognition: new () => ISpeechRecognition;
    webkitSpeechRecognition: new () => ISpeechRecognition;
  }
}

const INITIAL: Msg = {
  role:    "max",
  content: "Online. Loading your daily brief…",
  time:    new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
};

/* Time-based contextual suggestions */
function getSuggestions() {
  const h = new Date().getHours();
  if (h < 10) return ["Brief me for today", "What habits need to be done?", "What's on my calendar today?", "Check BTC and XRP prices"];
  if (h < 14) return ["How am I tracking on habits?", "What's my highest priority task?", "Any urgent emails?", "Search latest AI news"];
  if (h < 18) return ["What should I focus on now?", "Draft a reply to my top email", "Update my goal progress", "Add a task"];
  return ["Recap my day", "How'd I do on habits today?", "What's BTC doing?", "Set a reminder for tomorrow"];
}

/* ── Markdown renderer ───────────────────────────────────────────── */
function MarkdownText({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^[-•*]\s/.test(line)) {
      const bullets: string[] = [];
      while (i < lines.length && /^[-•*]\s/.test(lines[i])) { bullets.push(lines[i].replace(/^[-•*]\s/, "")); i++; }
      elements.push(<ul key={i} style={{ margin: "4px 0 4px 16px", padding: 0, listStyleType: "disc" }}>{bullets.map((b, bi) => <li key={bi} style={{ marginBottom: 2 }}>{renderInline(b)}</li>)}</ul>);
      continue;
    }
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) { items.push(lines[i].replace(/^\d+\.\s/, "")); i++; }
      elements.push(<ol key={i} style={{ margin: "4px 0 4px 16px", padding: 0 }}>{items.map((b, bi) => <li key={bi} style={{ marginBottom: 2 }}>{renderInline(b)}</li>)}</ol>);
      continue;
    }
    if (/^#{1,3}\s/.test(line)) {
      const t = line.replace(/^#{1,3}\s/, "");
      elements.push(<p key={i} style={{ fontWeight: 700, color: "var(--teal)", fontSize: 13, margin: "6px 0 2px" }}>{renderInline(t)}</p>);
      i++; continue;
    }
    if (line.trim() === "") { elements.push(<br key={i} />); i++; continue; }
    elements.push(<p key={i} style={{ margin: "1px 0" }}>{renderInline(line)}</p>);
    i++;
  }
  return <>{elements}</>;
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) return <em key={i}>{part.slice(1, -1)}</em>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={i} style={{ fontFamily: "monospace", background: "rgba(6,182,212,0.1)", padding: "1px 4px", borderRadius: 3, fontSize: "0.9em" }}>{part.slice(1, -1)}</code>;
    return part;
  });
}

/* ── Message action button ───────────────────────────────────────── */
function MsgActions({ content }: { content: string }) {
  const [copied,   setCopied]   = useState(false);
  const [memSaved, setMemSaved] = useState(false);
  const [tgSent,   setTgSent]   = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(content);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  async function saveToMemory() {
    try {
      await fetch("/api/memory", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content, tags: ["chat"] }) });
      setMemSaved(true); setTimeout(() => setMemSaved(false), 2000);
    } catch {}
  }

  async function sendToTelegram() {
    try {
      await fetch("/api/telegram/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: content }) });
      setTgSent(true); setTimeout(() => setTgSent(false), 2000);
    } catch {}
  }

  const btn: React.CSSProperties = {
    padding: "4px 9px", borderRadius: 5, border: "1px solid rgba(255,255,255,0.08)",
    cursor: "pointer", fontSize: 10, fontWeight: 600, letterSpacing: "0.05em",
    background: "rgba(255,255,255,0.03)", color: "var(--t4)", transition: "all .15s",
    display: "flex", alignItems: "center", gap: 4,
  };

  return (
    <div style={{ display: "flex", gap: 4, marginTop: 4, opacity: 1 }}>
      <button onClick={copy} style={{ ...btn, color: copied ? "var(--green)" : "var(--t4)" }}>
        {copied ? "✓ Copied" : "Copy"}
      </button>
      <button onClick={saveToMemory} style={{ ...btn, color: memSaved ? "var(--blue)" : "var(--t4)" }}>
        {memSaved ? "✓ Saved" : "◈ Memory"}
      </button>
      <button onClick={sendToTelegram} style={{ ...btn, color: tgSent ? "var(--amber)" : "var(--t4)" }}>
        {tgSent ? "✓ Sent" : "✈ Telegram"}
      </button>
    </div>
  );
}

/* ── Tool badges ─────────────────────────────────────────────────── */
function ToolBadges({ tools }: { tools: string[] }) {
  if (!tools.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
      {tools.map((t, i) => (
        <span key={i} style={{
          fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
          padding: "2px 7px", borderRadius: 3,
          background: "rgba(6,182,212,0.06)", border: "1px solid rgba(6,182,212,0.15)",
          color: "rgba(6,182,212,0.5)",
        }}>
          ◎ {t.replace("…", "")}
        </span>
      ))}
    </div>
  );
}

/* ── Main page ────────────────────────────────────────────────────── */
export default function ChatPage() {
  const [messages,     setMessages]     = useState<Msg[]>([INITIAL]);
  const [input,        setInput]        = useState("");
  const [loading,      setLoading]      = useState(false);
  const [toolActivity, setToolActivity] = useState<string | null>(null);
  const [streamingIdx, setStreamingIdx] = useState<number | null>(null);
  const [isListening,  setIsListening]  = useState(false);
  const [voiceOut,     setVoiceOut]     = useState(false);
  const [briefLoaded,  setBriefLoaded]  = useState(false);
  const [hoveredIdx,   setHoveredIdx]   = useState<number | null>(null);
  const [historyLoaded,setHistoryLoaded]= useState(false);
  const bottomRef      = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const sessionId      = useMemo(() => crypto.randomUUID(), []);
  const suggestions    = useMemo(() => getSuggestions(), []);

  /* Load chat history from Supabase, fallback to localStorage */
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/chat/history");
        const { messages: hist } = await res.json() as { messages: Msg[] };
        if (hist?.length > 0) {
          setMessages(hist);
          setBriefLoaded(true);
          setHistoryLoaded(true);
          return;
        }
      } catch {}

      // Fallback: localStorage
      try {
        const saved = localStorage.getItem("max-chat-messages");
        if (saved) {
          const parsed = JSON.parse(saved) as Msg[];
          if (parsed.length > 1) {
            setMessages(parsed.slice(-60));
            setBriefLoaded(true);
            setHistoryLoaded(true);
            return;
          }
        }
      } catch {}

      // Draft context
      try {
        const draft = localStorage.getItem("max-draft-context");
        if (draft) { setInput(draft); localStorage.removeItem("max-draft-context"); }
      } catch {}

      fetchBrief();
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchBrief() {
    if (briefLoaded) return;
    setBriefLoaded(true);
    try {
      const res  = await fetch("/api/chat/brief");
      const data = await res.json();
      if (data.brief) {
        setMessages([{ role: "max", content: data.brief, time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) }]);
      }
    } catch {
      setMessages([{ role: "max", content: "Online. What do you need, Max?", time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) }]);
    }
  }

  /* Sync to localStorage as cache */
  useEffect(() => {
    if (messages.length > 1) {
      try { localStorage.setItem("max-chat-messages", JSON.stringify(messages.slice(-60))); } catch {}
    }
  }, [messages]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, streamingIdx]);
  useEffect(() => () => { recognitionRef.current?.abort(); }, []);

  function speakText(text: string) {
    if (!voiceOut || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[*_`#]/g, ""));
    u.rate = 1.05; u.pitch = 0.92; u.volume = 1;
    const voices = window.speechSynthesis.getVoices();
    const pref = voices.find(v => v.name.includes("Google") && v.lang.startsWith("en")) ?? voices.find(v => v.lang.startsWith("en-US"));
    if (pref) u.voice = pref;
    window.speechSynthesis.speak(u);
  }

  const toggleMic = useCallback(() => {
    const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) { alert("Voice input not supported in this browser."); return; }
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    const r = new SR();
    r.lang = "en-US"; r.interimResults = false; r.maxAlternatives = 1;
    r.onresult = (e) => { setInput(e.results[0][0].transcript); setIsListening(false); };
    r.onerror  = () => setIsListening(false);
    r.onend    = () => setIsListening(false);
    recognitionRef.current = r; r.start(); setIsListening(true);
  }, [isListening]);

  async function send(text?: string) {
    const content = text || input.trim();
    if (!content || loading) return;
    setInput("");
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); }

    const now = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    const withUser: Msg[] = [...messages, { role: "user", content, time: now }];
    setMessages(withUser);
    setLoading(true);
    setToolActivity(null);

    const placeholder: Msg = { role: "max", content: "", time: now, tools: [] };
    const sIdx = withUser.length;
    setMessages(prev => [...prev, placeholder]);
    setStreamingIdx(sIdx);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          messages: withUser.map(m => ({ role: m.role === "max" ? "model" : "user", content: m.content })),
        }),
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let   buffer  = "";
      let   full    = "";
      const firedTools: string[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6)) as { t: string; label?: string; text?: string; full?: string; tools?: string[] };

            if (event.t === "tool" && event.label) {
              firedTools.push(event.label);
              setToolActivity(event.label);
              setMessages(prev => {
                const next = [...prev];
                next[sIdx] = { ...next[sIdx], tools: [...firedTools] };
                return next;
              });
            } else if (event.t === "chunk" && event.text) {
              full += event.text;
              const snapped = full;
              setMessages(prev => {
                const next = [...prev];
                next[sIdx] = { ...next[sIdx], content: snapped };
                return next;
              });
              setToolActivity(null);
            } else if (event.t === "done") {
              setToolActivity(null);
              if (event.full) speakText(event.full);
              if (event.tools?.length) {
                setMessages(prev => {
                  const next = [...prev];
                  next[sIdx] = { ...next[sIdx], tools: event.tools };
                  return next;
                });
              }
            }
          } catch {}
        }
      }
    } catch {
      setMessages(prev => {
        const next = [...prev];
        next[sIdx] = { ...next[sIdx], content: "Connection error — try again." };
        return next;
      });
    }

    setLoading(false);
    setToolActivity(null);
    setStreamingIdx(null);
  }

  function clearHistory() {
    localStorage.removeItem("max-chat-messages");
    setBriefLoaded(false);
    setHistoryLoaded(false);
    setMessages([{ ...INITIAL, time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) }]);
    fetchBrief();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--bg)" }}>

      {/* Header */}
      <div style={{ padding: "20px 40px", borderBottom: "1px solid rgba(6,182,212,0.08)", background: "rgba(5,13,26,0.8)", flexShrink: 0, display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ position: "relative", width: 44, height: 44, flexShrink: 0 }}>
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", animation: "spin-slow 12s linear infinite" }} viewBox="0 0 44 44">
            <circle cx="22" cy="22" r="20" fill="none" stroke="rgba(6,182,212,0.15)" strokeWidth="1" strokeDasharray="4 3" />
          </svg>
          <div style={{ position: "absolute", inset: 6, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#0b2040,#071428)", border: "1px solid rgba(6,182,212,0.35)" }}>
            <span style={{ fontSize: 14, fontWeight: 900, color: "var(--teal)" }}>M</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--t1)" }}>M.A.X.</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--green)" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green)", display: "inline-block", animation: "pulse-dot 2s ease-in-out infinite" }} />
            Maximum Adaptive eXecutive · Online
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          {historyLoaded && <span style={{ fontSize: 10, color: "var(--t4)", padding: "3px 8px", borderRadius: 4, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>History loaded</span>}
          <button onClick={() => { setVoiceOut(v => !v); window.speechSynthesis?.cancel(); }}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600, background: voiceOut ? "rgba(6,182,212,0.12)" : "rgba(255,255,255,0.03)", border: `1px solid ${voiceOut ? "rgba(6,182,212,0.35)" : "rgba(255,255,255,0.06)"}`, color: voiceOut ? "var(--teal)" : "var(--t3)", transition: "all .2s" }}>
            {voiceOut
              ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>}
            {voiceOut ? "Voice On" : "Voice Off"}
          </button>
          <button onClick={clearHistory}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 600, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", color: "var(--t4)", transition: "all .2s" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            Clear
          </button>
          <span style={{ fontSize: 12, fontFamily: "monospace", color: "rgba(6,182,212,0.2)" }}>
            {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 40px", display: "flex", flexDirection: "column", gap: 16 }}>
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{ display: "flex", gap: 12, flexDirection: msg.role === "user" ? "row-reverse" : "row", animation: "afu 0.2s ease-out" }}
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            {msg.role === "max" && (
              <div style={{ width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 4, background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.2)" }}>
                <span style={{ fontSize: 12, fontWeight: 900, color: "var(--teal)" }}>M</span>
              </div>
            )}
            <div style={{ maxWidth: 520, display: "flex", flexDirection: "column", gap: 4, alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
              {/* Tool badges above message */}
              {msg.role === "max" && msg.tools && msg.tools.length > 0 && (
                <ToolBadges tools={msg.tools} />
              )}
              <div style={{
                padding: "12px 20px", borderRadius: 16, fontSize: 13, lineHeight: 1.65,
                ...(msg.role === "max"
                  ? { background: "linear-gradient(135deg,#07101e,#050d1a)", border: "1px solid rgba(6,182,212,0.1)", color: "var(--t1)", minHeight: 46 }
                  : { background: "linear-gradient(135deg,#0369a1,#0284c7)", color: "#fff", boxShadow: "0 2px 20px rgba(3,105,161,0.3)" }
                ),
              }}>
                {msg.role === "max" ? (
                  msg.content ? (
                    <>
                      <MarkdownText text={msg.content} />
                      {streamingIdx === i && (
                        <span style={{ display: "inline-block", width: 2, height: "1em", background: "var(--teal)", marginLeft: 2, verticalAlign: "text-bottom", animation: "pulse-dot 0.8s ease-in-out infinite", opacity: 0.7 }} />
                      )}
                    </>
                  ) : (
                    /* Empty streaming bubble — animated dots */
                    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 0" }}>
                      {toolActivity
                        ? <>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2" strokeLinecap="round" style={{ animation: "spin-slow 1.5s linear infinite", flexShrink: 0 }}>
                              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                            </svg>
                            <span style={{ fontSize: 12, color: "var(--teal)", opacity: 0.8 }}>{toolActivity}</span>
                          </>
                        : [0,1,2].map(j => <div key={j} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--teal)", opacity: 0.5, animation: `bounce 0.8s ease-in-out ${j*0.18}s infinite` }} />)
                      }
                    </div>
                  )
                ) : msg.content}
              </div>
              <span style={{ fontSize: 10, paddingLeft: 4, color: "rgba(6,182,212,0.2)" }}>{msg.time}</span>
              {/* Hover actions — M.A.X. messages only */}
              {msg.role === "max" && msg.content && hoveredIdx === i && streamingIdx !== i && (
                <MsgActions content={msg.content} />
              )}
            </div>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      <div style={{ padding: "0 40px 10px", flexShrink: 0, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {suggestions.map(s => (
          <button key={s} onClick={() => send(s)}
            style={{ background: "rgba(6,182,212,0.05)", border: "1px solid rgba(6,182,212,0.12)", color: "var(--t3)", fontSize: 11, fontWeight: 500, padding: "5px 13px", borderRadius: 20, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, transition: "all .15s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(6,182,212,0.09)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--t2)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(6,182,212,0.05)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--t3)"; }}>
            {s}
          </button>
        ))}
      </div>

      {/* Input */}
      <div style={{ padding: "12px 40px 24px", borderTop: "1px solid rgba(6,182,212,0.08)", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button onClick={toggleMic} title={isListening ? "Stop" : "Voice input"}
            style={{ width: 48, height: 48, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer", transition: "all .2s", background: isListening ? "rgba(6,182,212,0.15)" : "rgba(255,255,255,0.03)", border: `1px solid ${isListening ? "rgba(6,182,212,0.5)" : "rgba(6,182,212,0.12)"}`, color: isListening ? "var(--teal)" : "var(--t3)", animation: isListening ? "pulse-dot 1s ease-in-out infinite" : "none" }}>
            {isListening
              ? <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="2"/><rect x="14" y="4" width="4" height="16" rx="2"/></svg>
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
            }
          </button>

          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderRadius: 14, background: "linear-gradient(135deg,#07101e,#050d1a)", border: `1px solid ${isListening ? "rgba(6,182,212,0.3)" : "rgba(6,182,212,0.12)"}`, transition: "border-color .2s" }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
              placeholder={isListening ? "Listening…" : "Ask M.A.X. anything…"}
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: isListening ? "var(--teal)" : "var(--t1)" }}
            />
            <span style={{ fontSize: 11, fontFamily: "monospace", padding: "2px 6px", borderRadius: 4, background: "rgba(6,182,212,0.06)", color: "rgba(6,182,212,0.25)", border: "1px solid rgba(6,182,212,0.08)", flexShrink: 0 }}>↵</span>
          </div>

          <button onClick={() => send()} disabled={!input.trim() || loading}
            style={{ width: 48, height: 48, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer", transition: "all .2s", background: "linear-gradient(135deg,#0369a1,#0ea5e9)", boxShadow: "0 0 20px rgba(6,182,212,0.2)", opacity: (!input.trim() || loading) ? 0.3 : 1 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
        {isListening && <p style={{ fontSize: 11, textAlign: "center", marginTop: 8, color: "var(--teal)", opacity: 0.7 }}>Listening — speak now</p>}
      </div>
    </div>
  );
}
