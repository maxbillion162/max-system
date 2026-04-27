"use client";

import { useEffect, useState } from "react";
import { FeedbackControl } from "@/components/ui/FeedbackControl";
import type { ThreadMessage, EmailIntel } from "./types";
import { MONO, parseSenderField } from "./types";

interface Props {
  thread:  EmailIntel;
  message: ThreadMessage;       // the message being replied to (latest)
  onClose: () => void;
  onSent:  () => void;
}

export function ReplyDrawer({ thread, message, onClose, onSent }: Props) {
  const sender = parseSenderField(message.from);
  const subject = message.subject.toLowerCase().startsWith("re:")
    ? message.subject
    : `Re: ${message.subject}`;

  const [body, setBody]           = useState("");
  const [intent, setIntent]       = useState("");
  const [drafting, setDrafting]   = useState(false);
  const [draftId, setDraftId]     = useState<string | null>(null);
  const [voiceUsed, setVoiceUsed] = useState<boolean | null>(null);
  const [sending, setSending]     = useState(false);
  const [err, setErr]             = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); void send(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [body, intent]);

  async function generateDraft() {
    setDrafting(true);
    setErr(null);
    try {
      const res = await fetch("/api/email/reply-draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          thread_id:        thread.thread_id,
          original_subject: message.subject,
          original_from:    message.from,
          original_body:    message.body || message.snippet,
          intent:           intent.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (json.error) { setErr(json.error); return; }
      setBody(json.draft);
      setDraftId(json.draft_id);
      setVoiceUsed(!!json.voice_used);
    } finally {
      setDrafting(false);
    }
  }

  async function send() {
    if (!body.trim()) { setErr("Body is empty."); return; }
    setSending(true);
    setErr(null);
    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          to:        sender.email,
          subject,
          body,
          threadId:  thread.thread_id,
          inReplyTo: message.message_id || undefined,
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
    <div style={{
      position: "fixed", right: 0, top: 0, bottom: 0,
      width: "min(560px, 92vw)", zIndex: 230,
      background: "linear-gradient(160deg, #0f141d 0%, #080b11 100%)",
      borderLeft: "1px solid var(--blue-border)",
      display: "flex", flexDirection: "column",
      boxShadow: "-12px 0 40px rgba(0,0,0,0.5)",
    }}>
      {/* Header */}
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.32em", color: "var(--blue)", fontFamily: MONO }}>
            REPLY
          </span>
          <p style={{ fontSize: 13, color: "var(--t1)", marginTop: 4, fontWeight: 500 }}>
            To {sender.name}
          </p>
          <p style={{ fontSize: 11, color: "var(--t4)", fontFamily: MONO, letterSpacing: "0.06em" }}>
            &lt;{sender.email}&gt; · {subject}
          </p>
        </div>
        <button onClick={onClose} style={{
          background: "none", border: "1px solid var(--border)", borderRadius: 2,
          padding: "5px 10px", color: "var(--t3)", cursor: "pointer",
          fontFamily: MONO, fontSize: 11, letterSpacing: "0.16em",
        }}>× CLOSE</button>
      </div>

      {/* Intent + draft button */}
      <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 8 }}>
        <p style={{ fontSize: 9, color: "var(--blue)", letterSpacing: "0.18em", fontFamily: MONO, fontWeight: 700 }}>
          ASK M.A.X. TO DRAFT (OPTIONAL)
        </p>
        <div style={{ display: "flex", gap: 6 }}>
          <input
            value={intent}
            onChange={e => setIntent(e.target.value)}
            placeholder="e.g. 'agree to the call but push to Friday'"
            style={{
              flex: 1,
              background: "var(--surface2)", border: "1px solid var(--border2)",
              borderRadius: 2, padding: "7px 10px",
              color: "var(--t1)", fontFamily: MONO, fontSize: 12, outline: "none",
            }}
            onFocus={e => e.target.style.borderColor = "var(--blue-border)"}
            onBlur={e => e.target.style.borderColor = "var(--border2)"}
          />
          <button onClick={generateDraft} disabled={drafting} style={{
            background: "var(--blue-dim)", border: "1px solid var(--blue-border)",
            color: "var(--blue)", padding: "7px 14px", borderRadius: 2,
            fontFamily: MONO, fontSize: 10, letterSpacing: "0.18em", fontWeight: 700,
            cursor: drafting ? "default" : "pointer", opacity: drafting ? 0.5 : 1,
          }}>{drafting ? "DRAFTING…" : draftId ? "↻ REDRAFT" : "✎ DRAFT"}</button>
        </div>
        {voiceUsed === true && (
          <p style={{ fontSize: 10, color: "var(--green)", fontFamily: MONO, letterSpacing: "0.06em" }}>
            ✓ Voice profile applied
          </p>
        )}
        {voiceUsed === false && (
          <p style={{ fontSize: 10, color: "var(--t4)", fontFamily: MONO, letterSpacing: "0.06em" }}>
            ⚠ No voice profile yet — bootstrap it from Settings → Email or POST /api/email/writing-style
          </p>
        )}
      </div>

      {/* Body editor */}
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder={drafting ? "M.A.X. is drafting…" : "Write your reply, or hit DRAFT to have M.A.X. write one in your voice."}
        style={{
          flex: 1,
          background: "transparent", border: "none",
          padding: "16px 20px",
          color: "var(--t1)", fontFamily: "inherit", fontSize: 14,
          lineHeight: 1.65, outline: "none", resize: "none",
        }}
      />

      {/* Feedback on the draft */}
      {draftId && body && (
        <div style={{ padding: "10px 18px", borderTop: "1px solid var(--border)" }}>
          <FeedbackControl
            artifactType="email_draft"
            artifactId={draftId}
            metadata={{ thread_id: thread.thread_id, voice_used: voiceUsed, intent: intent.trim() || undefined }}
            label="DOES THIS SOUND LIKE YOU?"
          />
        </div>
      )}

      {err && (
        <p style={{ padding: "0 18px 8px", color: "var(--red)", fontFamily: MONO, fontSize: 11 }}>⚠ {err}</p>
      )}

      {/* Footer */}
      <div style={{ padding: "10px 18px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p style={{ fontSize: 9, color: "var(--t4)", fontFamily: MONO, letterSpacing: "0.18em" }}>
          ⌘↵ TO SEND
        </p>
        <button onClick={send} disabled={sending || !body.trim()} style={{
          background: body.trim() ? "var(--blue-dim)" : "transparent",
          border: `1px solid ${body.trim() ? "var(--blue-border)" : "var(--border)"}`,
          color: body.trim() ? "var(--blue)" : "var(--t4)",
          padding: "8px 18px", borderRadius: 2,
          fontFamily: MONO, fontSize: 10, letterSpacing: "0.18em", fontWeight: 700,
          cursor: sending || !body.trim() ? "default" : "pointer",
          opacity: sending ? 0.5 : 1,
        }}>{sending ? "SENDING…" : "▶ SEND NOW"}</button>
      </div>
    </div>
  );
}
