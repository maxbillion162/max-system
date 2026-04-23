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
  { label: "Calendar",       href: "/dashboard/calendar", icon: "M3 4h18c.6 0 1 .4 1 1v16c0 .6-.4 1-1 1H3c-.6 0-1-.4-1-1V5c0-.6.4-1 1-1zM16 2v4M8 2v4M2 10h20" },
  { label: "Email",          href: "/dashboard/email",    icon: "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6" },
  { label: "Intel Feed",     href: "/dashboard/feed",     icon: "M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16M5 19a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" },
  { label: "Budget",         href: "/dashboard/budget",   icon: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" },
  { label: "Archive",        href: "/dashboard/archive",  icon: "M21 8v13H3V8M1 3h22v5H1zM10 12h4" },
];

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const [nav, setNav] = useState(NAV_DEFAULT);
  const [dragIdx, setDragIdx]       = useState<number | null>(null);
  const [dropIdx, setDropIdx]       = useState<number | null>(null);

  useEffect(() => {
    // Saved nav order
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

  function handleDragOver(e: React.DragEvent, i: number) {
    e.preventDefault();
    setDropIdx(i);
  }

  function handleDrop(e: React.DragEvent, i: number) {
    e.preventDefault();
    if (dragIdx === null || dragIdx === i) { setDragIdx(null); setDropIdx(null); return; }
    const next = [...nav];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(i, 0, moved);
    setNav(next);
    try { localStorage.setItem("nav-order", JSON.stringify(next.map(n => n.href))); } catch {}
    setDragIdx(null);
    setDropIdx(null);
  }

  function handleDragEnd() { setDragIdx(null); setDropIdx(null); }

  return (
    <aside
      className="fixed left-0 top-0 h-full z-40 flex flex-col"
      style={{
        width: collapsed ? 56 : 220,
        background: "linear-gradient(180deg, #07090f 0%, #050710 100%)",
        borderRight: "1px solid rgba(6,182,212,0.08)",
        transition: "width 0.25s ease",
        overflow: "hidden",
      }}
    >
      {/* ── Header: logo + toggle ── */}
      <div
        className="flex items-center flex-shrink-0"
        style={{
          borderBottom: "1px solid rgba(6,182,212,0.07)",
          height: 60,
          padding: collapsed ? "0 12px" : "0 14px",
          justifyContent: collapsed ? "center" : "space-between",
          transition: "padding 0.25s ease",
        }}
      >
        <div className="flex items-center gap-0 flex-shrink-0" style={{ gap: collapsed ? 0 : 10 }}>
          <div
            className="flex-shrink-0 rounded-lg flex items-center justify-center"
            style={{
              width: 32, height: 32,
              background: "linear-gradient(135deg, #0b2040, #071428)",
              border: "1px solid rgba(6,182,212,0.4)",
              boxShadow: "0 0 14px rgba(6,182,212,0.12)",
            }}
          >
            <span className="text-sm font-black" style={{ color: "var(--teal)" }}>M</span>
          </div>

          {!collapsed && (
            <div style={{ overflow: "hidden", whiteSpace: "nowrap" }}>
              <div className="text-sm font-black tracking-widest" style={{ color: "var(--t1)" }}>M.A.X.</div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{
                  background: "var(--green)",
                  boxShadow: "0 0 6px var(--green)",
                  display: "inline-block",
                  animation: "pulse-dot 2s ease-in-out infinite",
                }} />
                <span style={{ color: "var(--green)", fontSize: 10, fontWeight: 600, letterSpacing: "0.05em" }}>ONLINE</span>
              </div>
            </div>
          )}
        </div>

        {!collapsed && (
          <button
            onClick={onToggle}
            className="flex items-center justify-center rounded-lg transition-all hover:opacity-80"
            style={{
              width: 28, height: 28, flexShrink: 0,
              background: "rgba(6,182,212,0.06)",
              border: "1px solid rgba(6,182,212,0.12)",
              color: "var(--t3)",
            }}
            title="Collapse sidebar"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}

        {collapsed && (
          <button
            onClick={onToggle}
            className="absolute inset-0 w-full h-[60px] opacity-0 cursor-pointer"
            title="Expand sidebar"
          />
        )}
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden" style={{ padding: collapsed ? "12px 6px" : "12px 10px" }}>
        {!collapsed && (
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(6,182,212,0.25)", padding: "4px 8px 8px", whiteSpace: "nowrap" }}>
            Navigation
          </div>
        )}
        <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 2 }}>
          {nav.map((item, idx) => {
            const active = pathname === item.href;
            const isDragging = dragIdx === idx;
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
                  opacity: isDragging ? 0.35 : 1,
                  transition: "opacity .15s",
                  borderTop: isDropTarget ? "2px solid rgba(6,182,212,0.5)" : "2px solid transparent",
                }}
              >
                <Link
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: collapsed ? 0 : 10,
                    padding: collapsed ? "10px 0" : "9px 10px",
                    justifyContent: collapsed ? "center" : "flex-start",
                    borderRadius: 8,
                    color: active ? "var(--t1)" : "rgba(148,163,184,0.5)",
                    background: active ? "rgba(6,182,212,0.1)" : "transparent",
                    borderLeft: active && !collapsed ? "2px solid var(--teal)" : "2px solid transparent",
                    textDecoration: "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke={active ? "var(--teal)" : "rgba(148,163,184,0.35)"}
                    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                    style={{ flexShrink: 0 }}>
                    <path d={item.icon} />
                  </svg>
                  {!collapsed && (
                    <span style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", flex: 1 }}>{item.label}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ── Settings ── */}
      <div style={{ padding: collapsed ? "8px 6px" : "8px 10px", borderTop: "1px solid rgba(6,182,212,0.07)", flexShrink: 0 }}>
        <Link
          href="/dashboard/settings"
          title={collapsed ? "Settings" : undefined}
          style={{
            display: "flex", alignItems: "center", gap: collapsed ? 0 : 10,
            padding: collapsed ? "10px 0" : "9px 10px",
            justifyContent: collapsed ? "center" : "flex-start",
            borderRadius: 8, textDecoration: "none",
            color: "rgba(148,163,184,0.4)",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(148,163,184,0.75)"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(148,163,184,0.4)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          {!collapsed && <span style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap" }}>Settings</span>}
        </Link>
      </div>

      {/* ── User ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: collapsed ? "12px 0" : "12px 14px",
        justifyContent: collapsed ? "center" : "flex-start",
        borderTop: "1px solid rgba(6,182,212,0.07)",
        flexShrink: 0,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
          background: "linear-gradient(135deg, #0369a1, #6d28d9)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 800, color: "#fff",
        }}>M</div>
        {!collapsed && (
          <div style={{ overflow: "hidden" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", whiteSpace: "nowrap" }}>Max</div>
            <div style={{ fontSize: 10, color: "rgba(148,163,184,0.35)", whiteSpace: "nowrap" }}>FSU → Account Manager</div>
          </div>
        )}
      </div>
    </aside>
  );
}
