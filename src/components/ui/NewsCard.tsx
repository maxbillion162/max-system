"use client";

import { useState } from "react";

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
  const [hovered, setHovered] = useState(false);
  const [rating, setRating] = useState<1 | -1 | null>(null);

  async function rate(r: 1 | -1) {
    if (rating !== null) return;
    setRating(r);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating:        r,
          artifact_type: "news_article",
          artifact_id:   link,
          surface:       "web",
          metadata:      { title, source },
        }),
      });
    } catch { /* silent */ }
  }

  return (
    <div
      style={{
        padding: "10px 11px",
        borderRadius: 5,
        background: hovered ? `rgba(${accentRgb},0.05)` : "rgba(255,255,255,0.02)",
        border: `1px solid ${hovered ? `rgba(${accentRgb},0.3)` : "var(--border)"}`,
        borderLeft: `2px solid ${hovered ? accentColor : `rgba(${accentRgb},0.4)`}`,
        transition: "all .15s",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        position: "relative",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
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

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 2 }}>
        <div style={{ fontSize: 10, color: "var(--t3)" }}>
          {source}{pubDate ? ` · ${timeAgo(pubDate)}` : ""}
        </div>

        {/* Feedback — fades in on hover, stays visible once rated */}
        <div style={{
          display: "flex", alignItems: "center", gap: 2,
          opacity: hovered || rating !== null ? 1 : 0,
          transition: "opacity 0.18s",
          pointerEvents: hovered || rating !== null ? "auto" : "none",
        }}>
          {rating === null ? (
            <>
              <button
                onClick={e => { e.preventDefault(); void rate(1); }}
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
                onClick={e => { e.preventDefault(); void rate(-1); }}
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
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
              color: rating === 1 ? "var(--green)" : "var(--red)",
            }}>
              {rating === 1 ? "✓ noted" : "✗ noted"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
