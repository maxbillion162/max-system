"use client";

import { useMemo } from "react";
import type { EmailIntel } from "./types";
import { CLASSIFICATION_META, MONO, relativeTime } from "./types";

interface Props {
  threads:        EmailIntel[];
  selectedId:     string | null;
  onSelect:       (threadId: string) => void;
  search:         string;
  onSearch:       (q: string) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  loading:        boolean;
  emptyHint?:     string;
}

export function EmailList({ threads, selectedId, onSelect, search, onSearch, searchInputRef, loading, emptyHint }: Props) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter(t =>
      (t.subject ?? "").toLowerCase().includes(q) ||
      (t.sender_name ?? "").toLowerCase().includes(q) ||
      (t.sender_email ?? "").toLowerCase().includes(q) ||
      (t.summary ?? "").toLowerCase().includes(q)
    );
  }, [threads, search]);

  return (
    <div style={{
      width: 360, flexShrink: 0,
      borderRight: "1px solid var(--border)",
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      {/* Search */}
      <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ position: "relative" }}>
          <span style={{
            position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
            color: "var(--t4)", fontSize: 12, fontFamily: MONO,
          }}>/</span>
          <input
            ref={searchInputRef}
            value={search}
            onChange={e => onSearch(e.target.value)}
            placeholder="Search subject, sender, summary…"
            style={{
              width: "100%",
              background: "var(--surface2)", border: "1px solid var(--border2)",
              borderRadius: 2, padding: "7px 10px 7px 26px",
              color: "var(--t1)", fontFamily: MONO, fontSize: 12, outline: "none",
            }}
            onFocus={e => e.target.style.borderColor = "var(--blue-border)"}
            onBlur={e => e.target.style.borderColor = "var(--border2)"}
          />
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {loading && (
          <p style={{ padding: "20px 14px", color: "var(--t4)", fontFamily: MONO, fontSize: 11 }}>
            loading threads…
          </p>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ padding: "24px 14px", textAlign: "center" }}>
            <p style={{ color: "var(--t3)", fontSize: 12, lineHeight: 1.5 }}>
              {search.trim() ? "No matches." : (emptyHint ?? "Inbox empty.")}
            </p>
          </div>
        )}

        {!loading && filtered.map(t => {
          const isSelected = selectedId === t.thread_id;
          const meta = t.classification ? CLASSIFICATION_META[t.classification] : null;
          return (
            <div
              key={t.thread_id}
              onClick={() => onSelect(t.thread_id)}
              style={{
                padding: "10px 14px",
                borderBottom: "1px solid var(--border)",
                background: isSelected ? "rgba(125,184,232,0.08)" : "transparent",
                borderLeft: `3px solid ${isSelected ? "var(--blue)" : "transparent"}`,
                cursor: "pointer",
                display: "flex", flexDirection: "column", gap: 4,
                transition: "background .1s",
              }}
              onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)"; }}
              onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              {/* Top row: sender + time */}
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                <p style={{
                  fontSize: 12,
                  fontWeight: t.unread ? 700 : 500,
                  color: t.unread ? "var(--t1)" : "var(--t2)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  flex: 1,
                }}>
                  {t.starred && <span style={{ color: "#B89A6E", marginRight: 4 }}>★</span>}
                  {t.sender_name || t.sender_email || "(unknown)"}
                </p>
                <span style={{ fontSize: 10, color: "var(--t4)", fontFamily: MONO, flexShrink: 0 }}>
                  {relativeTime(t.last_message_at)}
                </span>
              </div>

              {/* Subject */}
              <p style={{
                fontSize: 13,
                fontWeight: t.unread ? 600 : 400,
                color: t.unread ? "var(--t1)" : "var(--t3)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {t.subject || "(no subject)"}
              </p>

              {/* AI summary */}
              {t.summary && (
                <p style={{
                  fontSize: 11, color: "var(--t3)", lineHeight: 1.4,
                  display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}>
                  ↳ {t.summary}
                </p>
              )}

              {/* Bottom row: classification chip + importance + action flag */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2, flexWrap: "wrap" }}>
                {meta && (
                  <span style={{
                    fontSize: 8, fontWeight: 700, letterSpacing: "0.18em",
                    color: meta.color, background: meta.bg,
                    border: `1px solid ${meta.color}33`,
                    padding: "1px 6px", borderRadius: 2, fontFamily: MONO,
                  }}>
                    {meta.label}
                    {t.classification_source === "rule"   && " · R"}
                    {t.classification_source === "manual" && " · ✓"}
                  </span>
                )}
                {t.action_required && (
                  <span style={{
                    fontSize: 8, fontWeight: 700, letterSpacing: "0.18em",
                    color: "var(--red)", background: "rgba(200,90,90,0.1)",
                    border: "1px solid rgba(200,90,90,0.4)",
                    padding: "1px 6px", borderRadius: 2, fontFamily: MONO,
                  }}>
                    DO TODAY
                  </span>
                )}
                {t.snooze_until && new Date(t.snooze_until) > new Date() && (
                  <span style={{
                    fontSize: 8, fontWeight: 700, letterSpacing: "0.18em",
                    color: "var(--t3)", background: "rgba(255,255,255,0.04)",
                    border: "1px solid var(--border)",
                    padding: "1px 6px", borderRadius: 2, fontFamily: MONO,
                  }}>
                    💤 {relativeTime(t.snooze_until)}
                  </span>
                )}
                {t.importance_score >= 70 && (
                  <span style={{ fontSize: 9, color: "var(--blue)", fontFamily: MONO, marginLeft: "auto" }}>
                    ⚡{t.importance_score}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
