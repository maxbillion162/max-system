"use client";

/**
 * FeedbackControl — universal 👍/👎 hook attachable to any AI-generated
 * output. Posts to /api/feedback. Daily rollup cron turns these into
 * learned preferences that get injected into the agent's system context.
 *
 * Two layouts:
 *   variant="rail"   — full horizontal bar with label. Default. Use under
 *                      any standalone AI artifact (brief, draft, top3).
 *   variant="inline" — bare two-button cluster, no label. Use inside
 *                      hover toolbars (chat actions, list rows).
 */

import { useState } from "react";

interface FeedbackControlProps {
  artifactType: string;
  artifactId?:  string;
  surface?:     string;
  metadata?:    Record<string, unknown>;
  variant?:     "rail" | "inline";
  /** Override label text on the rail variant. Default: "WAS THIS USEFUL?" */
  label?:       string;
}

export function FeedbackControl({
  artifactType, artifactId, surface, metadata,
  variant = "rail", label = "WAS THIS USEFUL?",
}: FeedbackControlProps) {
  const [rating, setRating] = useState<1 | -1 | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function send(r: 1 | -1, withNote?: string) {
    setSubmitting(true);
    try {
      await fetch("/api/feedback", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          rating:        r,
          artifact_type: artifactType,
          artifact_id:   artifactId,
          surface:       surface ?? "web",
          note:          withNote ?? null,
          metadata,
        }),
      });
      setSubmitted(true);
    } catch {
      /* non-fatal — silent */
    } finally {
      setSubmitting(false);
    }
  }

  function onUp() {
    if (rating !== null) return;
    setRating(1);
    void send(1);
  }
  function onDown() {
    if (rating !== null) return;
    setRating(-1);
    setNoteOpen(true);
  }

  /* ── Submitted state ────────────────────────────────────────── */
  if (submitted && !noteOpen) {
    const txt = rating === 1 ? "M.A.X. WILL DO MORE OF THIS" : "M.A.X. LEARNING FROM THIS";
    return (
      <div style={{
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 9, letterSpacing: "0.18em",
        color: rating === 1 ? "var(--green)" : "var(--blue)",
        opacity: 0.7,
        display: "flex", alignItems: "center", gap: 6,
        paddingTop: variant === "rail" ? 8 : 0,
      }}>
        <span style={{ display: "inline-block", width: 4, height: 4, borderRadius: "50%", background: "currentColor" }} />
        {txt}
      </div>
    );
  }

  /* ── Button styles ──────────────────────────────────────────── */
  const btnBase: React.CSSProperties = {
    background: "transparent",
    border: "1px solid var(--border)",
    borderRadius: 3,
    padding: "5px 9px",
    cursor: rating === null ? "pointer" : "default",
    color: "var(--t3)",
    display: "inline-flex", alignItems: "center", gap: 6,
    transition: "color .15s, border-color .15s, background .15s",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 10, letterSpacing: "0.1em", lineHeight: 1,
  };

  const upStyle: React.CSSProperties = {
    ...btnBase,
    color: rating === 1 ? "var(--green)" : "var(--t3)",
    borderColor: rating === 1 ? "rgba(95,176,125,0.4)" : "var(--border)",
    background: rating === 1 ? "rgba(95,176,125,0.08)" : "transparent",
  };
  const downStyle: React.CSSProperties = {
    ...btnBase,
    color: rating === -1 ? "var(--red)" : "var(--t3)",
    borderColor: rating === -1 ? "rgba(200,90,90,0.4)" : "var(--border)",
    background: rating === -1 ? "rgba(200,90,90,0.08)" : "transparent",
  };

  const upBtn = (
    <button
      type="button"
      onClick={onUp}
      disabled={submitting || rating !== null}
      title="Helpful — M.A.X. should do more of this"
      style={upStyle}
      onMouseEnter={e => { if (rating === null) (e.currentTarget as HTMLButtonElement).style.color = "var(--green)"; }}
      onMouseLeave={e => { if (rating === null) (e.currentTarget as HTMLButtonElement).style.color = "var(--t3)"; }}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 10v12" />
        <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H7V10l4.66-8.5A1.5 1.5 0 0 1 14 1.94l.88 3.94z" />
      </svg>
      {variant === "rail" && <span>GOOD</span>}
    </button>
  );

  const downBtn = (
    <button
      type="button"
      onClick={onDown}
      disabled={submitting || rating !== null}
      title="Off the mark — tell M.A.X. why"
      style={downStyle}
      onMouseEnter={e => { if (rating === null) (e.currentTarget as HTMLButtonElement).style.color = "var(--red)"; }}
      onMouseLeave={e => { if (rating === null) (e.currentTarget as HTMLButtonElement).style.color = "var(--t3)"; }}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 14V2" />
        <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H17v12l-4.66 8.5a1.5 1.5 0 0 1-2.34.06l-.88-3.94z" />
      </svg>
      {variant === "rail" && <span>OFF</span>}
    </button>
  );

  /* ── Note pad (slides down on thumbs-down) ──────────────────── */
  const notePad = rating === -1 && noteOpen && !submitted && (
    <div style={{
      marginTop: 10,
      paddingLeft: 10,
      borderLeft: "2px solid rgba(200,90,90,0.35)",
      display: "flex", flexDirection: "column", gap: 8,
      animation: "afu 0.18s ease-out",
    }}>
      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="What was off? (Enter to submit, Esc to skip)"
        autoFocus
        rows={2}
        onKeyDown={e => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void send(-1, note.trim() || undefined);
            setNoteOpen(false);
          }
          if (e.key === "Escape") {
            void send(-1);
            setNoteOpen(false);
          }
        }}
        style={{
          background: "var(--surface2)",
          border: "1px solid var(--border2)",
          borderRadius: 3,
          padding: "8px 10px",
          fontSize: 12,
          color: "var(--t1)",
          outline: "none",
          resize: "vertical",
          fontFamily: "inherit",
          lineHeight: 1.5,
          minHeight: 40,
        }}
      />
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button
          type="button"
          onClick={() => { void send(-1, note.trim() || undefined); setNoteOpen(false); }}
          disabled={submitting}
          style={{
            background: "var(--blue-dim)",
            border: "1px solid var(--blue-border)",
            borderRadius: 3,
            padding: "5px 12px",
            fontSize: 10,
            letterSpacing: "0.14em",
            color: "var(--blue)",
            cursor: "pointer",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          }}
        >
          SUBMIT
        </button>
        <button
          type="button"
          onClick={() => { void send(-1); setNoteOpen(false); }}
          disabled={submitting}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--t3)",
            fontSize: 10,
            letterSpacing: "0.14em",
            cursor: "pointer",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          }}
        >
          SKIP
        </button>
      </div>
    </div>
  );

  /* ── Inline (no label, tight) — for hover toolbars ──────────── */
  if (variant === "inline") {
    return (
      <span style={{ display: "inline-flex", flexDirection: "column", gap: 0 }}>
        <span style={{ display: "inline-flex", gap: 4 }}>
          {upBtn}
          {downBtn}
        </span>
        {notePad}
      </span>
    );
  }

  /* ── Rail (default) — labeled bar under standalone artifacts ─ */
  return (
    <div style={{
      borderTop: "1px solid var(--border)",
      paddingTop: 10,
      marginTop: 10,
      display: "flex", flexDirection: "column", gap: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: 9, letterSpacing: "0.2em", color: "var(--t3)",
        }}>
          {label}
        </span>
        <span style={{ display: "inline-flex", gap: 6 }}>
          {upBtn}
          {downBtn}
        </span>
      </div>
      {notePad}
    </div>
  );
}
