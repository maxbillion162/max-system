"use client";

import { useState } from "react";
import { MONO } from "./types";

interface Props {
  open:    boolean;
  onClose: () => void;
  onPick:  (snoozeUntil: Date) => void;
  /** Anchor coords (where the trigger button is) — modal floats near it */
  anchor?: { x: number; y: number };
}

const PRESETS: { label: string; build: () => Date }[] = [
  { label: "LATER TODAY",     build: () => { const d = new Date(); d.setHours(d.getHours() + 4); return d; } },
  { label: "TOMORROW 9 AM",   build: () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d; } },
  { label: "THIS WEEKEND",    build: () => { const d = new Date(); const days = (6 - d.getDay() + 7) % 7 || 7; d.setDate(d.getDate() + days); d.setHours(9, 0, 0, 0); return d; } },
  { label: "NEXT MONDAY 9 AM",build: () => { const d = new Date(); const days = ((1 - d.getDay() + 7) % 7) || 7; d.setDate(d.getDate() + days); d.setHours(9, 0, 0, 0); return d; } },
  { label: "1 WEEK",          build: () => { const d = new Date(); d.setDate(d.getDate() + 7); return d; } },
  { label: "1 MONTH",         build: () => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d; } },
];

export function SnoozeMenu({ open, onClose, onPick }: Props) {
  const [customDate, setCustomDate] = useState("");
  const [customTime, setCustomTime] = useState("09:00");

  if (!open) return null;

  function pickCustom() {
    if (!customDate) return;
    const iso = `${customDate}T${customTime || "09:00"}:00`;
    onPick(new Date(iso));
  }

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 220,
      background: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "linear-gradient(160deg, #0f141d 0%, #080b11 100%)",
        border: "1px solid var(--blue-border)",
        borderRadius: 3, width: "min(380px, 92vw)",
        padding: "16px 18px",
        display: "flex", flexDirection: "column", gap: 12,
      }}>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.32em", color: "var(--blue)", fontFamily: MONO }}>
          SNOOZE UNTIL
        </span>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {PRESETS.map(p => (
            <button key={p.label} onClick={() => onPick(p.build())} style={{
              background: "transparent", border: "1px solid var(--border)",
              color: "var(--t2)", padding: "9px 10px", borderRadius: 2, textAlign: "left",
              fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", fontWeight: 700, cursor: "pointer",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--blue-border)"; (e.currentTarget as HTMLElement).style.color = "var(--blue)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.color = "var(--t2)"; }}>
              {p.label}
              <p style={{ fontSize: 9, color: "var(--t4)", marginTop: 3, fontWeight: 400, letterSpacing: 0 }}>
                {p.build().toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </p>
            </button>
          ))}
        </div>

        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
          <p style={{ fontSize: 9, color: "var(--t3)", letterSpacing: "0.18em", fontFamily: MONO, marginBottom: 6 }}>CUSTOM</p>
          <div style={{ display: "flex", gap: 6 }}>
            <input type="date" value={customDate} onChange={e => setCustomDate(e.target.value)} style={inputStyle()} />
            <input type="time" value={customTime} onChange={e => setCustomTime(e.target.value)} style={inputStyle()} />
            <button onClick={pickCustom} disabled={!customDate} style={{
              background: customDate ? "var(--blue-dim)" : "transparent",
              border: `1px solid ${customDate ? "var(--blue-border)" : "var(--border)"}`,
              color: customDate ? "var(--blue)" : "var(--t4)",
              padding: "6px 12px", borderRadius: 2,
              fontFamily: MONO, fontSize: 10, letterSpacing: "0.18em", fontWeight: 700,
              cursor: customDate ? "pointer" : "default",
            }}>SET</button>
          </div>
        </div>

        <button onClick={onClose} style={{
          background: "transparent", border: "1px solid var(--border2)", color: "var(--t3)",
          padding: "7px 0", borderRadius: 2, marginTop: 4,
          fontFamily: MONO, fontSize: 10, letterSpacing: "0.18em", fontWeight: 700, cursor: "pointer",
        }}>CANCEL</button>
      </div>
    </div>
  );
}

function inputStyle(): React.CSSProperties {
  return {
    flex: 1, background: "var(--surface2)", border: "1px solid var(--border2)",
    borderRadius: 2, padding: "6px 8px",
    color: "var(--t1)", fontFamily: MONO, fontSize: 12, outline: "none",
  };
}
