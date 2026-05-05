import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { decrypt } from "@/lib/encryption";

/**
 * Plaid Diagnostics — server-side report of what's configured and what's
 * actually in the DB. Used to debug "my real bank isn't showing up" issues.
 *
 * Returns:
 *   - server_env_var: what Vercel/local has set for PLAID_ENV
 *   - has_secret: whether PLAID_SECRET is populated
 *   - accounts: every row in the accounts table with redacted token + env tag
 *
 * No access tokens are returned — only their env prefix (sandbox / production).
 */

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
  );
}

function tokenEnvPrefix(token: string | null): string {
  if (!token) return "missing";
  const decrypted = decrypt(token) ?? "";
  const m = decrypted.match(/^access-(sandbox|production|development)-/);
  return m ? m[1] : "unknown";
}

export async function GET() {
  const supabase = sb();
  const { data: accounts, error } = await supabase
    .from("accounts")
    .select("plaid_account_id,name,institution,mask,type,subtype,account_type,current_balance,available_balance,last_synced,active,archived,plaid_access_token,created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const env = process.env.PLAID_ENV ?? "unset";
  const hasSecret = !!process.env.PLAID_SECRET;
  const hasClientId = !!process.env.PLAID_CLIENT_ID;

  const summary = {
    server_plaid_env:    env,
    has_plaid_secret:    hasSecret,
    has_plaid_client_id: hasClientId,
    total_accounts:      accounts?.length ?? 0,
    visible_accounts:    accounts?.filter(a => !a.archived && a.active).length ?? 0,
    archived_accounts:   accounts?.filter(a => a.archived).length ?? 0,
    accounts_by_env: {
      sandbox:    accounts?.filter(a => tokenEnvPrefix(a.plaid_access_token) === "sandbox").length ?? 0,
      production: accounts?.filter(a => tokenEnvPrefix(a.plaid_access_token) === "production").length ?? 0,
      development:accounts?.filter(a => tokenEnvPrefix(a.plaid_access_token) === "development").length ?? 0,
      unknown:    accounts?.filter(a => tokenEnvPrefix(a.plaid_access_token) === "unknown" || tokenEnvPrefix(a.plaid_access_token) === "missing").length ?? 0,
    },
  };

  const accountList = (accounts ?? []).map(a => ({
    plaid_account_id:  a.plaid_account_id,
    name:              a.name,
    institution:       a.institution,
    mask:              a.mask,
    type:              a.type,
    subtype:           a.subtype,
    account_type:      a.account_type,
    current_balance:   a.current_balance,
    available_balance: a.available_balance,
    last_synced:       a.last_synced,
    active:            a.active,
    archived:          a.archived,
    token_env:         tokenEnvPrefix(a.plaid_access_token),
    created_at:        a.created_at,
  }));

  /* Diagnose the most likely issues */
  const issues: string[] = [];
  if (!hasSecret || !hasClientId) {
    issues.push("Plaid credentials missing on this deployment. Check PLAID_CLIENT_ID and PLAID_SECRET in Vercel → Settings → Environment Variables.");
  }
  if (env === "unset") {
    issues.push("PLAID_ENV is not set. Add PLAID_ENV=production to Vercel env vars and redeploy.");
  }
  if (env !== "production" && summary.accounts_by_env.production > 0) {
    issues.push(`PLAID_ENV is "${env}" but you have ${summary.accounts_by_env.production} production-tagged accounts in the DB. Vercel still thinks you're in sandbox.`);
  }
  if (env === "production" && summary.accounts_by_env.production === 0 && summary.accounts_by_env.sandbox > 0) {
    issues.push("PLAID_ENV is production but no production accounts exist yet — only sandbox accounts. You need to click 'Connect Bank' in production mode to add a real one.");
  }
  if (env === "production" && summary.archived_accounts > 0) {
    issues.push(`${summary.archived_accounts} accounts are archived. If they include your real bank, restore via /api/plaid/restore.`);
  }

  return NextResponse.json({ summary, accounts: accountList, issues });
}
