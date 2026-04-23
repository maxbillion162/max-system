"use client";

import { useState, useEffect, useCallback } from "react";
import { usePlaidLink, PlaidLinkOnSuccess } from "react-plaid-link";

interface Props {
  onConnected: () => void;
}

export default function PlaidLinkButton({ onConnected }: Props) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/plaid/create-link-token", { method: "POST" })
      .then(r => r.json())
      .then(({ link_token, error: err }) => {
        if (err) setError(err);
        else setLinkToken(link_token);
      })
      .catch(() => setError("Could not reach Plaid"));
  }, []);

  const onSuccess: PlaidLinkOnSuccess = useCallback(async (public_token, metadata) => {
    setLoading(true);
    try {
      await fetch("/api/plaid/exchange-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          public_token,
          institution: metadata.institution,
          accounts: metadata.accounts,
        }),
      });
      onConnected();
    } finally {
      setLoading(false);
    }
  }, [onConnected]);

  const { open, ready } = usePlaidLink({ token: linkToken, onSuccess });

  if (error) {
    return (
      <div style={{ fontSize: 11, color: "var(--red)", padding: "8px 14px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6 }}>
        {error}
      </div>
    );
  }

  return (
    <button
      onClick={() => open()}
      disabled={!ready || loading}
      style={{
        padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700,
        background: ready ? "rgba(69,137,255,0.12)" : "rgba(255,255,255,0.04)",
        border: `1px solid ${ready ? "rgba(69,137,255,0.35)" : "rgba(255,255,255,0.08)"}`,
        color: ready ? "var(--blue)" : "var(--t4)",
        cursor: ready ? "pointer" : "not-allowed",
        transition: "all 0.15s",
        display: "flex", alignItems: "center", gap: 8,
      }}
      onMouseEnter={e => {
        if (ready) {
          (e.currentTarget as HTMLElement).style.background = "rgba(69,137,255,0.2)";
          (e.currentTarget as HTMLElement).style.borderColor = "rgba(69,137,255,0.5)";
        }
      }}
      onMouseLeave={e => {
        if (ready) {
          (e.currentTarget as HTMLElement).style.background = "rgba(69,137,255,0.12)";
          (e.currentTarget as HTMLElement).style.borderColor = "rgba(69,137,255,0.35)";
        }
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
      {loading ? "Connecting…" : !ready ? "Loading…" : "Connect Bank"}
    </button>
  );
}
