"use client";

import { useState, useRef, useEffect } from "react";

function timeAgo(dateStr: string) {
  if (!dateStr) return "";
  const m = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

interface NewsCardProps {
  title: string;
  snippet?: string;
  source: string;
  pubDate?: string;
  link: string;
  accentColor: string;
  accentRgb: string;
}

export function NewsCard({ title, snippet, source, pubDate, link, accentColor, accentRgb }: NewsCardProps) {
  const [hovered,   setHovered]   = useState(false);
  const [rating,    setRating]    = useState<1 | -1 | null>(null);
  const [note,      setNote]      = useState("");
  const [submitted, setSubmitted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (rating !== null && !submitted) inputRef.current?.focus();
  }, [rating, submitted]);

  async function submit(r: 1 | -1, text?: string) {
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating:        r,
          artifact_type: "news_article",
          artifact_id:   link,
          surface:       "web",
          note:          text?.trim() || null,
          metadata:      { title, source },
        }),
      });
    } catch { /* silent */ }
    setSubmitted(true);
  }

  function onRate(r: 1 | -1) {
    if (rating !== null) return;
    setRating(r);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") { e.preventDefault(); void submit(rating!, note); }
    if (e.key === "Escape") { void submit(rating!); }
  }

  const notePrompt = rating === 1 ? "What was good about this?" : "What didn't work for you?";
  const accentCol  = rating === 1 ? "var(--green)" : "var(--red)";
  const accentBorder = rating === 1 ? "rgba(95,176,125,0.35)" : "rgba(200,90,90,0.35)";

  return (
    <div
      style={{
        padding: "10px 11px",
        borderRadius: 5,
        background: hovered ? `rgba(${accentRgb},0.05)` : "rgba(255,255,255,0.02)",
        border: `1px solid ${hovered ? `rgba(${accentRgb},0.3)` : "var(--border)"}`,
        borderLeft: `2px solid ${hovered ? accentColor : `rgba(${accentRgb},0.4)`}`,
        transition: "background .15s, border-color .15s",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Article content */}
      <a href={link} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--t1)", lineHeight: 1.45 }}>{title}</div>
        {snippet && (
          <div style={{
            fontSize: 10, color: "var(--t2)", lineHeight: 1.4, marginTop: 3,
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>
            {snippet}
          </div>
        )}
      </a>

      {/* Meta row + rating buttons */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 2 }}>
        <div style={{ fontSize: 10, color: "var(--t3)" }}>
          {source}{pubDate ? ` · ${timeAgo(pubDate)}` : ""}
        </div>

        <div style={{
          display: "flex", alignItems: "center", gap: 2,
          opacity: rating !== null ? 1 : hovered ? 0.85 : 0.3,
          transition: "opacity 0.18s",
        }}>
          {submitted ? (
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", color: accentCol }}>
              {rating === 1 ? "✓ noted" : "✗ noted"}
            </span>
          ) : rating === null ? (
            <>
              <button
                onClick={e => { e.preventDefault(); onRate(1); }}
                title="Good pick for me"
                style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 3px", color: "var(--t3)", display: "flex", alignItems: "center", borderRadius: 3, transition: "color .12s" }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--green)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--t3)")}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H7V10l4.66-8.5A1.5 1.5 0 0 1 14 1.94l.88 3.94z"/>
                </svg>
              </button>
              <button
                onClick={e => { e.preventDefault(); onRate(-1); }}
                title="Not for me"
                style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 3px", color: "var(--t3)", display: "flex", alignItems: "center", borderRadius: 3, transition: "color .12s" }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--red)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--t3)")}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 14V2"/><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H17v12l-4.66 8.5a1.5 1.5 0 0 1-2.34.06l-.88-3.94z"/>
                </svg>
              </button>
            </>
          ) : (
            <span style={{ fontSize: 9, color: accentCol, fontWeight: 700 }}>
              {rating === 1 ? "👍" : "👎"}
            </span>
          )}
        </div>
      </div>

      {/* Note input — appears after rating, before submit */}
      {rating !== null && !submitted && (
        <div style={{
          marginTop: 4,
          borderTop: `1px solid ${accentBorder}`,
          paddingTop: 8,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}>
          <input
            ref={inputRef}
            value={note}
            onChange={e => setNote(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={notePrompt}
            style={{
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${accentBorder}`,
              borderRadius: 4,
              padding: "6px 9px",
              fontSize: 11,
              color: "var(--t1)",
              outline: "none",
              width: "100%",
              boxSizing: "border-box",
              fontFamily: "inherit",
            }}
            onFocus={e => (e.currentTarget.style.borderColor = accentCol)}
            onBlur={e => (e.currentTarget.style.borderColor = accentBorder)}
          />
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button
              onClick={() => void submit(rating, note)}
              style={{
                background: "rgba(255,255,255,0.05)", border: `1px solid ${accentBorder}`,
                borderRadius: 3, padding: "4px 10px", fontSize: 10, fontWeight: 700,
                color: accentCol, cursor: "pointer", letterSpacing: "0.06em", transition: "all .12s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `rgba(255,255,255,0.09)`; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `rgba(255,255,255,0.05)`; }}
            >
              Send
            </button>
            <button
              onClick={() => void submit(rating)}
              style={{ background: "none", border: "none", fontSize: 10, color: "var(--t3)", cursor: "pointer", padding: "4px 2px" }}
            >
              Skip
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
