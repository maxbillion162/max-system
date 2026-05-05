/**
 * One-shot migration endpoint — encrypts existing plaintext rows.
 *
 * POST /api/admin/encrypt-existing
 *
 * Walks every table that holds sensitive content and encrypts any field that
 * isn't already prefixed with `enc:v1:`. Idempotent and incremental — safe to
 * call multiple times. Rows that fail are skipped, not aborted.
 *
 * Auth: gated by middleware (requires login session). Cookie-only access.
 *
 * Returns: { ok, total_encrypted, per_table }
 */
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { encrypt, isEncrypted, ENCRYPTION_ENABLED } from "@/lib/encryption";

const PAGE = 200;

async function migrateTable(
  table: string,
  pkField: string,
  fields: string[],
): Promise<{ scanned: number; encrypted: number; errors: number }> {
  let scanned = 0, encrypted = 0, errors = 0;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select([pkField, ...fields].join(","))
      .range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    scanned += data.length;

    for (const row of data) {
      const r = row as unknown as Record<string, unknown>;
      const update: Record<string, unknown> = {};
      let needsUpdate = false;
      for (const f of fields) {
        const v = r[f];
        if (typeof v === "string" && v.length > 0 && !isEncrypted(v)) {
          update[f] = encrypt(v);
          needsUpdate = true;
        }
      }
      if (!needsUpdate) continue;
      const pkValue = r[pkField];
      const { error: upErr } = await supabase.from(table).update(update).eq(pkField, pkValue);
      if (upErr) errors++;
      else encrypted++;
    }

    if (data.length < PAGE) break;
    from += PAGE;
  }

  return { scanned, encrypted, errors };
}

export async function POST() {
  if (!ENCRYPTION_ENABLED) {
    return NextResponse.json({ ok: false, error: "ENCRYPTION_KEY not set on server" }, { status: 503 });
  }

  const results: Record<string, unknown> = {};

  const tables: Array<[string, string, string[]]> = [
    ["chat_messages",     "id",      ["content"]],
    ["telegram_history",  "id",      ["content"]],
    ["memories",          "id",      ["content"]],
    ["email_intel",       "thread_id", ["subject", "preview", "summary", "why_important", "action_reason"]],
    ["google_tokens",     "user_id", ["access_token", "refresh_token"]],
    ["accounts",          "plaid_account_id", ["plaid_access_token"]],
  ];

  let totalEncrypted = 0;
  for (const [table, pk, fields] of tables) {
    try {
      const r = await migrateTable(table, pk, fields);
      results[table] = r;
      totalEncrypted += r.encrypted;
    } catch (err) {
      results[table] = { error: err instanceof Error ? err.message : String(err) };
    }
  }

  return NextResponse.json({ ok: true, total_encrypted: totalEncrypted, per_table: results });
}
