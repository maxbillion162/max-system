/**
 * Read-only diagnostic — counts encrypted vs plaintext rows in each table
 * so we can verify the migration actually landed.
 */
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { isEncrypted, ENCRYPTION_ENABLED } from "@/lib/encryption";

const PAGE = 500;

async function statusForTable(
  table: string,
  pkField: string,
  fields: string[],
): Promise<{ rows: number; encrypted: number; plaintext: number; null_or_empty: number; per_field?: Record<string, { encrypted: number; plaintext: number; null_or_empty: number }> }> {
  let rows = 0, encrypted = 0, plaintext = 0, nullOrEmpty = 0;
  const perField: Record<string, { encrypted: number; plaintext: number; null_or_empty: number }> = {};
  for (const f of fields) perField[f] = { encrypted: 0, plaintext: 0, null_or_empty: 0 };

  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select([pkField, ...fields].join(","))
      .range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    rows += data.length;

    for (const row of data) {
      const r = row as unknown as Record<string, unknown>;
      let rowAllEncrypted = true;
      let rowHasAnyContent = false;
      for (const f of fields) {
        const v = r[f];
        if (typeof v !== "string" || v.length === 0) {
          perField[f].null_or_empty++;
          continue;
        }
        rowHasAnyContent = true;
        if (isEncrypted(v)) {
          perField[f].encrypted++;
        } else {
          perField[f].plaintext++;
          rowAllEncrypted = false;
        }
      }
      if (!rowHasAnyContent) nullOrEmpty++;
      else if (rowAllEncrypted) encrypted++;
      else plaintext++;
    }

    if (data.length < PAGE) break;
    from += PAGE;
  }

  return { rows, encrypted, plaintext, null_or_empty: nullOrEmpty, per_field: perField };
}

export async function GET() {
  if (!ENCRYPTION_ENABLED) {
    return NextResponse.json({ ok: false, error: "ENCRYPTION_KEY not set on this deployment" }, { status: 503 });
  }

  const tables: Array<[string, string, string[]]> = [
    ["chat_messages",     "id",      ["content"]],
    ["telegram_history",  "id",      ["content"]],
    ["memories",          "id",      ["content"]],
    ["email_intel",       "thread_id", ["subject", "preview", "summary", "why_important", "action_reason"]],
    ["google_tokens",     "user_id", ["access_token", "refresh_token"]],
    ["accounts",          "plaid_account_id", ["plaid_access_token"]],
  ];

  const out: Record<string, unknown> = {};
  for (const [t, pk, fields] of tables) {
    try {
      out[t] = await statusForTable(t, pk, fields);
    } catch (err) {
      out[t] = { error: err instanceof Error ? err.message : String(err) };
    }
  }
  return NextResponse.json({ ok: true, tables: out });
}
