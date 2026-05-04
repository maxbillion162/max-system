import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildForecast, type ProjectionKnobs } from "@/lib/finance-forecast";
import type { Transaction } from "@/types/finance";

/**
 * Cash Flow Forecast — past 90d actual + future N-day projection.
 *
 * GET  → default 90-day horizon, no knobs (vanilla forecast).
 * POST → caller can supply { knobs, horizon_days } to test scenarios.
 *
 * Math is fully deterministic — Claude is NOT in this loop. Same inputs
 * always produce the same chart so the slider feels physical.
 */

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
  );
}

export async function GET() {
  return runForecast({});
}

export async function POST(req: Request) {
  let body: { knobs?: ProjectionKnobs; horizon_days?: number } = {};
  try { body = await req.json(); } catch { /* empty body ok */ }
  return runForecast(body);
}

async function runForecast(opts: { knobs?: ProjectionKnobs; horizon_days?: number }) {
  try {
    const supabase = sb();
    const horizon  = opts.horizon_days ?? 90;
    const knobs    = opts.knobs ?? {};

    /* 1. Liquid cash — sum of checking + savings + cash account balances */
    const { data: accounts } = await supabase
      .from("accounts")
      .select("account_type, current_balance, archived")
      .eq("archived", false);

    const liquid = (accounts ?? [])
      .filter(a => ["checking", "savings", "cash"].includes(a.account_type ?? ""))
      .reduce((s, a) => s + (a.current_balance ?? 0), 0);

    /* 2. 90 days of transactions */
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
    const { data: txData } = await supabase
      .from("transactions")
      .select("plaid_transaction_id,date,amount,merchant,merchant_normalized,category,budget_category,pending,source")
      .gte("date", ninetyDaysAgo)
      .order("date", { ascending: false });

    const txs: Transaction[] = (txData ?? []) as unknown as Transaction[];

    /* 3. Recurring subscriptions — read from F3 detector table */
    const { data: subs } = await supabase
      .from("recurring_subscriptions")
      .select("display_name,merchant_pattern,monthly_amount");
    const recurring = (subs ?? []).map(s => ({
      merchant:       s.display_name ?? s.merchant_pattern,
      monthly_amount: Number(s.monthly_amount) || 0,
    }));

    /* 4. Goal milestones to mark on the projected line */
    const { data: goals } = await supabase
      .from("goals")
      .select("label,target,current,unit")
      .limit(20);

    const milestones = (goals ?? [])
      .filter(g => (g.unit ?? "").toLowerCase().includes("$") || g.unit === "USD" || /save|emergency|fund/i.test(g.label))
      .map(g => ({ label: g.label as string, target: Number(g.target), field: "cash" as const }));

    const result = buildForecast({
      current_cash:    liquid,
      transactions:    txs,
      recurring,
      knobs,
      horizon_days:    horizon,
      goal_milestones: milestones,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("forecast error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
