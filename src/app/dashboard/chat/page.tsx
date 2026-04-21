"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { HudCard } from "@/components/ui/HudCard";

type Msg = { role: "user" | "max"; content: string; time: string };

const SUGGESTIONS = [
  "What's my portfolio doing today?",
  "How am I tracking toward $100K?",
  "What should I focus on this week?",
  "Draft a reply to my most important email",
  "Give me a crypto market summary",
  "Search for the latest AI news",
];

interface ISpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: { [i: number]: { [i: number]: { transcript: string } } } }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}
declare global {
  interface Window {
    SpeechRecognition: new () => ISpeechRecognition;
    webkitSpeechRecognition: new () => ISpeechRecognition;
  }
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([{
    role: "max",
    content: "Online. What do you need, Max?",
    time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
  }]);
  const [input, setInput]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceOut, setVoiceOut]   = useState(false);
  const bottomRef  = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Clean up recognition on unmount
  useEffect(() => () => { recognitionRef.current?.abort(); }, []);

  function speakText(text: string) {
    if (!voiceOut || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.replace(/[*_`#]/g, ""));
    utterance.rate  = 1.05;
    utterance.pitch = 0.92;
    utterance.volume = 1;
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => v.name.includes("Google") && v.lang.startsWith("en"))
      ?? voices.find(v => v.lang.startsWith("en-US"));
    if (preferred) utterance.voice = preferred;
    window.speechSynthesis.speak(utterance);
  }

  const toggleMic = useCallback(() => {
    const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) { alert("Voice input not supported in this browser."); return; }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setInput(transcript);
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend   = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
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
          messages: updated.map(m => ({
            role: m.role === "max" ? "model" : "user",
            content: m.content,
          })),
        }),
      });

      const data = await res.json();
      const reply = data.reply ?? data.error ?? "Something went wrong.";

      setMessages(prev => [...prev, {
        role: "max",
        content: reply,
        time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      }]);

      speakText(reply);
    } catch {
      setMessages(prev => [...prev, {
        role: "max",
        content: "Connection error. Check your API key in .env.local.",
        time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      }]);
    }

    setLoading(false);
  }

  return (
    <div className="flex flex-col h-screen grid-bg" style={{ background: "var(--bg)" }}>

      {/* Header */}
      <div className="flex items-center gap-4"
        style={{ padding: "20px 40px", borderBottom: "1px solid rgba(6,182,212,0.08)", background: "rgba(5,13,26,0.8)" }}>
        <div className="relative w-11 h-11 flex-shrink-0">
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 44 44"
            style={{ animation: "spin-slow 12s linear infinite" }}>
            <circle cx="22" cy="22" r="20" fill="none" stroke="rgba(6,182,212,0.15)" strokeWidth="1" strokeDasharray="4 3" />
          </svg>
          <div className="absolute inset-1.5 rounded-lg flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,#0b2040,#071428)", border: "1px solid rgba(6,182,212,0.35)", boxShadow: "0 0 16px rgba(6,182,212,0.12)" }}>
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
          <button
            onClick={() => { setVoiceOut(v => !v); window.speechSynthesis?.cancel(); }}
            title={voiceOut ? "Voice output on — click to mute" : "Voice output off — click to enable"}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 12px", borderRadius: 8, cursor: "pointer",
              fontSize: 12, fontWeight: 600,
              background: voiceOut ? "rgba(6,182,212,0.12)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${voiceOut ? "rgba(6,182,212,0.35)" : "rgba(255,255,255,0.06)"}`,
              color: voiceOut ? "var(--teal)" : "var(--t3)",
              transition: "all .2s",
            }}
          >
            {voiceOut ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <line x1="23" y1="9" x2="17" y2="15"/>
                <line x1="17" y1="9" x2="23" y2="15"/>
              </svg>
            )}
            {voiceOut ? "Voice On" : "Voice Off"}
          </button>
          <span className="text-sm font-mono" style={{ color: "rgba(6,182,212,0.25)" }}>
            {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-5" style={{ padding: "28px 40px" }}>
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 afu ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            {msg.role === "max" && (
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-1"
                style={{ background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.2)", boxShadow: "0 0 12px rgba(6,182,212,0.08)" }}>
                <span className="text-xs font-black" style={{ color: "var(--teal)" }}>M</span>
              </div>
            )}
            <div className={`max-w-lg flex flex-col gap-1 ${msg.role === "user" ? "items-end" : "items-start"}`}>
              <div className="px-5 py-3.5 rounded-2xl text-base leading-relaxed"
                style={msg.role === "max"
                  ? { background: "linear-gradient(135deg,#07101e,#050d1a)", border: "1px solid rgba(6,182,212,0.1)", color: "var(--t1)" }
                  : { background: "linear-gradient(135deg,#0369a1,#0284c7)", color: "#fff", boxShadow: "0 2px 20px rgba(3,105,161,0.3)" }
                }>
                {msg.content.split("\n").map((line, li) => (
                  <span key={li}>{line}{li < msg.content.split("\n").length - 1 && <br />}</span>
                ))}
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
              {[0, 1, 2].map(i => (
                <div key={i} className="w-2 h-2 rounded-full"
                  style={{ background: "var(--teal)", opacity: 0.6, animation: `bounce 0.8s ease-in-out ${i * 0.18}s infinite` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      <div className="flex gap-2 flex-wrap" style={{ padding: "0 40px 12px" }}>
        {SUGGESTIONS.slice(0, 4).map(s => (
          <button key={s} onClick={() => send(s)}
            className="text-sm px-3.5 py-1.5 rounded-full transition-all hover:opacity-80"
            style={{ background: "rgba(6,182,212,0.05)", border: "1px solid rgba(6,182,212,0.12)", color: "var(--t3)" }}>
            {s}
          </button>
        ))}
      </div>

      {/* Input */}
      <div style={{ padding: "16px 40px 24px", borderTop: "1px solid rgba(6,182,212,0.08)" }}>
        <div className="flex gap-3 items-center">
          {/* Mic button */}
          <button
            onClick={toggleMic}
            title={isListening ? "Listening… click to stop" : "Voice input"}
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all hover:scale-105"
            style={{
              background: isListening ? "rgba(6,182,212,0.15)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${isListening ? "rgba(6,182,212,0.5)" : "rgba(6,182,212,0.12)"}`,
              boxShadow: isListening ? "0 0 20px rgba(6,182,212,0.25)" : "none",
              color: isListening ? "var(--teal)" : "var(--t3)",
              animation: isListening ? "pulse-dot 1s ease-in-out infinite" : "none",
            }}
          >
            {isListening ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="2"/><rect x="14" y="4" width="4" height="16" rx="2"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            )}
          </button>

          <div className="flex-1 flex items-center gap-3 px-5 py-3.5 rounded-xl"
            style={{ background: "linear-gradient(135deg,#07101e,#050d1a)", border: `1px solid ${isListening ? "rgba(6,182,212,0.3)" : "rgba(6,182,212,0.12)"}`, transition: "border-color .2s" }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
              placeholder={isListening ? "Listening…" : "Ask M.A.X. anything..."}
              className="flex-1 bg-transparent text-base outline-none"
              style={{ color: isListening ? "var(--teal)" : "var(--t1)" }}
            />
            <span className="text-xs font-mono px-1.5 py-0.5 rounded"
              style={{ background: "rgba(6,182,212,0.06)", color: "rgba(6,182,212,0.25)", border: "1px solid rgba(6,182,212,0.08)", flexShrink: 0 }}>
              ↵
            </span>
          </div>

          <button onClick={() => send()} disabled={!input.trim() || loading}
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all hover:scale-105 disabled:opacity-30"
            style={{ background: "linear-gradient(135deg,#0369a1,#0ea5e9)", boxShadow: "0 0 20px rgba(6,182,212,0.2)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        {isListening && (
          <p className="text-xs text-center mt-2" style={{ color: "var(--teal)", opacity: 0.7 }}>
            Listening — speak now, then click the mic or wait for result
          </p>
        )}
      </div>
    </div>
  );
}
