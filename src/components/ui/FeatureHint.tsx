"use client";

import { useState } from "react";

interface FeatureHintProps {
  /** Optional section label rendered above the feature list. */
  title?:  string;
  /** Each string is one feature description shown as a bullet. */
  items:   string[];
  /** Which side the tooltip extends toward. Defaults to "right". */
  side?:   "left" | "right";
  /** Optional inline-style override for the icon wrapper (e.g. marginLeft). */
  style?:  React.CSSProperties;
}

/**
 * Tiny eye icon. On hover, reveals a tooltip listing the available features
 * for a page section. Purpose: discoverability — surface features that have
 * already shipped so Max can rediscover what M.A.X. can already do.
 */
export function FeatureHint({ title, items, side = "right", style }: FeatureHintProps) {
  const [open, setOpen] = useState(false);

  return (
    <span
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      style={{ position: "relative", display: "inline-flex", alignItems: "center", ...style }}
    >
      <span
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 18, height: 18, borderRadius: 4, cursor: "help",
          color: open ? "var(--blue)" : "rgba(125,184,232,0.45)",
          transition: "color .15s",
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </span>

      {open && (
        <div
          style={{
            position: "absolute", top: "calc(100% + 6px)", zIndex: 50,
            minWidth: 220, maxWidth: 320,
            padding: "10px 12px", borderRadius: 6,
            background: "linear-gradient(160deg, #10141c 0%, #0a0d12 100%)",
            border: "1px solid rgba(125,184,232,0.18)",
            boxShadow: "0 8px 28px rgba(0,0,0,0.6)",
            ...(side === "left" ? { right: 0 } : { left: 0 }),
          }}
        >
          {title && (
            <div style={{
              fontSize: 9, fontWeight: 700, letterSpacing: "0.12em",
              textTransform: "uppercase", color: "var(--blue)", opacity: 0.85,
              marginBottom: 8,
            }}>
              {title}
            </div>
          )}
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 5 }}>
            {items.map((it, i) => (
              <li key={i} style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.5, display: "flex", gap: 6 }}>
                <span style={{ color: "var(--blue)", opacity: 0.55, flexShrink: 0 }}>·</span>
                <span>{it}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </span>
  );
}
