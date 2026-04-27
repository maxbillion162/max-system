"use client";

import { useEffect, useState } from "react";
import { FeedbackControl } from "@/components/ui/FeedbackControl";
import type { Briefing } from "./types";
import { MONO } from "./types";

interface Props {
  onSelectThread: (threadId: string) => void;
}

export function EmailBriefing({ onSelectThread }: Props) {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [collapsed, setCollapsed]   = useState(false);

  async function load(force = false) {
    if (force) setRefreshing(true); else setLoading(true);
    try {
      const url = force ? "/api/email/briefing" : "/api/email/briefing";
      const opts: RequestInit = force ? { method: "POST" } : {};
      const res = await fetch(url, opts);
      const json = await res.json();
      if (json.briefing) setBriefing(json.briefing);
      else setBriefing(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { void load(); }, []);

  return (
    <div style={{
      background: "linear-gradient(160deg, #0f141d 0%, #080b11 100%)",
      border: "1px solid rgba(125,184,232,0.10)", borderRadius: 3,
      flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{ padding: "12px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.32em", color: "var(--blue)", fontFamily: MONO, flexShrink: 0 }}>
            M.A.X. BRIEFING
          </span>
          {briefing && (
            <p style={{ fontSize: 13, color: "var(--t1)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {briefing.intro}
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <button onClick={() => load(true)} disabled={refreshing} style={btn(false)} title="Regenerate">
            {refreshing ? "…" : "↻"}
          </button>
          <button onClick={() => setCollapsed(v => !v)} style={btn(false)} title={collapsed ? "Expand" : "Collapse"}>
            {collapsed ? "▾" : "▴"}
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          {loading && (
            <p style={{ padding: "16px 18px", color: "var(--t4)", fontFamily: MONO, fontSize: 11 }}>reading inbox…</p>
          )}

          {!loading && !briefing && (
            <p style={{ padding: "16px 18px", color: "var(--t3)", fontSize: 12 }}>
              No briefing available yet. Hit ↻ to scan your inbox.
            </p>
          )}

          {!loading && briefing && briefing.items.length === 0 && (
            <p style={{ padding: "16px 18px", color: "var(--t3)", fontSize: 12 }}>{briefing.intro}</p>
          )}

          {!loading && briefing && briefing.items.length > 0 && (
            <>
              <div style={{ borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column" }}>
                {briefing.items.map(it => (
                  <button key={it.thread_id} onClick={() => onSelectThread(it.thread_id)} style={{
                    background: "transparent", border: "none", textAlign: "left",
                    padding: "10px 18px",
                    borderBottom: "1px solid var(--border)",
                    cursor: "pointer", display: "flex", gap: 12, alignItems: "flex-start",
                    transition: "background .12s",
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(125,184,232,0.04)"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, color: "var(--blue)", fontFamily: MONO,
                      letterSpacing: "0.06em", minWidth: 18,
                    }}>{it.rank}.</span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {it.subject}
                        </p>
                        <p style={{ fontSize: 11, color: "var(--t4)", fontFamily: MONO, flexShrink: 0 }}>
                          {it.sender}
                        </p>
                      </div>
                      <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 3, lineHeight: 1.5 }}>
                        ↳ {it.reason}
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              {briefing.reasoning && (
                <div style={{ padding: "10px 18px", borderTop: "1px solid var(--border)", background: "rgba(125,184,232,0.02)" }}>
                  <p style={{ fontSize: 9, color: "var(--blue)", letterSpacing: "0.18em", fontFamily: MONO, fontWeight: 700, marginBottom: 4 }}>
                    HOW M.A.X. RANKED THESE
                  </p>
                  <p style={{ fontSize: 12, color: "var(--t2)", fontStyle: "italic", lineHeight: 1.5 }}>
                    {briefing.reasoning}
                  </p>
                </div>
              )}

              <div style={{ padding: "8px 18px 10px", borderTop: "1px solid var(--border)" }}>
                <FeedbackControl
                  artifactType="email_briefing"
                  artifactId={`briefing:${new Date(briefing.generated_at).toISOString().slice(0,10)}`}
                  metadata={{ item_count: briefing.items.length, action_count: briefing.action_count }}
                  variant="inline"
                />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function btn(_active: boolean): React.CSSProperties {
  return {
    background: "transparent", border: "1px solid var(--border)",
    color: "var(--t3)", padding: "4px 8px", borderRadius: 2,
    fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", cursor: "pointer",
  };
}
