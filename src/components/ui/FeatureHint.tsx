"use client";

import { useState, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";

interface FeatureHintProps {
  /** Optional section label rendered above the feature list. */
  title?:  string;
  /** Each string is one feature description shown as a bullet. */
  items:   string[];
  /** Which side the tooltip extends toward from the icon. Defaults to "right". */
  side?:   "left" | "right";
  /** Optional inline-style override for the icon wrapper (e.g. marginLeft). */
  style?:  React.CSSProperties;
}

/**
 * Tiny eye icon. On hover, reveals a tooltip listing the available features
 * for a page section. Renders the tooltip via a portal at fixed position so
 * it floats above sibling cards regardless of parent overflow/stacking.
 */
export function FeatureHint({ title, items, side = "right", style }: FeatureHintProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos]   = useState<{ top: number; left?: number; right?: number } | null>(null);
  const iconRef         = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    if (!open || !iconRef.current) return;
    const r = iconRef.current.getBoundingClientRect();
    if (side === "left") {
      // Extend toward the left: anchor right edge to icon's right edge
      setPos({ top: r.bottom + 6, right: window.innerWidth - r.right });
    } else {
      setPos({ top: r.bottom + 6, left: r.left });
    }
  }, [open, side]);

  return (
    <span
      ref={iconRef}
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

      {open && pos && typeof window !== "undefined" && createPortal(
        <div
          style={{
            position: "fixed",
            top: pos.top,
            ...(pos.left  !== undefined ? { left:  pos.left  } : {}),
            ...(pos.right !== undefined ? { right: pos.right } : {}),
            zIndex: 9999,
            minWidth: 220, maxWidth: 320,
            padding: "10px 12px", borderRadius: 6,
            background: "linear-gradient(160deg, #10141c 0%, #0a0d12 100%)",
            border: "1px solid rgba(125,184,232,0.25)",
            boxShadow: "0 12px 40px rgba(0,0,0,0.75)",
            pointerEvents: "none",
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
        </div>,
        document.body
      )}
    </span>
  );
}
