"use client";

import { useState } from "react";
import type { Account, AccountType } from "@/types/finance";

/* Type-aware visual language */
const TYPE_THEME: Record<AccountType, { label: string; color: string; icon: string; isDebt?: boolean }> = {
  checking:   { label: "CHECKING",    color: "#7DB8E8", icon: "▤" },
  savings:    { label: "SAVINGS",     color: "#5FB07D", icon: "▣" },
  cash:       { label: "CASH",        color: "#5FB07D", icon: "▣" },
  credit:     { label: "CREDIT",      color: "#C85A5A", icon: "▩", isDebt: true },
  loan:       { label: "LOAN",        color: "#C85A5A", icon: "▥", isDebt: true },
  investment: { label: "INVESTMENT",  color: "#B89A6E", icon: "▤" },
  other:      { label: "ACCOUNT",     color: "#8794A6", icon: "▤" },
};

const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

function formatBalance(amount: number | null | undefined, isDebt: boolean): string {
  if (amount === null || amount === undefined) return "—";
  const sign = isDebt ? "−" : "";
  return `${sign}$${Math.abs(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatRelative(iso: string | null): string {
  if (!iso) return "never synced";
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1)  return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24)  return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

interface AccountCardProps {
  account:    Account;
  onRefresh?: () => Promise<void> | void;
  onArchive?: (id: string) => Promise<void> | void;
}

export function AccountCard({ account, onRefresh, onArchive }: AccountCardProps) {
  const theme = TYPE_THEME[account.account_type] ?? TYPE_THEME.other;
  const isDebt = !!theme.isDebt;
  const [menuOpen, setMenuOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    if (!onRefresh) return;
    setRefreshing(true);
    try { await onRefresh(); } finally { setRefreshing(false); setMenuOpen(false); }
  }

  return (
    <div
      style={{
        position: "relative",
        background: "linear-gradient(160deg, #0f141d 0%, #080b11 100%)",
        border: `1px solid ${theme.color}22`,
        borderRadius: 3,
        padding: "14px 16px",
        boxShadow: "0 6px 24px rgba(0,0,0,0.45)",
        display: "flex", flexDirection: "column", gap: 10,
        minHeight: 120,
      }}
    >
      {/* Top row: type + institution + menu */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: "0.22em",
            color: theme.color, fontFamily: MONO,
          }}>
            {theme.label}
          </span>
          {account.institution && (
            <>
              <span style={{ color: "var(--t4)", fontSize: 9 }}>·</span>
              <span style={{ fontSize: 10, color: "var(--t3)", letterSpacing: "0.05em" }}>
                {account.institution}
              </span>
            </>
          )}
        </div>
        <button
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Account actions"
          style={{
            background: "transparent", border: "none", color: "var(--t3)", cursor: "pointer",
            padding: 4, borderRadius: 2, transition: "color .15s, background .15s",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" />
          </svg>
        </button>
        {menuOpen && (
          <>
            <div
              onClick={() => setMenuOpen(false)}
              style={{ position: "fixed", inset: 0, zIndex: 20 }}
            />
            <div style={{
              position: "absolute", top: 36, right: 12, zIndex: 21,
              background: "#0a0d12", border: "1px solid var(--border2)", borderRadius: 3,
              minWidth: 160, padding: 4, boxShadow: "0 12px 30px rgba(0,0,0,0.6)",
              fontFamily: MONO, fontSize: 11, letterSpacing: "0.08em",
            }}>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                style={menuItemStyle()}
              >
                {refreshing ? "REFRESHING…" : "REFRESH BALANCE"}
              </button>
              {onArchive && (
                <button
                  onClick={async () => {
                    if (confirm(`Hide ${account.name}? You can restore from settings.`)) {
                      await onArchive(account.plaid_account_id);
                    }
                    setMenuOpen(false);
                  }}
                  style={{ ...menuItemStyle(), color: "var(--red)" }}
                >
                  HIDE ACCOUNT
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Account name + mask */}
      <div>
        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", lineHeight: 1.3, marginBottom: 2 }}>
          {account.name}
        </p>
        {account.mask && (
          <p style={{ fontSize: 10, color: "var(--t4)", fontFamily: MONO, letterSpacing: "0.18em" }}>
            ····{account.mask}
          </p>
        )}
      </div>

      {/* Balance — the headline */}
      <div style={{ marginTop: "auto" }}>
        <p style={{
          fontSize: 22, fontWeight: 600, color: isDebt ? "var(--red)" : "var(--t1)",
          fontFamily: MONO, letterSpacing: "-0.02em", lineHeight: 1.1,
        }}>
          {formatBalance(account.current_balance, isDebt)}
        </p>
        {account.available_balance !== null
          && account.available_balance !== undefined
          && account.available_balance !== account.current_balance && (
          <p style={{ fontSize: 10, color: "var(--t3)", marginTop: 3, fontFamily: MONO }}>
            ${account.available_balance.toLocaleString("en-US", { minimumFractionDigits: 2 })} available
          </p>
        )}
      </div>

      {/* Footer: last synced */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        borderTop: "1px solid var(--border)", paddingTop: 8,
      }}>
        <span style={{ fontSize: 9, color: "var(--t4)", fontFamily: MONO, letterSpacing: "0.14em" }}>
          SYNCED {formatRelative(account.last_synced).toUpperCase()}
        </span>
        <span style={{
          width: 6, height: 6, borderRadius: "50%",
          background: account.last_synced ? theme.color : "var(--t4)",
          opacity: account.last_synced ? 0.6 : 0.3,
        }} />
      </div>
    </div>
  );
}

function menuItemStyle(): React.CSSProperties {
  return {
    display: "block",
    width: "100%",
    textAlign: "left",
    background: "transparent",
    border: "none",
    color: "var(--t2)",
    padding: "8px 10px",
    borderRadius: 2,
    cursor: "pointer",
    fontFamily: MONO,
    fontSize: 11,
    letterSpacing: "0.08em",
  };
}
