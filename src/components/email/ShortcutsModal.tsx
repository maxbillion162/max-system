"use client";

import { useEffect } from "react";
import { MONO } from "./types";

const SHORTCUTS: { key: string; desc: string }[] = [
  { key: "J / ↓",    desc: "Next thread"               },
  { key: "K / ↑",    desc: "Previous thread"           },
  { key: "ENTER",    desc: "Open selected thread"      },
  { key: "R",        desc: "Reply (drafts in your voice)" },
  { key: "C / N",    desc: "Compose new email"         },
  { key: "E",        desc: "Archive thread"            },
  { key: "S",        desc: "Snooze thread"             },
  { key: "T",        desc: "Reclassify (train M.A.X.)" },
  { key: "*",        desc: "Star / unstar"             },
  { key: "/",        desc: "Focus search"              },
  { key: "?",        desc: "Toggle this panel"         },
  { key: "ESC",      desc: "Close drawer / modal"      },
];

interface Props { open: boolean; onClose: () => void; }

export function ShortcutsModal({ open, onClose }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape" && open) onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 260,
      background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "linear-gradient(160deg, #0f141d 0%, #080b11 100%)",
        border: "1px solid var(--blue-border)",
        borderRadius: 3, width: "min(440px, 92vw)",
        padding: "18px 22px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.32em", color: "var(--blue)", fontFamily: MONO }}>
            KEYBOARD SHORTCUTS
          </span>
          <button onClick={onClose} style={{
            background: "none", border: "1px solid var(--border)", borderRadius: 2,
            padding: "4px 10px", color: "var(--t3)", cursor: "pointer",
            fontFamily: MONO, fontSize: 11,
          }}>×</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {SHORTCUTS.map(s => (
            <div key={s.key} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "8px 0", borderBottom: "1px solid var(--border)",
            }}>
              <span style={{ fontSize: 12, color: "var(--t2)" }}>{s.desc}</span>
              <kbd style={{
                fontFamily: MONO, fontSize: 10, fontWeight: 700,
                background: "var(--surface2)", border: "1px solid var(--border2)",
                borderRadius: 2, padding: "3px 9px",
                color: "var(--blue)", letterSpacing: "0.1em",
              }}>{s.key}</kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
