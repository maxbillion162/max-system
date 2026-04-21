"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";

type Msg = { role: "user" | "max"; content: string; time: string };

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
  role: "max",
  content: "Online. What do you need, Max?",
  time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
};

const h = new Date().getHours();
const SUGGESTIONS =
  h < 10  ? ["Brief me for today", "What's on my calendar?", "How are my habits looking?", "Crypto update"] :
  h < 14  ? ["How am I tracking today?", "Any urgent emails?", "Search latest AI news", "Update my XRP holdings"] :
  h < 18  ? ["What should I focus on?", "Draft a reply to my top email", "Crypto check", "Add a task"] :
             ["Recap my day", "How'd I do on habits?", "What's BTC doing?", "Set a reminder for tomorrow"];

/* ── Markdown renderer ────────────────────────────────────────────── */
function MarkdownText({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Bullet list item
    if (/^[-•*]\s/.test(line)) {
      const bullets: string[] = [];
      while (i < lines.length && /^[-•*]\s/.test(lines[i])) {
        bullets.push(lines[i].replace(/^[-•*]\s/, ""));
        i++;
      }
      elements.push(
        <ul key={i} style={{ margin: "4px 0 4px 16px", padding: 0, listStyleType: "disc" }}>
          {bullets.map((b, bi) => <li key={bi} style={{ marginBottom: 2 }}>{renderInline(b)}</li>)}
        </ul>
      );
      continue;
    }

    // Numbered list
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ""));
        i++;
      }
      elements.push(
        <ol key={i} style={{ margin: "4px 0 4px 16px", padding: 0 }}>
          {items.map((b, bi) => <li key={bi} style={{ marginBottom: 2 }}>{renderInline(b)}</li>)}
        </ol>
      );
      continue;
    }

    // Header
    if (/^#{1,3}\s/.test(line)) {
      const text = line.replace(/^#{1,3}\s/, "");
      elements.push(<p key={i} style={{ fontWeight: 700, color: "var(--teal)", fontSize: 13, margin: "6px 0 2px" }}>{renderInline(text)}</p>);
      i++; continue;
    }

    // Empty line → spacer
    if (line.trim() === "") {
      elements.push(<br key={i} />);
      i++; continue;
    }

    elements.push(<p key={i} style={{ margin: "1px 0" }}>{renderInline(line)}</p>);
    i++;
  }

  return <>{elements}</>;
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2)
      return <em key={i}>{part.slice(1, -1)}</em>;
    if (part.startsWith("`") && part.endsWith("`"))
      return <code key={i} style={{ fontFamily: "monospace", background: "rgba(6,182,212,0.1)", padding: "1px 4px", borderRadius: 3, fontSize: "0.9em" }}>{part.slice(1, -1)}</code>;
    return part;
  });
}

/* ── Main page ────────────────────────────────────────────────────── */
export default function ChatPage() {
  const [messages,    setMessages]    = useState<Msg[]>([INITIAL]);
  const [input,       setInput]       = useState("");
  const [loading,     setLoading]     = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceOut,    setVoiceOut]    = useState(false);
  const bottomRef      = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const sessionId      = useMemo(() => crypto.randomUUID(), []);

  // Load from localStorage on mount + check for draft context from email
  useEffect(() => {
    try {
      const saved = localStorage.getItem("max-chat-messages");
      if (saved) {
        const parsed = JSON.parse(saved) as Msg[];
        if (parsed.length > 1) setMessages(parsed.slice(-60));
      }
    } catch {}
    try {
      const draft = localStorage.getItem("max-draft-context");
      if (draft) { setInput(draft); localStorage.removeItem("max-draft-context"); }
    } catch {}
  }, []);

  // Persist to localStorage on change
  useEffect(() => {
    if (messages.length > 1) {
      try { localStorage.setItem("max-chat-messages", JSON.stringify(messages.slice(-60))); } catch {}
    }
  }, [messages]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
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
    r.onerror = () => setIsListening(false);
    r.onend   = () => setIsListening(false);
    recognitionRef.current = r; r.start(); setIsListening(true);
  }, [isListening]);

  async function send(text?: string) {
    const content = text || input.trim();
    if (!content || loading) return;
    setInput("");
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); }

    const now = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    const updated: Msg[] = [...messages, { role: "user", content, time: now }];
    setMessages(updated);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          messages: updated.map(m => ({ role: m.role === "max" ? "model" : "user", content: m.content })),
        }),
      });
      const data  = await res.json();
      const reply = data.reply ?? data.error ?? "Something went wrong.";
      setMessages(prev => [...prev, { role: "max", content: reply, time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) }]);
      speakText(reply);
    } catch {
      setMessages(prev => [...prev, { role: "max", content: "Connection error.", time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) }]);
    }
    setLoading(false);
  }

  function clearHistory() {
    localStorage.removeItem("max-chat-messages");
    setMessages([{ ...INITIAL, time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) }]);
  }

  return (
    <div className="flex flex-col h-screen grid-bg" style={{ background: "var(--bg)" }}>

      {/* Header */}
      <div className="flex items-center gap-4"
        style={{ padding: "20px 40px", borderBottom: "1px solid rgba(6,182,212,0.08)", background: "rgba(5,13,26,0.8)", flexShrink: 0 }}>
        <div className="relative w-11 h-11 flex-shrink-0">
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 44 44" style={{ animation: "spin-slow 12s linear infinite" }}>
            <circle cx="22" cy="22" r="20" fill="none" stroke="rgba(6,182,212,0.15)" strokeWidth="1" strokeDasharray="4 3" />
          </svg>
          <div className="absolute inset-1.5 rounded-lg flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,#0b2040,#071428)", border: "1px solid rgba(6,182,212,0.35)" }}>
            <span className="text-sm font-black" style={{ color: "var(--teal)" }}>M</span>
          </div>
        </div>
        <div>
          <div className="text-lg font-bold" style={{ color: "var(--t1)" }}>M.A.X.</div>
          <div className="flex items-center gap-1.5 text-sm" style={{ color: "var(--green)" }}>
            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "var(--green)", animation: "pulse-dot 2s ease-in-out infinite" }} />
            Maximum Adaptive eXecutive · Online
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {/* Voice output toggle */}
          <button onClick={() => { setVoiceOut(v => !v); window.speechSynthesis?.cancel(); }} title={voiceOut ? "Voice on" : "Voice off"} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600,
            background: voiceOut ? "rgba(6,182,212,0.12)" : "rgba(255,255,255,0.03)",
            border: `1px solid ${voiceOut ? "rgba(6,182,212,0.35)" : "rgba(255,255,255,0.06)"}`,
            color: voiceOut ? "var(--teal)" : "var(--t3)", transition: "all .2s",
          }}>
            {voiceOut ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
              </svg>
            )}
            {voiceOut ? "Voice On" : "Voice Off"}
          </button>
          {/* Clear history */}
          <button onClick={clearHistory} title="Clear conversation" style={{
            display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 600,
            background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", color: "var(--t4)", transition: "all .2s",
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
            </svg>
            Clear
          </button>
          <span className="text-sm font-mono" style={{ color: "rgba(6,182,212,0.2)" }}>
            {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4" style={{ padding: "28px 40px" }}>
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 afu ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            {msg.role === "max" && (
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-1"
                style={{ background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.2)" }}>
                <span className="text-xs font-black" style={{ color: "var(--teal)" }}>M</span>
              </div>
            )}
            <div className={`max-w-lg flex flex-col gap-1 ${msg.role === "user" ? "items-end" : "items-start"}`}>
              <div className="px-5 py-3.5 rounded-2xl text-sm leading-relaxed"
                style={msg.role === "max"
                  ? { background: "linear-gradient(135deg,#07101e,#050d1a)", border: "1px solid rgba(6,182,212,0.1)", color: "var(--t1)" }
                  : { background: "linear-gradient(135deg,#0369a1,#0284c7)", color: "#fff", boxShadow: "0 2px 20px rgba(3,105,161,0.3)" }
                }>
                {msg.role === "max"
                  ? <MarkdownText text={msg.content} />
                  : msg.content}
              </div>
              <span className="text-xs px-1" style={{ color: "rgba(6,182,212,0.2)" }}>{msg.time}</span>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.2)" }}>
              <span className="text-xs font-black" style={{ color: "var(--teal)" }}>M</span>
            </div>
            <div className="px-5 py-4 rounded-2xl flex items-center gap-2"
              style={{ background: "linear-gradient(135deg,#07101e,#050d1a)", border: "1px solid rgba(6,182,212,0.1)" }}>
              {[0,1,2].map(i => (
                <div key={i} className="w-2 h-2 rounded-full"
                  style={{ background: "var(--teal)", opacity: 0.6, animation: `bounce 0.8s ease-in-out ${i*0.18}s infinite` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      <div className="flex gap-2 flex-wrap" style={{ padding: "0 40px 12px", flexShrink: 0 }}>
        {SUGGESTIONS.map(s => (
          <button key={s} onClick={() => send(s)}
            className="text-sm px-3.5 py-1.5 rounded-full transition-all hover:opacity-80"
            style={{ background: "rgba(6,182,212,0.05)", border: "1px solid rgba(6,182,212,0.12)", color: "var(--t3)" }}>
            {s}
          </button>
        ))}
      </div>

      {/* Input */}
      <div style={{ padding: "16px 40px 24px", borderTop: "1px solid rgba(6,182,212,0.08)", flexShrink: 0 }}>
        <div className="flex gap-3 items-center">
          <button onClick={toggleMic} title={isListening ? "Stop" : "Voice input"}
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all hover:scale-105"
            style={{
              background: isListening ? "rgba(6,182,212,0.15)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${isListening ? "rgba(6,182,212,0.5)" : "rgba(6,182,212,0.12)"}`,
              color: isListening ? "var(--teal)" : "var(--t3)",
              animation: isListening ? "pulse-dot 1s ease-in-out infinite" : "none",
            }}>
            {isListening ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="2"/><rect x="14" y="4" width="4" height="16" rx="2"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            )}
          </button>

          <div className="flex-1 flex items-center gap-3 px-5 py-3.5 rounded-xl"
            style={{ background: "linear-gradient(135deg,#07101e,#050d1a)", border: `1px solid ${isListening ? "rgba(6,182,212,0.3)" : "rgba(6,182,212,0.12)"}`, transition: "border-color .2s" }}>
            <input
              value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
              placeholder={isListening ? "Listening…" : "Ask M.A.X. anything..."}
              className="flex-1 bg-transparent text-base outline-none"
              style={{ color: isListening ? "var(--teal)" : "var(--t1)" }}
            />
            <span className="text-xs font-mono px-1.5 py-0.5 rounded"
              style={{ background: "rgba(6,182,212,0.06)", color: "rgba(6,182,212,0.25)", border: "1px solid rgba(6,182,212,0.08)", flexShrink: 0 }}>↵</span>
          </div>

          <button onClick={() => send()} disabled={!input.trim() || loading}
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all hover:scale-105 disabled:opacity-30"
            style={{ background: "linear-gradient(135deg,#0369a1,#0ea5e9)", boxShadow: "0 0 20px rgba(6,182,212,0.2)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
        {isListening && (
          <p className="text-xs text-center mt-2" style={{ color: "var(--teal)", opacity: 0.7 }}>
            Listening — speak now
          </p>
        )}
      </div>
    </div>
  );
}
