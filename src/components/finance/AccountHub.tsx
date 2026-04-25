"use client";

import { useMemo } from "react";
import type { Account, AccountType } from "@/types/finance";
import { AccountCard } from "./AccountCard";
import PlaidLinkButton from "@/components/ui/PlaidLinkButton";

const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

const GROUPS: { key: AccountType[]; label: string; accent: string }[] = [
  { key: ["checking", "cash"],            label: "CASH",         accent: "#7DB8E8" },
  { key: ["savings"],                     label: "SAVINGS",      accent: "#5FB07D" },
  { key: ["investment"],                  label: "INVESTMENTS",  accent: "#B89A6E" },
  { key: ["credit", "loan"],              label: "DEBT",         accent: "#C85A5A" },
  { key: ["other"],                       label: "OTHER",        accent: "#8794A6" },
];

function formatUsd(n: number): string {
  return `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface AccountHubProps {
  accounts:   Account[];
  loading?:   boolean;
  onRefresh?: () => Promise<void> | void;
  onArchive?: (id: string) => Promise<void> | void;
  onConnected?: () => void;
}

export function AccountHub({ accounts, loading, onRefresh, onArchive, onConnected }: AccountHubProps) {
  const groups = useMemo(() => {
    return GROUPS.map(g => {
      const items = accounts.filter(a => g.key.includes(a.account_type));
      const total = items.reduce((s, a) => {
        const isDebt = a.account_type === "credit" || a.account_type === "loan";
        const bal = a.current_balance ?? 0;
        return s + (isDebt ? -Math.abs(bal) : bal);
      }, 0);
      return { ...g, items, total };
    }).filter(g => g.items.length > 0);
  }, [accounts]);

  /* ── Empty state ── */
  if (!loading && accounts.length === 0) {
    return (
      <div style={{
        background: "linear-gradient(160deg, #0f141d 0%, #080b11 100%)",
        border: "1px solid rgba(125,184,232,0.1)", borderRadius: 3,
        padding: "48px 32px", textAlign: "center",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 18,
      }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
          <rect x="2" y="6" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
          <path d="M6 16h2" /><path d="M12 16h6" />
        </svg>
        <div>
          <p style={{ fontSize: 14, color: "var(--t1)", fontWeight: 600, marginBottom: 6 }}>
            No accounts connected
          </p>
          <p style={{ fontSize: 12, color: "var(--t3)", lineHeight: 1.6, maxWidth: 360 }}>
            Connect your bank via Plaid to pull live balances, transactions, and net worth.
            Read-only — M.A.X. cannot move money.
          </p>
        </div>
        <PlaidLinkButton onConnected={() => onConnected?.()} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Top-bar with refresh + connect-another */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        paddingBottom: 4,
      }}>
        <div>
          <h3 style={{
            fontSize: 11, fontWeight: 700, color: "var(--t1)",
            letterSpacing: "0.24em", fontFamily: MONO, marginBottom: 4,
          }}>
            ACCOUNT HUB
          </h3>
          <p style={{ fontSize: 11, color: "var(--t3)" }}>
            {accounts.length} account{accounts.length === 1 ? "" : "s"} across {new Set(accounts.map(a => a.institution).filter(Boolean)).size} institution{new Set(accounts.map(a => a.institution).filter(Boolean)).size === 1 ? "" : "s"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {onRefresh && (
            <button
              onClick={() => onRefresh()}
              style={{
                background: "transparent", border: "1px solid var(--border)",
                borderRadius: 2, padding: "6px 12px",
                color: "var(--t3)", cursor: "pointer",
                fontSize: 10, letterSpacing: "0.16em", fontFamily: MONO,
                transition: "color .15s, border-color .15s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--blue)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--blue-border)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--t3)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; }}
            >
              SYNC ALL
            </button>
          )}
          <PlaidLinkButton onConnected={() => onConnected?.()} />
        </div>
      </div>

      {/* Grouped cards */}
      {groups.map(g => (
        <div key={g.label}>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "baseline",
            marginBottom: 10, paddingBottom: 6,
            borderBottom: `1px solid ${g.accent}22`,
          }}>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: "0.32em",
              color: g.accent, fontFamily: MONO,
            }}>
              {g.label}
            </span>
            <span style={{
              fontSize: 14, color: g.total < 0 ? "var(--red)" : "var(--t1)",
              fontFamily: MONO, fontWeight: 500,
              letterSpacing: "-0.01em",
            }}>
              {g.total < 0 ? "−" : ""}{formatUsd(g.total)}
            </span>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 10,
          }}>
            {g.items.map(a => (
              <AccountCard
                key={a.plaid_account_id}
                account={a}
                onRefresh={onRefresh}
                onArchive={onArchive}
              />
            ))}
          </div>
        </div>
      ))}

      {loading && accounts.length === 0 && (
        <p style={{ fontSize: 12, color: "var(--t4)", fontFamily: MONO, letterSpacing: "0.14em", textAlign: "center", padding: 20 }}>
          LOADING ACCOUNTS…
        </p>
      )}
    </div>
  );
}
