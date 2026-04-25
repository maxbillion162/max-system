import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Archive accounts whose Plaid access token doesn't match the current PLAID_ENV.
 *
 * Plaid access tokens are tagged with their env at the prefix:
 *   - access-sandbox-XXXX
 *   - access-production-XXXX
 *
 * When Max switches from sandbox → production, his old sandbox accounts stay
 * in the DB with stale (and now meaningless) data. This endpoint detects them
 * and flips `archived = true` so they disappear from the UI.
 *
 * Idempotent. Safe to call on every Finance page mount.
 */

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

  const stale = (accounts ?? []).filter(a =>
    a.plaid_access_token
    && !a.archived
    && !a.plaid_access_token.startsWith(expectedPrefix)
  );

  if (stale.length === 0) {
    return NextResponse.json({ env, archived: 0 });
  }

  const ids = stale.map(a => a.plaid_account_id);
  const { error: updateErr } = await supabase
    .from("accounts")
    .update({ archived: true, active: false })
    .in("plaid_account_id", ids);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  return NextResponse.json({
    env,
    archived: stale.length,
    accounts: stale.map(a => ({ name: a.name, institution: a.institution })),
  });
}
