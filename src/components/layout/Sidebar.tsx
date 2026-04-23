"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const NAV_DEFAULT = [
  { label: "Command Center", href: "/dashboard",          icon: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" },
  { label: "M.A.X. Chat",    href: "/dashboard/chat",     icon: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" },
  { label: "Goals HQ",       href: "/dashboard/goals",    icon: "M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10zm0-6a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" },
  { label: "Finance Hub",    href: "/dashboard/finance",  icon: "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" },
  { label: "Habits",         href: "/dashboard/habits",   icon: "M22 12h-4l-3 9L9 3l-3 9H2" },
  { label: "Schedule",       href: "/dashboard/calendar", icon: "M3 4h18c.6 0 1 .4 1 1v16c0 .6-.4 1-1 1H3c-.6 0-1-.4-1-1V5c0-.6.4-1 1-1zM16 2v4M8 2v4M2 10h20" },
  { label: "Email",          href: "/dashboard/email",    icon: "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6" },
  { label: "Intel Feed",     href: "/dashboard/feed",     icon: "M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16M5 19a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" },
  { label: "Archive",        href: "/dashboard/archive",  icon: "M21 8v13H3V8M1 3h22v5H1zM10 12h4" },
];

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const [nav, setNav]           = useState(NAV_DEFAULT);
  const [dragIdx, setDragIdx]   = useState<number | null>(null);
  const [dropIdx, setDropIdx]   = useState<number | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("nav-order");
      if (saved) {
        const order = JSON.parse(saved) as string[];
        const sorted = order
          .map(href => NAV_DEFAULT.find(n => n.href === href))
          .filter(Boolean) as typeof NAV_DEFAULT;
        const missing = NAV_DEFAULT.filter(n => !order.includes(n.href));
        setNav([...sorted, ...missing]);
      }
    } catch {}
  }, []);

  function handleDragStart(i: number) { setDragIdx(i); }
  function handleDragOver(e: React.DragEvent, i: number) { e.preventDefault(); setDropIdx(i); }
  function handleDrop(e: React.DragEvent, i: number) {
    e.preventDefault();
    if (dragIdx === null || dragIdx === i) { setDragIdx(null); setDropIdx(null); return; }
    const next = [...nav];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(i, 0, moved);
    setNav(next);
    try { localStorage.setItem("nav-order", JSON.stringify(next.map(n => n.href))); } catch {}
    setDragIdx(null); setDropIdx(null);
  }
  function handleDragEnd() { setDragIdx(null); setDropIdx(null); }

  return (
    <aside
      className="fixed left-0 top-0 h-full z-40 flex flex-col"
      style={{
        width: collapsed ? 56 : 220,
        background: "linear-gradient(180deg, #080b15 0%, #060810 100%)",
        borderRight: "1px solid rgba(77,144,255,0.1)",
        transition: "width 0.25s ease",
        overflow: "hidden",
      }}
    >
      {/* ── Header ── */}
      <div
        className="flex items-center flex-shrink-0"
        style={{
          borderBottom: "1px solid rgba(77,144,255,0.08)",
          height: 60,
          padding: collapsed ? "0 12px" : "0 14px",
          justifyContent: collapsed ? "center" : "space-between",
          transition: "padding 0.25s ease",
        }}
      >
        <div className="flex items-center flex-shrink-0" style={{ gap: collapsed ? 0 : 10 }}>
          <div
            className="flex-shrink-0 rounded-lg flex items-center justify-center"
            style={{
              width: 32, height: 32,
              background: "linear-gradient(135deg, rgba(77,144,255,0.15), rgba(77,144,255,0.05))",
              border: "1px solid rgba(77,144,255,0.35)",
              boxShadow: "0 0 16px rgba(77,144,255,0.1)",
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 900, color: "var(--blue)", letterSpacing: "-0.02em" }}>M</span>
          </div>

          {!collapsed && (
            <div style={{ overflow: "hidden", whiteSpace: "nowrap" }}>
              <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.12em", color: "var(--t1)" }}>M.A.X.</div>
              <div className="flex items-center gap-1.5">
                <span style={{
                  width: 5, height: 5, borderRadius: "50%",
                  background: "var(--green)",
                  boxShadow: "0 0 5px var(--green)",
                  display: "inline-block",
                  animation: "pulse-dot 2.5s ease-in-out infinite",
                }} />
                <span style={{ color: "var(--green)", fontSize: 9, fontWeight: 600, letterSpacing: "0.1em" }}>ONLINE</span>
              </div>
            </div>
          )}
        </div>

        {!collapsed && (
          <button
            onClick={onToggle}
            style={{
              width: 26, height: 26, flexShrink: 0, cursor: "pointer",
              background: "rgba(77,144,255,0.06)",
              border: "1px solid rgba(77,144,255,0.12)",
              borderRadius: 6, color: "var(--t3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.15s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(77,144,255,0.25)"; (e.currentTarget as HTMLElement).style.color = "var(--t2)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(77,144,255,0.12)"; (e.currentTarget as HTMLElement).style.color = "var(--t3)"; }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}

        {collapsed && (
          <button onClick={onToggle} style={{ position: "absolute", inset: 0, width: "100%", height: 60, opacity: 0, cursor: "pointer" }} />
        )}
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden" style={{ padding: collapsed ? "10px 6px" : "10px 8px" }}>
        {!collapsed && (
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(77,144,255,0.3)", padding: "4px 8px 8px", whiteSpace: "nowrap" }}>
            Navigation
          </div>
        )}
        <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 1 }}>
          {nav.map((item, idx) => {
            const active       = pathname === item.href;
            const isDragging   = dragIdx === idx;
            const isDropTarget = dropIdx === idx && dragIdx !== null && dragIdx !== idx;
            return (
              <li
                key={item.href}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={e => handleDragOver(e, idx)}
                onDrop={e => handleDrop(e, idx)}
                onDragEnd={handleDragEnd}
                style={{
                  opacity: isDragging ? 0.3 : 1,
                  transition: "opacity .15s",
                  borderTop: isDropTarget ? "1px solid rgba(77,144,255,0.45)" : "1px solid transparent",
                }}
              >
                <Link
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: collapsed ? 0 : 9,
                    padding: collapsed ? "10px 0" : "8px 10px",
                    justifyContent: collapsed ? "center" : "flex-start",
                    borderRadius: 7,
                    color: active ? "var(--t1)" : "var(--t3)",
                    background: active ? "rgba(77,144,255,0.1)" : "transparent",
                    borderLeft: active && !collapsed ? "2px solid var(--blue)" : "2px solid transparent",
                    textDecoration: "none",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = "rgba(77,144,255,0.05)"; (e.currentTarget as HTMLElement).style.color = "var(--t2)"; } }}
                  onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--t3)"; } }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                    stroke={active ? "var(--blue)" : "var(--t3)"}
                    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                    style={{ flexShrink: 0, transition: "stroke 0.15s" }}>
                    <path d={item.icon} />
                  </svg>
                  {!collapsed && (
                    <span style={{ fontSize: 13, fontWeight: active ? 600 : 400, whiteSpace: "nowrap", flex: 1, letterSpacing: "0.01em" }}>{item.label}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ── Settings ── */}
      <div style={{ padding: collapsed ? "8px 6px" : "8px 8px", borderTop: "1px solid rgba(77,144,255,0.07)", flexShrink: 0 }}>
        <Link
          href="/dashboard/settings"
          title={collapsed ? "Settings" : undefined}
          style={{
            display: "flex", alignItems: "center", gap: collapsed ? 0 : 9,
            padding: collapsed ? "10px 0" : "8px 10px",
            justifyContent: collapsed ? "center" : "flex-start",
            borderRadius: 7, textDecoration: "none",
            color: pathname === "/dashboard/settings" ? "var(--t2)" : "var(--t3)",
            background: pathname === "/dashboard/settings" ? "rgba(77,144,255,0.07)" : "transparent",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--t2)"; (e.currentTarget as HTMLElement).style.background = "rgba(77,144,255,0.05)"; }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.color = pathname === "/dashboard/settings" ? "var(--t2)" : "var(--t3)";
            (e.currentTarget as HTMLElement).style.background = pathname === "/dashboard/settings" ? "rgba(77,144,255,0.07)" : "transparent";
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          {!collapsed && <span style={{ fontSize: 13, fontWeight: 400, whiteSpace: "nowrap" }}>Settings</span>}
        </Link>
      </div>

      {/* ── User ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: collapsed ? "12px 0" : "12px 14px",
        justifyContent: collapsed ? "center" : "flex-start",
        borderTop: "1px solid rgba(77,144,255,0.07)",
        flexShrink: 0,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
          background: "linear-gradient(135deg, rgba(77,144,255,0.3), rgba(155,138,251,0.3))",
          border: "1px solid rgba(77,144,255,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 800, color: "var(--t1)",
        }}>M</div>
        {!collapsed && (
          <div style={{ overflow: "hidden" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", whiteSpace: "nowrap" }}>Max</div>
            <div style={{ fontSize: 10, color: "var(--t3)", whiteSpace: "nowrap" }}>Account Manager · July 2026</div>
          </div>
        )}
      </div>
    </aside>
  );
}
