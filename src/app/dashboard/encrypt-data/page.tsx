"use client";

import { useState } from "react";

export default function EncryptDataPage() {
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [result, setResult] = useState<{ total_encrypted?: number; per_table?: Record<string, { scanned: number; encrypted: number; errors: number } | { error: string }>; error?: string } | null>(null);

  async function run() {
    setStatus("running");
    try {
      const r = await fetch("/api/admin/encrypt-existing", { method: "POST" });
      const j = await r.json();
      if (j.ok) {
        setStatus("done");
        setResult(j);
      } else {
        setStatus("error");
        setResult(j);
      }
    } catch (err) {
      setStatus("error");
      setResult({ error: err instanceof Error ? err.message : String(err) });
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: "60px auto", padding: "0 24px", fontFamily: "Inter, system-ui, sans-serif", color: "#E4EAF2" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 8 }}>Encrypt your data</h1>
      <p style={{ fontSize: 14, color: "#8794A6", lineHeight: 1.6, marginBottom: 32 }}>
        This locks all your existing chats, memories, email summaries, Gmail token, and bank tokens
        with AES-256 encryption. Run this once. You can re-run it any time — it skips data
        that&rsquo;s already encrypted.
      </p>

      <button
        onClick={run}
        disabled={status === "running" || status === "done"}
        style={{
          padding: "14px 24px",
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          background: status === "done" ? "rgba(95,176,125,0.18)" : "#7DB8E8",
          color: status === "done" ? "#5FB07D" : "#000",
          border: status === "done" ? "1px solid rgba(95,176,125,0.4)" : "none",
          borderRadius: 4,
          cursor: status === "running" || status === "done" ? "default" : "pointer",
          opacity: status === "running" ? 0.6 : 1,
        }}
      >
        {status === "idle" && "Encrypt my data now"}
        {status === "running" && "Encrypting…"}
        {status === "done" && "✓ Done"}
        {status === "error" && "Error — try again"}
      </button>

      {status === "done" && result && (
        <div style={{ marginTop: 32, padding: 20, background: "#0a0d12", border: "1px solid rgba(125,184,232,0.18)", borderRadius: 4 }}>
          <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
            Encrypted {result.total_encrypted ?? 0} rows total
          </p>
          {result.per_table && (
            <div style={{ fontFamily: "monospace", fontSize: 12, color: "#8794A6", lineHeight: 1.8 }}>
              {Object.entries(result.per_table).map(([table, stats]) => (
                <div key={table}>
                  {table}:{" "}
                  {"error" in stats
                    ? <span style={{ color: "#C85A5A" }}>{stats.error}</span>
                    : <>{stats.encrypted} encrypted, {stats.scanned} scanned{stats.errors > 0 ? `, ${stats.errors} errors` : ""}</>
                  }
                </div>
              ))}
            </div>
          )}
          <p style={{ fontSize: 12, color: "#525C6B", marginTop: 16 }}>
            Safe to leave this page now. Your data is encrypted at rest.
          </p>
        </div>
      )}

      {status === "error" && result && (
        <div style={{ marginTop: 32, padding: 20, background: "rgba(200,90,90,0.08)", border: "1px solid rgba(200,90,90,0.3)", borderRadius: 4 }}>
          <p style={{ fontSize: 13, color: "#C85A5A", fontWeight: 600 }}>
            {result.error ?? "Something went wrong."}
          </p>
          <p style={{ fontSize: 12, color: "#8794A6", marginTop: 8 }}>
            Most common cause: ENCRYPTION_KEY isn&rsquo;t set on Vercel yet. Add it under
            Settings → Environment Variables, redeploy, then come back to this page.
          </p>
        </div>
      )}
    </div>
  );
}
