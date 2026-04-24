"use client";

/**
 * FeedbackControl — the reusable 👍/👎 hook that goes under any AI-generated
 * output. One POST to /api/feedback, stored in the feedback table, rolled
 * up daily into learned preferences.
 *
 * Usage:
 *   <FeedbackControl artifactType="email_summary" artifactId={emailId} />
 *
 * The control auto-collapses after submission; optional note expands inline
 * on thumbs-down so Max can say *why* it was off.
 */

import { useState } from "react";

interface FeedbackControlProps {
  artifactType: string;
  artifactId?:  string;
  surface?:     string;
  metadata?:    Record<string, unknown>;
  /** Compact single-line layout (for email rows, feed cards). Default: standard. */
  compact?:     boolean;
}

export function FeedbackControl({ artifactType, artifactId, surface, metadata, compact = false }: FeedbackControlProps) {
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
      /* non-fatal — UI stays as-is */
    } finally {
      setSubmitting(false);
    }
  }

  function onUp() {
    setRating(1);
    void send(1);
  }
  function onDown() {
    setRating(-1);
    setNoteOpen(true);
  }

  if (submitted && !noteOpen) {
    return (
      <span style={{
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 10, letterSpacing: "0.14em", color: "var(--t3)",
      }}>
        {rating === 1 ? "✓ Thanks" : "✓ Noted"}
      </span>
    );
  }

  const gap = compact ? 6 : 8;
  const iconSize = compact ? 12 : 14;

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap, flexWrap: "wrap" }}>
      <button
        type="button"
        onClick={onUp}
        disabled={submitting || rating !== null}
        title="Helpful"
        style={{
          background: rating === 1 ? "rgba(95,176,125,0.12)" : "transparent",
          border: `1px solid ${rating === 1 ? "rgba(95,176,125,0.4)" : "var(--border)"}`,
          borderRadius: 2, padding: compact ? "3px 6px" : "5px 8px",
          cursor: rating === null ? "pointer" : "default",
          color: rating === 1 ? "var(--green)" : "var(--t3)",
          display: "inline-flex", alignItems: "center",
          transition: "color .15s, border-color .15s",
        }}
      >
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 10v12" /><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H7V10l4.66-8.5A1.5 1.5 0 0 1 14 1.94l.88 3.94z" />
        </svg>
      </button>
      <button
        type="button"
        onClick={onDown}
        disabled={submitting || rating !== null}
        title="Off the mark"
        style={{
          background: rating === -1 ? "rgba(200,90,90,0.1)" : "transparent",
          border: `1px solid ${rating === -1 ? "rgba(200,90,90,0.4)" : "var(--border)"}`,
          borderRadius: 2, padding: compact ? "3px 6px" : "5px 8px",
          cursor: rating === null ? "pointer" : "default",
          color: rating === -1 ? "var(--red)" : "var(--t3)",
          display: "inline-flex", alignItems: "center",
          transition: "color .15s, border-color .15s",
        }}
      >
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 14V2" /><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H17v12l-4.66 8.5a1.5 1.5 0 0 1-2.34.06l-.88-3.94z" />
        </svg>
      </button>

      {rating === -1 && noteOpen && !submitted && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <input
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="what was off?"
            autoFocus
            onKeyDown={e => {
              if (e.key === "Enter") { void send(-1, note.trim() || undefined); setNoteOpen(false); }
              if (e.key === "Escape") { void send(-1); setNoteOpen(false); }
            }}
            style={{
              background: "var(--surface2)",
              border: "1px solid var(--border2)",
              borderRadius: 2,
              padding: "4px 8px",
              fontSize: 11,
              color: "var(--t1)",
              outline: "none",
              minWidth: 140,
            }}
          />
          <button
            type="button"
            onClick={() => { void send(-1, note.trim() || undefined); setNoteOpen(false); }}
            disabled={submitting}
            style={{
              background: "transparent",
              border: "1px solid var(--border2)",
              borderRadius: 2,
              padding: "4px 10px",
              fontSize: 10,
              letterSpacing: "0.1em",
              color: "var(--t2)",
              cursor: "pointer",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            }}
          >
            SEND
          </button>
          <button
            type="button"
            onClick={() => { void send(-1); setNoteOpen(false); }}
            disabled={submitting}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--t4)",
              fontSize: 10,
              cursor: "pointer",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            }}
          >
            skip
          </button>
        </span>
      )}
    </span>
  );
}
