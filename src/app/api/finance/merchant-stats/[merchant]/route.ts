import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Merchant Drilldown — full transaction history + all-time stats for a single
 * merchant. The path slug is the lowercased merchant_normalized value (URL-
 * decoded by Next).
 *
 * GET   → { merchant, total_spent, txn_count, avg, first, last,
 *           current_category, history, monthly_totals }
 * PATCH → body { category }   reassign all txns at this merchant to a new
 *                              budget_category (and also write a merchant_rules row)
 */

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
  );
}

interface Params { params: Promise<{ merchant: string }> }

export async function GET(_req: Request, ctx: Params) {
  const { merchant } = await ctx.params;
  const key = decodeURIComponent(merchant).toLowerCase();
  const supabase = sb();

  /* Match either merchant_normalized or merchant (case-insensitive) */
  const { data, error } = await supabase
    .from("transactions")
    .select("id,plaid_transaction_id,date,amount,merchant,merchant_normalized,category,budget_category,pending,source,account_id")
    .or(`merchant_normalized.ilike.${key},merchant.ilike.${key}`)
    .order("date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const txs = (data ?? []).filter(t => !t.pending);
  if (txs.length === 0) {
    return NextResponse.json({
      merchant: key,
      txn_count: 0,
      total_spent: 0,
      avg: 0,
      history: [],
      monthly_totals: [],
    });
  }

  const positive = txs.filter(t => t.amount > 0);
  const total = positive.reduce((s, t) => s + t.amount, 0);
  const avg   = positive.length > 0 ? total / positive.length : 0;
  const first = txs[txs.length - 1].date;
  const last  = txs[0].date;

  /* Most-frequent category becomes "current" */
  const catCount: Record<string, number> = {};
  for (const t of txs) {
    const c = t.budget_category ?? t.category ?? "Misc";
    catCount[c] = (catCount[c] ?? 0) + 1;
  }
  const currentCategory = Object.entries(catCount).sort(([, a], [, b]) => b - a)[0]?.[0] ?? "Misc";

  /* Monthly totals (last 12 months) */
  const monthlyAgg: Record<string, number> = {};
  for (const t of positive) {
    const ym = t.date.slice(0, 7);
    monthlyAgg[ym] = (monthlyAgg[ym] ?? 0) + t.amount;
  }
  const monthlyTotals = Object.entries(monthlyAgg)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([month, amt]) => ({ month, total: Math.round(amt) }));

  return NextResponse.json({
    merchant:           txs[0].merchant ?? key,
    merchant_pattern:   key,
    txn_count:          txs.length,
    total_spent:        Math.round(total),
    avg:                Math.round(avg * 100) / 100,
    first,
    last,
    current_category:   currentCategory,
    history:            txs.slice(0, 50),
    monthly_totals:     monthlyTotals,
  });
}

export async function PATCH(req: Request, ctx: Params) {
  try {
    const { merchant } = await ctx.params;
    const key = decodeURIComponent(merchant).toLowerCase();
    const body = await req.json() as { category?: string; create_rule?: boolean };
    if (!body.category) return NextResponse.json({ error: "category required" }, { status: 400 });

    const supabase = sb();

    /* Re-categorize every txn at this merchant */
    const { error: updErr } = await supabase
      .from("transactions")
      .update({ budget_category: body.category })
      .or(`merchant_normalized.ilike.${key},merchant.ilike.${key}`);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    /* Write the rule so future syncs auto-apply it */
    if (body.create_rule !== false) {
      await supabase.from("merchant_rules").upsert({
        merchant_pattern: key,
        category:         body.category,
        updated_at:       new Date().toISOString(),
      }, { onConflict: "merchant_pattern" });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
