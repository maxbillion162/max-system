"use client";

import { useEffect, useState } from "react";
import { FeedbackControl } from "@/components/ui/FeedbackControl";
import type { EmailIntel, ThreadMessage } from "./types";
import { CLASSIFICATION_META, MONO, parseSenderField, relativeTime } from "./types";

interface Props {
  thread:           EmailIntel | null;
  onReply:          (latestMessage: ThreadMessage) => void;
  onForward:        (latestMessage: ThreadMessage) => void;
  onArchiveToggle:  () => void;
  onStarToggle:     () => void;
  onSnoozeRequest:  () => void;
  onReclassify:     () => void;
  /** Trigger when the parent should refresh classification on this thread (after Claude / rule update) */
  onRefreshIntel?:  () => void;
  /** Notify parent when latest message id is known so reply/forward can use it */
  onLatestMessage?: (msg: ThreadMessage) => void;
}

export function EmailDetail({
  thread, onReply, onForward,
  onArchiveToggle, onStarToggle, onSnoozeRequest, onReclassify,
  onLatestMessage,
}: Props) {
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    if (!thread) { setMessages([]); return; }
    let alive = true;
    setLoading(true);
    setMessages([]);
    (async () => {
      try {
        const res = await fetch(`/api/email/thread/${thread.thread_id}`);
        const json = await res.json();
        if (alive && Array.isArray(json.messages)) {
          setMessages(json.messages);
          if (json.messages.length > 0) {
            onLatestMessage?.(json.messages[json.messages.length - 1]);
          }
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [thread?.thread_id]);

  if (!thread) {
    return (
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        color: "var(--t4)", fontFamily: MONO, fontSize: 12, letterSpacing: "0.16em",
        background: "var(--bg)",
      }}>
        SELECT A THREAD
      </div>
    );
  }

  const meta = thread.classification ? CLASSIFICATION_META[thread.classification] : null;
  const latest = messages[messages.length - 1];

  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      background: "var(--bg)", overflow: "hidden",
    }}>
      {/* ── Header ── */}
      <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
              {meta && (
                <button onClick={onReclassify} title="Reclassify (T)" style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: "0.18em",
                  color: meta.color, background: meta.bg, border: `1px solid ${meta.color}55`,
                  padding: "2px 8px", borderRadius: 2, fontFamily: MONO, cursor: "pointer",
                }}>
                  {meta.label}
                  {thread.classification_source === "rule"   && " · RULE"}
                  {thread.classification_source === "manual" && " · MANUAL"}
                  {thread.classification_source === "ai" && thread.classification_confidence !== null
                    && ` · ${Math.round((thread.classification_confidence ?? 0) * 100)}%`}
                </button>
              )}
              {thread.action_required && (
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: "0.18em",
                  color: "var(--red)", background: "rgba(200,90,90,0.1)",
                  border: "1px solid rgba(200,90,90,0.4)",
                  padding: "2px 8px", borderRadius: 2, fontFamily: MONO,
                }}>DO TODAY</span>
              )}
              {thread.importance_score >= 70 && (
                <span style={{ fontSize: 10, color: "var(--blue)", fontFamily: MONO, letterSpacing: "0.06em" }}>
                  ⚡ IMPORTANCE {thread.importance_score}/100
                </span>
              )}
            </div>
            <p style={{ fontSize: 18, fontWeight: 600, color: "var(--t1)", lineHeight: 1.3 }}>
              {thread.subject || "(no subject)"}
            </p>
            <p style={{ fontSize: 12, color: "var(--t3)", marginTop: 4, fontFamily: MONO }}>
              {thread.sender_name} <span style={{ color: "var(--t4)" }}>&lt;{thread.sender_email}&gt;</span>
              <span style={{ color: "var(--t4)", marginLeft: 8 }}>· {relativeTime(thread.last_message_at)}</span>
              {messages.length > 1 && (
                <span style={{ color: "var(--blue)", marginLeft: 8 }}>· {messages.length} messages</span>
              )}
            </p>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <ActionBtn onClick={onStarToggle} title="Star (*)" active={thread.starred}>
              {thread.starred ? "★" : "☆"}
            </ActionBtn>
            <ActionBtn onClick={onSnoozeRequest} title="Snooze (S)">💤</ActionBtn>
            <ActionBtn onClick={onArchiveToggle} title="Archive (E)" active={thread.archived}>
              {thread.archived ? "↶" : "→"}
            </ActionBtn>
          </div>
        </div>
      </div>

      {/* ── AI Summary Card ── */}
      {thread.summary && (
        <div style={{
          margin: "14px 22px 0",
          padding: "12px 14px",
          background: meta ? meta.bg : "rgba(125,184,232,0.04)",
          border: `1px solid ${meta ? meta.color + "33" : "var(--border)"}`,
          borderLeft: `3px solid ${meta ? meta.color : "var(--blue)"}`,
          borderRadius: 3,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.24em", color: "var(--blue)", fontFamily: MONO }}>
              M.A.X. SUMMARY
            </span>
            <FeedbackControl
              artifactType="email_summary"
              artifactId={thread.thread_id}
              metadata={{ classification: thread.classification, source: thread.classification_source }}
              variant="inline"
            />
          </div>
          <p style={{ fontSize: 13, color: "var(--t1)", lineHeight: 1.5 }}>
            {thread.summary}
          </p>
          {thread.why_important && (
            <p style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.5, marginTop: 6, fontStyle: "italic" }}>
              <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 9, letterSpacing: "0.24em", color: "var(--blue)", fontStyle: "normal" }}>WHY: </span>
              {thread.why_important}
            </p>
          )}
          {thread.action_reason && (
            <p style={{ fontSize: 12, color: "var(--red)", lineHeight: 1.5, marginTop: 6 }}>
              <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 9, letterSpacing: "0.24em" }}>ACTION: </span>
              {thread.action_reason}
            </p>
          )}
        </div>
      )}

      {/* ── Body / messages ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 22px 0" }}>
        {loading && <p style={{ color: "var(--t4)", fontFamily: MONO, fontSize: 11 }}>loading thread…</p>}
        {!loading && messages.length === 0 && (
          <p style={{ color: "var(--t3)", fontSize: 12 }}>Could not load thread body.</p>
        )}
        {messages.map((m, i) => {
          const sender = parseSenderField(m.from);
          const isLast = i === messages.length - 1;
          return (
            <div key={m.id} style={{
              padding: "12px 0",
              borderBottom: isLast ? "none" : "1px solid var(--border)",
              marginBottom: isLast ? 14 : 0,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <p style={{ fontSize: 12, color: "var(--t2)", fontFamily: MONO }}>
                  <span style={{ color: "var(--t1)", fontWeight: 600 }}>{sender.name}</span>
                  <span style={{ color: "var(--t4)" }}> &lt;{sender.email}&gt;</span>
                </p>
                <p style={{ fontSize: 11, color: "var(--t4)", fontFamily: MONO }}>
                  {new Date(m.date).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </p>
              </div>
              <pre style={{
                fontSize: 13.5, color: "var(--t1)", lineHeight: 1.65,
                fontFamily: "inherit", whiteSpace: "pre-wrap", wordBreak: "break-word",
                margin: 0,
              }}>{m.body || m.snippet}</pre>
            </div>
          );
        })}
      </div>

      {/* ── Footer actions ── */}
      <div style={{ padding: "12px 22px", borderTop: "1px solid var(--border)", display: "flex", gap: 8 }}>
        <button onClick={() => latest && onReply(latest)} disabled={!latest} style={primaryBtn(!!latest)}>
          ↩ REPLY
        </button>
        <button onClick={() => latest && onForward(latest)} disabled={!latest} style={ghostBtn(!!latest)}>
          ↪ FORWARD
        </button>
      </div>
    </div>
  );
}

function ActionBtn({ children, onClick, title, active }: { children: React.ReactNode; onClick: () => void; title: string; active?: boolean }) {
  return (
    <button onClick={onClick} title={title} style={{
      background: active ? "var(--blue-dim)" : "transparent",
      border: `1px solid ${active ? "var(--blue-border)" : "var(--border)"}`,
      color: active ? "var(--blue)" : "var(--t2)",
      width: 34, height: 30, borderRadius: 2,
      cursor: "pointer", fontSize: 14,
      display: "inline-flex", alignItems: "center", justifyContent: "center",
    }}>{children}</button>
  );
}

function primaryBtn(enabled: boolean): React.CSSProperties {
  return {
    background: enabled ? "var(--blue-dim)" : "transparent",
    border: `1px solid ${enabled ? "var(--blue-border)" : "var(--border)"}`,
    color: enabled ? "var(--blue)" : "var(--t4)",
    padding: "8px 18px", borderRadius: 2,
    fontFamily: MONO, fontSize: 11, letterSpacing: "0.18em", fontWeight: 700,
    cursor: enabled ? "pointer" : "default",
  };
}

function ghostBtn(enabled: boolean): React.CSSProperties {
  return {
    background: "transparent", border: "1px solid var(--border)",
    color: enabled ? "var(--t2)" : "var(--t4)",
    padding: "8px 14px", borderRadius: 2,
    fontFamily: MONO, fontSize: 11, letterSpacing: "0.18em", fontWeight: 700,
    cursor: enabled ? "pointer" : "default",
  };
}

