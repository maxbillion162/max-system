"use client";

import type { EmailClassification } from "./types";
import { CLASSIFICATION_META, MONO } from "./types";

export type FolderId = "all" | "starred" | "snoozed" | "archived" | EmailClassification;

interface Counts {
  all:        number;
  action:     number;
  waiting:    number;
  newsletter: number;
  fyi:        number;
  noise:      number;
  starred:    number;
  snoozed:    number;
  archived:   number;
}

interface Props {
  active:        FolderId;
  onChange:      (f: FolderId) => void;
  counts:        Counts;
  connected:     boolean;
  onRulesClick:  () => void;
  onComposeClick:() => void;
  onShortcuts:   () => void;
  onRefresh:     () => void;
  refreshing:    boolean;
}

export function FolderRail(props: Props) {
  const items: { id: FolderId; label: string; color?: string; count: number; group: "primary" | "secondary" }[] = [
    { id: "all",        label: "ALL MAIL",    count: props.counts.all,        group: "primary" },
    { id: "action",     label: "ACTION",      color: CLASSIFICATION_META.action.color,     count: props.counts.action,     group: "primary" },
    { id: "waiting",    label: "WAITING",     color: CLASSIFICATION_META.waiting.color,    count: props.counts.waiting,    group: "primary" },
    { id: "fyi",        label: "FYI",         color: CLASSIFICATION_META.fyi.color,        count: props.counts.fyi,        group: "primary" },
    { id: "newsletter", label: "NEWSLETTERS", color: CLASSIFICATION_META.newsletter.color, count: props.counts.newsletter, group: "primary" },
    { id: "noise",      label: "NOISE",       color: CLASSIFICATION_META.noise.color,      count: props.counts.noise,      group: "primary" },
    { id: "starred",    label: "STARRED",     color: "#B89A6E",   count: props.counts.starred,  group: "secondary" },
    { id: "snoozed",    label: "SNOOZED",     color: "var(--t3)", count: props.counts.snoozed,  group: "secondary" },
    { id: "archived",   label: "ARCHIVED",    color: "var(--t4)", count: props.counts.archived, group: "secondary" },
  ];
  const primary   = items.filter(i => i.group === "primary");
  const secondary = items.filter(i => i.group === "secondary");

  return (
    <div style={{
      width: 200, flexShrink: 0,
      borderRight: "1px solid var(--border)",
      display: "flex", flexDirection: "column",
      background: "linear-gradient(180deg,#070a12 0%,#04060c 100%)",
    }}>
      {/* Header */}
      <div style={{ padding: "16px 14px 12px", borderBottom: "1px solid var(--border)" }}>
        <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.32em", color: "var(--blue)", fontFamily: MONO, marginBottom: 4 }}>
          M.A.X. EMAIL
        </p>
        <p style={{ fontSize: 10, color: "var(--t4)", letterSpacing: "0.06em" }}>
          {props.connected ? "● gmail live" : "○ not connected"}
        </p>
      </div>

      {/* Compose */}
      <div style={{ padding: "12px 14px" }}>
        <button onClick={props.onComposeClick} style={{
          width: "100%", padding: "9px 14px", borderRadius: 2,
          background: "var(--blue-dim)", border: "1px solid var(--blue-border)",
          color: "var(--blue)",
          fontFamily: MONO, fontSize: 11, letterSpacing: "0.18em", fontWeight: 700,
          cursor: "pointer",
        }}>
          ✎ COMPOSE
        </button>
      </div>

      {/* Folders */}
      <nav style={{ flex: 1, padding: "0 8px 12px", overflowY: "auto" }}>
        <p style={folderHeader()}>SMART FOLDERS</p>
        {primary.map(f => (
          <FolderBtn key={f.id} f={f} active={props.active === f.id} onClick={() => props.onChange(f.id)} />
        ))}
        <p style={{ ...folderHeader(), marginTop: 18 }}>SAVED</p>
        {secondary.map(f => (
          <FolderBtn key={f.id} f={f} active={props.active === f.id} onClick={() => props.onChange(f.id)} />
        ))}
      </nav>

      {/* Footer actions */}
      <div style={{ padding: "10px 12px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 4 }}>
        <FooterBtn onClick={props.onRefresh} label={props.refreshing ? "REFRESHING…" : "↻ REFRESH"} disabled={props.refreshing} />
        <FooterBtn onClick={props.onRulesClick}     label="⚙ RULES" />
        <FooterBtn onClick={props.onShortcuts}      label="⌨ SHORTCUTS · ?" />
      </div>
    </div>
  );
}

function FolderBtn({ f, active, onClick }: {
  f: { id: string; label: string; color?: string; count: number };
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={{
      width: "100%", display: "flex", alignItems: "center", gap: 9,
      padding: "7px 10px", borderRadius: 2, marginBottom: 1,
      background: active ? "rgba(125,184,232,0.08)" : "transparent",
      borderLeft: `2px solid ${active ? "var(--blue)" : "transparent"}`,
      cursor: "pointer", textAlign: "left",
      transition: "background .1s",
    }}
    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)"; }}
    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
      {f.color && (
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: f.color, flexShrink: 0, opacity: active ? 1 : 0.7 }} />
      )}
      {!f.color && <span style={{ width: 6, flexShrink: 0 }} />}
      <span style={{ flex: 1, fontSize: 11, fontWeight: active ? 700 : 500, color: active ? "var(--t1)" : "var(--t3)", fontFamily: MONO, letterSpacing: "0.14em" }}>
        {f.label}
      </span>
      {f.count > 0 && (
        <span style={{ fontSize: 10, color: active ? "var(--blue)" : "var(--t4)", fontFamily: MONO }}>
          {f.count}
        </span>
      )}
    </button>
  );
}

function FooterBtn({ onClick, label, disabled }: { onClick: () => void; label: string; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: "100%", textAlign: "left",
      background: "transparent", border: "1px solid var(--border)",
      color: disabled ? "var(--t4)" : "var(--t3)",
      padding: "6px 10px", borderRadius: 2,
      fontFamily: MONO, fontSize: 9, letterSpacing: "0.18em", fontWeight: 700,
      cursor: disabled ? "default" : "pointer",
    }}>{label}</button>
  );
}

function folderHeader(): React.CSSProperties {
  return {
    fontSize: 8, fontWeight: 700, letterSpacing: "0.24em", color: "var(--t4)", fontFamily: MONO,
    padding: "0 10px 6px",
  };
}
