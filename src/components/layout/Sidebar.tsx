"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const nav = [
  { label: "Command Center", href: "/dashboard",          icon: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" },
  { label: "M.A.X. Chat",    href: "/dashboard/chat",     icon: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" },
  { label: "Goals HQ",       href: "/dashboard/goals",    icon: "M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10zm0-6a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" },
  { label: "Finance Hub",    href: "/dashboard/finance",  icon: "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" },
  { label: "Habits",         href: "/dashboard/habits",   icon: "M22 12h-4l-3 9L9 3l-3 9H2" },
  { label: "Calendar",       href: "/dashboard/calendar", icon: "M3 4h18c.6 0 1 .4 1 1v16c0 .6-.4 1-1 1H3c-.6 0-1-.4-1-1V5c0-.6.4-1 1-1zM16 2v4M8 2v4M2 10h20" },
  { label: "Email",          href: "/dashboard/email",    icon: "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6" },
  { label: "Intel Feed",     href: "/dashboard/feed",     icon: "M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16M5 19a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" },
  { label: "Archive",        href: "/dashboard/archive",  icon: "M21 8v13H3V8M1 3h22v5H1zM10 12h4" },
];

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const [emailBadge, setEmailBadge] = useState(0);

  // Read unread count written by email page
  useState(() => {
    try {
      const n = parseInt(localStorage.getItem("email-unread-count") ?? "0");
      if (!isNaN(n)) setEmailBadge(n);
    } catch {}
  });

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
        {/* Logo mark */}
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

        {/* Toggle button — sits cleanly inside header */}
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

        {/* When collapsed: clicking the logo expands */}
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
          {nav.map((item) => {
            const active = pathname === item.href;
            return (
              <li key={item.href}>
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
                  {!collapsed && item.href === "/dashboard/email" && emailBadge > 0 && (
                    <span style={{ fontSize: 10, fontWeight: 800, color: "#fff", background: "var(--red)", padding: "1px 5px", borderRadius: 3, flexShrink: 0 }}>{emailBadge}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ── System status ── */}
      {!collapsed && (
        <div style={{ margin: "0 10px 8px", padding: "10px 12px", borderRadius: 10, background: "rgba(6,182,212,0.04)", border: "1px solid rgba(6,182,212,0.07)", flexShrink: 0 }}>
          {[{ l: "AI Core", s: "Active" }, { l: "Data Feeds", s: "Live" }].map(x => (
            <div key={x.l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: "rgba(148,163,184,0.4)" }}>{x.l}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--green)" }}>{x.s}</span>
            </div>
          ))}
        </div>
      )}

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
