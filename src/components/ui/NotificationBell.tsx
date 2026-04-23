"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  action_url: string | null;
  created_at: string;
}

const TYPE_CONFIG: Record<string, { icon: string; color: string }> = {
  crypto_alert:      { icon: "◈", color: "#f59e0b" },
  habit_reminder:    { icon: "◎", color: "#4589ff" },
  bill_due:          { icon: "!", color: "#ef4444" },
  calendar_reminder: { icon: "◷", color: "#4589ff" },
  max_action:        { icon: "✦", color: "#8b5cf6" },
  budget_alert:      { icon: "▲", color: "#f97316" },
  goal_milestone:    { icon: "◆", color: "#10b981" },
  general:           { icon: "•", color: "#4589ff" },
};

function getConfig(type: string) {
  return TYPE_CONFIG[type] ?? TYPE_CONFIG.general;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [toasts, setToasts] = useState<Notification[]>([]);

  const unread = notifications.filter(n => !n.read).length;

  const fetchNotifications = useCallback(async () => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setNotifications(data);
  }, []);

  useEffect(() => {
    fetchNotifications();

    const channel = supabase
      .channel("notifications-bell")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          const n = payload.new as Notification;
          setNotifications(prev => [n, ...prev]);
          setToasts(prev => [...prev, n]);
          setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== n.id));
          }, 5000);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchNotifications]);

  async function markRead(id: string) {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }

  async function markAllRead() {
    const ids = notifications.filter(n => !n.read).map(n => n.id);
    if (ids.length === 0) return;
    await supabase.from("notifications").update({ read: true }).in("id", ids);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }

  return (
    <>
      <style>{`
        @keyframes pulse-badge {
          0%, 100% { transform: scale(1); box-shadow: 0 0 8px rgba(239,68,68,0.6); }
          50% { transform: scale(1.15); box-shadow: 0 0 14px rgba(239,68,68,0.9); }
        }
        @keyframes toast-in {
          from { opacity: 0; transform: translateX(24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      {/* ── Bell button ── */}
      <div style={{ position: "fixed", top: 20, right: 24, zIndex: 50 }}>
        <button
          onClick={() => setOpen(o => !o)}
          title="Notifications"
          style={{
            width: 38, height: 38, borderRadius: 10,
            background: open ? "rgba(69,137,255,0.12)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${open ? "rgba(69,137,255,0.35)" : "rgba(255,255,255,0.08)"}`,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            position: "relative", transition: "all 0.15s",
            color: open ? "#4589ff" : "rgba(148,163,184,0.65)",
          }}
          onMouseEnter={e => {
            if (!open) {
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)";
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.14)";
            }
          }}
          onMouseLeave={e => {
            if (!open) {
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)";
            }
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24"
            fill={unread > 0 ? "currentColor" : "none"}
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>

          {unread > 0 && (
            <div style={{
              position: "absolute", top: -5, right: -5,
              minWidth: 16, height: 16, borderRadius: 8,
              background: "#ef4444", color: "#fff",
              fontSize: 9, fontWeight: 800,
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "0 4px",
              animation: "pulse-badge 2.5s ease-in-out infinite",
            }}>
              {unread > 99 ? "99+" : unread}
            </div>
          )}
        </button>
      </div>

      {/* ── Backdrop ── */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 48,
            background: "rgba(0,0,0,0.45)",
            backdropFilter: "blur(2px)",
          }}
        />
      )}

      {/* ── Drawer ── */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 49,
        width: 380,
        background: "linear-gradient(180deg, #07090f 0%, #050710 100%)",
        borderLeft: "1px solid rgba(69,137,255,0.1)",
        transform: open ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1)",
        display: "flex", flexDirection: "column",
        boxShadow: open ? "-24px 0 80px rgba(0,0,0,0.7)" : "none",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 20px 16px",
          borderBottom: "1px solid rgba(69,137,255,0.07)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--t1)", letterSpacing: "0.02em" }}>
              Notifications
            </div>
            {unread > 0 && (
              <div style={{ fontSize: 11, color: "rgba(69,137,255,0.7)", marginTop: 2 }}>
                {unread} unread
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                style={{
                  fontSize: 11, fontWeight: 500, color: "rgba(69,137,255,0.8)",
                  background: "rgba(69,137,255,0.08)", border: "1px solid rgba(69,137,255,0.15)",
                  borderRadius: 6, padding: "5px 10px", cursor: "pointer", transition: "all 0.15s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(69,137,255,0.16)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(69,137,255,0.08)"; }}
              >
                Mark all read
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              style={{
                width: 28, height: 28, borderRadius: 7, background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.07)", color: "rgba(148,163,184,0.45)",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.15s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.09)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {notifications.length === 0 ? (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              height: "100%", gap: 14, paddingBottom: 40,
            }}>
              <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="rgba(148,163,184,0.2)" strokeWidth="1.5" strokeLinecap="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 13, color: "rgba(148,163,184,0.3)", fontWeight: 500 }}>No notifications yet</div>
                <div style={{ fontSize: 11, color: "rgba(148,163,184,0.2)", marginTop: 4 }}>M.A.X. will alert you here</div>
              </div>
            </div>
          ) : (
            <div style={{ padding: "4px 0" }}>
              {notifications.map(n => {
                const cfg = getConfig(n.type);
                return (
                  <div
                    key={n.id}
                    onClick={() => {
                      if (!n.read) markRead(n.id);
                      if (n.action_url) window.location.href = n.action_url;
                    }}
                    style={{
                      padding: "13px 20px",
                      display: "flex", gap: 12, alignItems: "flex-start",
                      cursor: "pointer",
                      background: n.read ? "transparent" : "rgba(69,137,255,0.04)",
                      borderLeft: `3px solid ${n.read ? "transparent" : cfg.color}`,
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background = n.read
                        ? "rgba(255,255,255,0.02)"
                        : "rgba(69,137,255,0.08)";
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = n.read
                        ? "transparent"
                        : "rgba(69,137,255,0.04)";
                    }}
                  >
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      background: `${cfg.color}18`, border: `1px solid ${cfg.color}28`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13, color: cfg.color, fontWeight: 700,
                    }}>
                      {cfg.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 3 }}>
                        <div style={{
                          fontSize: 13, fontWeight: n.read ? 500 : 600,
                          color: n.read ? "var(--t2)" : "var(--t1)",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {n.title}
                        </div>
                        <div style={{ fontSize: 10, color: "rgba(148,163,184,0.3)", flexShrink: 0 }}>
                          {timeAgo(n.created_at)}
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: "rgba(148,163,184,0.45)", lineHeight: 1.5 }}>
                        {n.body}
                      </div>
                    </div>
                    {!n.read && (
                      <div style={{
                        width: 6, height: 6, borderRadius: "50%", flexShrink: 0, marginTop: 6,
                        background: cfg.color, boxShadow: `0 0 6px ${cfg.color}`,
                      }} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Toast stack ── */}
      <div style={{
        position: "fixed", top: 72, right: 20, zIndex: 60,
        display: "flex", flexDirection: "column", gap: 8,
        pointerEvents: "none",
      }}>
        {toasts.map(toast => {
          const cfg = getConfig(toast.type);
          return (
            <div
              key={toast.id}
              style={{
                width: 320,
                background: "linear-gradient(135deg, #0c0f1c, #080a12)",
                border: `1px solid ${cfg.color}28`,
                borderLeft: `3px solid ${cfg.color}`,
                borderRadius: 10,
                padding: "12px 14px",
                display: "flex", gap: 10, alignItems: "flex-start",
                boxShadow: `0 8px 40px rgba(0,0,0,0.7), 0 0 20px ${cfg.color}10`,
                animation: "toast-in 0.3s cubic-bezier(0.4,0,0.2,1)",
                pointerEvents: "all",
              }}
            >
              <div style={{ fontSize: 14, color: cfg.color, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>
                {cfg.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--t1)" }}>{toast.title}</div>
                <div style={{ fontSize: 11, color: "rgba(148,163,184,0.55)", marginTop: 3, lineHeight: 1.5 }}>{toast.body}</div>
              </div>
              <button
                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "rgba(148,163,184,0.25)", flexShrink: 0, lineHeight: 1,
                  fontSize: 16, padding: "0 2px",
                }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
