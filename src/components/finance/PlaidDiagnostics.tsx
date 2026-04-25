"use client";

import { useEffect, useState } from "react";

const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

interface AccountRow {
  plaid_account_id:  string;
  name:              string;
  institution:       string | null;
  mask:              string | null;
  type:              string | null;
  subtype:           string | null;
  account_type:      string | null;
  current_balance:   number | null;
  available_balance: number | null;
  last_synced:       string | null;
  active:            boolean;
  archived:          boolean;
  token_env:         string;
  created_at:        string;
}

interface Diag {
  summary: {
    server_plaid_env:    string;
    has_plaid_secret:    boolean;
    has_plaid_client_id: boolean;
    total_accounts:      number;
    visible_accounts:    number;
    archived_accounts:   number;
    accounts_by_env: {
      sandbox:    number;
      production: number;
      development:number;
      unknown:    number;
    };
  };
  accounts: AccountRow[];
  issues:   string[];
}

interface Props {
  onChanged: () => Promise<void> | void;
}

export function PlaidDiagnostics({ onChanged }: Props) {
  const [data, setData] = useState<Diag | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/plaid/diagnostics");
      const json = await res.json();
      setData(json);
    } catch {
      /* ignored */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

  async function runCleanup() {
    if (!confirm("This will permanently delete all transactions from sandbox/test accounts and archive those accounts. Continue?")) return;
    setBusy("cleanup");
    try {
      const res = await fetch("/api/plaid/cleanup", { method: "POST" });
      const j = await res.json();
      alert(`Cleanup complete:\n  · ${j.archived ?? 0} accounts archived\n  · ${j.transactions_deleted ?? 0} fake transactions deleted`);
      await refresh(); await onChanged();
    } finally { setBusy(null); }
  }

  async function restoreAll() {
    setBusy("restore");
    try {
      const res = await fetch("/api/plaid/restore", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) });
      const j = await res.json();
      alert(`Restored ${j.restored ?? 0} archived accounts.`);
      await refresh(); await onChanged();
    } finally { setBusy(null); }
  }

  async function restoreOne(id: string) {
    setBusy(id);
    try {
      await fetch("/api/plaid/restore", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plaid_account_id: id }) });
      await refresh(); await onChanged();
    } finally { setBusy(null); }
  }

  async function syncNow() {
    setBusy("sync");
    try {
      const res = await fetch("/api/plaid/sync", { method: "POST" });
      const j = await res.json();
      alert(j.error ? `Sync failed: ${j.error}` : `Sync: ${j.synced ?? 0} transactions, balances refreshed.`);
      await refresh(); await onChanged();
    } finally { setBusy(null); }
  }

  if (loading && !data) {
    return (
      <div style={panelStyle()}>
        <p style={{ fontSize: 11, color: "var(--t3)", fontFamily: MONO, letterSpacing: "0.14em" }}>LOADING DIAGNOSTICS…</p>
      </div>
    );
  }

  if (!data) return null;

  const env = data.summary.server_plaid_env;
  const envColor =
    env === "production" ? "var(--green)" :
    env === "sandbox"    ? "var(--red)"   :
    "var(--t4)";

  return (
    <div style={panelStyle()}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <div>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.32em", color: "var(--blue)", fontFamily: MONO, marginBottom: 4 }}>
            PLAID DIAGNOSTICS
          </p>
          <p style={{ fontSize: 11, color: "var(--t3)" }}>
            What this Vercel deployment thinks is connected.
          </p>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button onClick={refresh} style={btn("var(--t2)")}>↻ REFRESH</button>
          <button onClick={syncNow} disabled={busy !== null} style={btn("var(--blue)")}>
            {busy === "sync" ? "SYNCING…" : "FORCE SYNC"}
          </button>
          {data.summary.archived_accounts > 0 && (
            <button onClick={restoreAll} disabled={busy !== null} style={btn("var(--green)")}>
              {busy === "restore" ? "…" : `RESTORE ${data.summary.archived_accounts} ARCHIVED`}
            </button>
          )}
          <button onClick={runCleanup} disabled={busy !== null} style={btn("var(--red)")}>
            {busy === "cleanup" ? "…" : "DELETE FAKE DATA"}
          </button>
        </div>
      </div>

      {/* Server config strip */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0,
        background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 2,
        padding: "10px 0",
        marginBottom: data.issues.length > 0 ? 10 : 14,
      }}>
        <Cell label="SERVER PLAID_ENV" value={env.toUpperCase()} valueColor={envColor} />
        <Cell label="CLIENT ID" value={data.summary.has_plaid_client_id ? "SET" : "MISSING"} valueColor={data.summary.has_plaid_client_id ? "var(--green)" : "var(--red)"} />
        <Cell label="SECRET" value={data.summary.has_plaid_secret ? "SET" : "MISSING"} valueColor={data.summary.has_plaid_secret ? "var(--green)" : "var(--red)"} />
        <Cell label="ACCOUNTS DB" value={`${data.summary.visible_accounts} / ${data.summary.total_accounts}`} valueColor="var(--t1)" />
      </div>

      {/* Issues */}
      {data.issues.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 14px 0", display: "flex", flexDirection: "column", gap: 6 }}>
          {data.issues.map((iss, i) => (
            <li key={i} style={{
              background: "rgba(200,90,90,0.06)", border: "1px solid rgba(200,90,90,0.25)",
              borderRadius: 2, padding: "8px 12px",
              fontSize: 12, color: "var(--t1)", lineHeight: 1.5,
            }}>
              <span style={{ color: "var(--red)", fontFamily: MONO, fontWeight: 700, letterSpacing: "0.14em", marginRight: 6 }}>⚠</span>
              {iss}
            </li>
          ))}
        </ul>
      )}

      {/* Env tally */}
      <div style={{ display: "flex", gap: 10, marginBottom: 12, fontSize: 10, fontFamily: MONO, letterSpacing: "0.12em" }}>
        <span style={{ color: "var(--t3)" }}>BY ENV →</span>
        <span style={{ color: data.summary.accounts_by_env.production > 0 ? "var(--green)" : "var(--t4)" }}>
          PRODUCTION: {data.summary.accounts_by_env.production}
        </span>
        <span style={{ color: data.summary.accounts_by_env.sandbox > 0 ? "var(--red)" : "var(--t4)" }}>
          SANDBOX: {data.summary.accounts_by_env.sandbox}
        </span>
        {data.summary.accounts_by_env.development > 0 && (
          <span style={{ color: "var(--amber)" }}>DEV: {data.summary.accounts_by_env.development}</span>
        )}
        {data.summary.accounts_by_env.unknown > 0 && (
          <span style={{ color: "var(--t4)" }}>UNKNOWN: {data.summary.accounts_by_env.unknown}</span>
        )}
      </div>

      {/* Account rows */}
      {data.accounts.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--t3)", padding: "16px 0", textAlign: "center" }}>
          No accounts in the database. Connect a bank from the Account Hub above.
        </p>
      ) : (
        <div style={{ overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontFamily: MONO }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <Th>NAME</Th>
                <Th>INSTITUTION</Th>
                <Th>TYPE</Th>
                <Th>BALANCE</Th>
                <Th>SYNCED</Th>
                <Th>TOKEN</Th>
                <Th>STATUS</Th>
                <Th> </Th>
              </tr>
            </thead>
            <tbody>
              {data.accounts.map((a, i) => {
                const tokenColor =
                  a.token_env === "production" ? "var(--green)" :
                  a.token_env === "sandbox"    ? "var(--red)"   :
                  "var(--t4)";
                const statusColor =
                  a.archived  ? "var(--red)"   :
                  a.active    ? "var(--green)" :
                  "var(--t4)";
                return (
                  <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                    <Td>{a.name}{a.mask ? <span style={{ color: "var(--t4)" }}>  ····{a.mask}</span> : null}</Td>
                    <Td>{a.institution ?? "—"}</Td>
                    <Td>{(a.account_type ?? a.type ?? "—").toString().toUpperCase()}</Td>
                    <Td>{a.current_balance !== null ? `$${a.current_balance.toFixed(2)}` : <span style={{ color: "var(--t4)" }}>—</span>}</Td>
                    <Td>{a.last_synced ? new Date(a.last_synced).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : <span style={{ color: "var(--t4)" }}>NEVER</span>}</Td>
                    <Td><span style={{ color: tokenColor }}>{a.token_env.toUpperCase()}</span></Td>
                    <Td><span style={{ color: statusColor }}>{a.archived ? "ARCHIVED" : a.active ? "ACTIVE" : "INACTIVE"}</span></Td>
                    <Td>
                      {a.archived && (
                        <button
                          onClick={() => restoreOne(a.plaid_account_id)}
                          disabled={busy !== null}
                          style={{ ...btn("var(--green)"), padding: "3px 8px", fontSize: 9 }}
                        >
                          RESTORE
                        </button>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function panelStyle(): React.CSSProperties {
  return {
    background: "linear-gradient(160deg, #0f141d 0%, #080b11 100%)",
    border: "1px solid rgba(125,184,232,0.10)", borderRadius: 3,
    padding: "16px 18px",
  };
}

function btn(color: string): React.CSSProperties {
  return {
    background: "transparent", border: "1px solid var(--border)",
    borderRadius: 2, padding: "5px 10px",
    color, cursor: "pointer",
    fontFamily: MONO, fontSize: 9, letterSpacing: "0.18em", fontWeight: 700,
    transition: "border-color .15s",
  };
}

function Cell({ label, value, valueColor }: { label: string; value: string; valueColor: string }) {
  return (
    <div style={{ padding: "0 14px", borderRight: "1px solid var(--border)" }}>
      <p style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.28em", color: "var(--t3)", fontFamily: MONO, marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 13, fontFamily: MONO, color: valueColor, letterSpacing: "-0.01em" }}>{value}</p>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ textAlign: "left", padding: "8px 10px", fontWeight: 700, color: "var(--t3)", letterSpacing: "0.16em", fontSize: 9 }}>{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: "8px 10px", color: "var(--t1)", fontSize: 11 }}>{children}</td>;
}
