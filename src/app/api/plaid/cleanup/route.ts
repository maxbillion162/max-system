import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { decrypt } from "@/lib/encryption";

/**
 * Archive accounts AND delete their transactions when their Plaid access
 * token doesn't match the current PLAID_ENV.
 *
 * Plaid access tokens are tagged with their env:
 *   - access-sandbox-XXXX
 *   - access-production-XXXX
 *
 * When Max switched from sandbox → production, his old sandbox accounts +
 * thousands of fake "Box Stripe" / "Touchstone Climbing" / etc. test
 * transactions stayed in the DB with stale data. This endpoint:
 *   1. Finds accounts whose token doesn't match the current env
 *   2. Hard-deletes every transaction tied to those accounts
 *   3. Archives the accounts themselves (archived=true, active=false)
 *
 * Idempotent. Safe to call multiple times.
 */

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
  );
}

export async function POST() {
  const env = (process.env.PLAID_ENV ?? "sandbox").toLowerCase();
  const expectedPrefix = `access-${env}-`;
  const supabase = sb();

  const { data: accounts, error } = await supabase
    .from("accounts")
    .select("plaid_account_id,plaid_access_token,archived,name,institution");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const stale = (accounts ?? []).filter(a => {
    if (!a.plaid_access_token) return false;
    const t = decrypt(a.plaid_access_token) ?? "";
    return t && !t.startsWith(expectedPrefix);
  });

  if (stale.length === 0) {
    return NextResponse.json({ env, archived: 0, transactions_deleted: 0 });
  }

  const staleAccountIds = stale.map(a => a.plaid_account_id);

  /* 1. Hard-delete every transaction tied to a stale account */
  const { error: txDeleteErr, count: txCount } = await supabase
    .from("transactions")
    .delete({ count: "exact" })
    .in("account_id", staleAccountIds);

  if (txDeleteErr) {
    return NextResponse.json({ error: `Transaction delete failed: ${txDeleteErr.message}` }, { status: 500 });
  }

  /* 2. Archive the accounts themselves */
  const { error: archiveErr } = await supabase
    .from("accounts")
    .update({ archived: true, active: false })
    .in("plaid_account_id", staleAccountIds);

  if (archiveErr) {
    return NextResponse.json({ error: `Archive failed: ${archiveErr.message}` }, { status: 500 });
  }

  return NextResponse.json({
    env,
    archived: stale.length,
    transactions_deleted: txCount ?? 0,
    accounts: stale.map(a => ({ name: a.name, institution: a.institution })),
  });
}
