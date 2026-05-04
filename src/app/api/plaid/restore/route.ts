import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Restore archived accounts. Two modes:
 *   POST { all: true }              — un-archive every archived account
 *   POST { plaid_account_id: "..." } — un-archive one specific account
 *
 * Use after the auto-cleanup runs against the wrong env and hides real
 * production accounts (e.g. when Vercel's PLAID_ENV hasn't updated yet).
 */

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
  );
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as { all?: boolean; plaid_account_id?: string };
  const supabase = sb();

  if (body.plaid_account_id) {
    const { error } = await supabase
      .from("accounts")
      .update({ archived: false, active: true })
      .eq("plaid_account_id", body.plaid_account_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ restored: 1 });
  }

  if (body.all) {
    const { data: archived } = await supabase
      .from("accounts")
      .select("plaid_account_id")
      .eq("archived", true);
    const ids = (archived ?? []).map(a => a.plaid_account_id);
    if (ids.length === 0) return NextResponse.json({ restored: 0 });
    const { error } = await supabase
      .from("accounts")
      .update({ archived: false, active: true })
      .in("plaid_account_id", ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ restored: ids.length });
  }

  return NextResponse.json({ error: "Pass { all: true } or { plaid_account_id }" }, { status: 400 });
}
