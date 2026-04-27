"use client";

import { useEffect, useState } from "react";
import { MONO } from "./types";

interface Props {
  open:    boolean;
  onClose: () => void;
  onSent:  () => void;
  /** Prefilled values for reply / forward use cases */
  initial?: {
    to?:        string;
    subject?:   string;
    body?:      string;
    threadId?:  string;
    inReplyTo?: string;
  };
  /** Title shown in the header — "COMPOSE" by default */
  title?: string;
}

export function ComposeModal({ open, onClose, onSent, initial, title = "COMPOSE" }: Props) {
  const [to, setTo]             = useState(initial?.to ?? "");
  const [subject, setSubject]   = useState(initial?.subject ?? "");
  const [body, setBody]         = useState(initial?.body ?? "");
  const [cc, setCc]             = useState("");
  const [bcc, setBcc]           = useState("");
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [sending, setSending]   = useState(false);
  const [err, setErr]           = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTo(initial?.to ?? "");
      setSubject(initial?.subject ?? "");
      setBody(initial?.body ?? "");
      setCc(""); setBcc(""); setErr(null);
    }
  }, [open, initial]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open) onClose();
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && open) {
        e.preventDefault();
        void send();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, to, subject, body, cc, bcc]);

  if (!open) return null;

  async function send() {
    setErr(null);
    if (!to.trim() || !subject.trim() || !body.trim()) {
      setErr("To, subject, and body are required.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          to: to.trim(), subject: subject.trim(), body,
          threadId:  initial?.threadId,
          inReplyTo: initial?.inReplyTo,
          cc:        cc.trim()  || undefined,
          bcc:       bcc.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setErr(json.error ?? "Send failed.");
        return;
      }
      onSent();
      onClose();
    } finally {
      setSending(false);
    }
  }

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 240,
      background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "linear-gradient(160deg, #0f141d 0%, #080b11 100%)",
        border: "1px solid var(--blue-border)",
        borderRadius: 3, width: "min(680px, 95vw)", maxHeight: "90vh",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.32em", color: "var(--blue)", fontFamily: MONO }}>
            {title}
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setShowCcBcc(v => !v)} style={{
              background: "transparent", border: "1px solid var(--border)", color: "var(--t3)",
              padding: "4px 9px", borderRadius: 2,
              fontFamily: MONO, fontSize: 9, letterSpacing: "0.18em", fontWeight: 700, cursor: "pointer",
            }}>{showCcBcc ? "− CC/BCC" : "+ CC/BCC"}</button>
            <button onClick={onClose} style={{
              background: "transparent", border: "1px solid var(--border)", color: "var(--t3)",
              padding: "4px 9px", borderRadius: 2,
              fontFamily: MONO, fontSize: 11, cursor: "pointer",
            }}>×</button>
          </div>
        </div>

        {/* Fields */}
        <div style={{ padding: "12px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
          <Field label="TO">
            <input value={to} onChange={e => setTo(e.target.value)} placeholder="someone@example.com"
              style={inputStyle()} autoFocus={!initial?.to} />
          </Field>
          {showCcBcc && (
            <>
              <Field label="CC">
                <input value={cc} onChange={e => setCc(e.target.value)} placeholder="(optional)" style={inputStyle()} />
              </Field>
              <Field label="BCC">
                <input value={bcc} onChange={e => setBcc(e.target.value)} placeholder="(optional)" style={inputStyle()} />
              </Field>
            </>
          )}
          <Field label="SUBJECT">
            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject"
              style={inputStyle()} autoFocus={!!initial?.to && !initial.subject} />
          </Field>
        </div>

        {/* Body */}
        <textarea
          value={body} onChange={e => setBody(e.target.value)}
          placeholder="Write your email…"
          style={{
            flex: 1, minHeight: 240, resize: "none",
            background: "transparent", border: "none", borderTop: "1px solid var(--border)",
            padding: "14px 20px",
            color: "var(--t1)", fontFamily: "inherit", fontSize: 14,
            lineHeight: 1.65, outline: "none",
          }}
          autoFocus={!!initial?.to && !!initial.subject}
        />

        {err && (
          <p style={{ padding: "0 18px 8px", color: "var(--red)", fontFamily: MONO, fontSize: 11 }}>
            ⚠ {err}
          </p>
        )}

        {/* Footer */}
        <div style={{ padding: "10px 18px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ fontSize: 9, color: "var(--t4)", fontFamily: MONO, letterSpacing: "0.18em" }}>
            ⌘↵ TO SEND · ESC TO CLOSE
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onClose} style={{
              background: "transparent", border: "1px solid var(--border2)", color: "var(--t3)",
              padding: "8px 14px", borderRadius: 2,
              fontFamily: MONO, fontSize: 10, letterSpacing: "0.18em", fontWeight: 700, cursor: "pointer",
            }}>CANCEL</button>
            <button onClick={send} disabled={sending} style={{
              background: "var(--blue-dim)", border: "1px solid var(--blue-border)",
              color: "var(--blue)", padding: "8px 18px", borderRadius: 2,
              fontFamily: MONO, fontSize: 10, letterSpacing: "0.18em", fontWeight: 700,
              cursor: sending ? "default" : "pointer", opacity: sending ? 0.5 : 1,
            }}>{sending ? "SENDING…" : "▶ SEND NOW"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid var(--border)", paddingBottom: 6 }}>
      <span style={{ fontSize: 9, color: "var(--t3)", letterSpacing: "0.22em", fontFamily: MONO, fontWeight: 700, width: 56 }}>{label}</span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

function inputStyle(): React.CSSProperties {
  return {
    width: "100%",
    background: "transparent", border: "none",
    color: "var(--t1)", fontFamily: "inherit", fontSize: 13, outline: "none",
    padding: "4px 0",
  };
}
