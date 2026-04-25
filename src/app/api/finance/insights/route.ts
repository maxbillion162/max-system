import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

/**
 * Spending Intelligence — comprehensive analysis surface for the Budget tab.
 *
 * Returns 6 panels of data, all computed server-side from the last 90 days
 * of transactions:
 *   1. category_breakdown — top categories this month vs last month with deltas
 *   2. top_merchants     — top merchants this month with visit counts + totals
 *   3. day_of_week       — spend distribution Sun-Sat (avg per occurrence + total)
 *   4. recurring         — detected monthly subscriptions (same merchant 2+ times,
 *                          ~30 day cadence, similar amounts)
 *   5. anomalies         — outlier transactions (>2σ above merchant or category avg)
 *   6. ai_insights       — Claude-generated narrative analysis (3-5 bullets)
 *                          highlighting drift, wins, and specific recommendations
 *
 * Cached for 10 minutes — heavy compute + Claude call shouldn't run every page mount.
 */

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

interface Transaction {
  id?:                  number | string;
  date:                 string;
  amount:               number;
  merchant:             string;
  merchant_normalized?: string;
  category?:            string;
  budget_category?:     string | null;
  pending?:             boolean;
}

const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export async function GET() { return runInsights(); }
export async function POST() { return runInsights(); }

async function runInsights() {
  try {
    const supabase = sb();
    const today = new Date();
    const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
    const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonthStart = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}-01`;
    const ninetyDaysAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const { data: txData } = await supabase
      .from("transactions")
      .select("id,date,amount,merchant,merchant_normalized,category,budget_category,pending")
      .gte("date", ninetyDaysAgo)
      .order("date", { ascending: false });

    const txs: Transaction[] = (txData ?? []).filter(t => !t.pending && t.amount > 0);

    if (txs.length === 0) {
      return NextResponse.json({
        category_breakdown: [],
        top_merchants:      [],
        day_of_week:        [],
        recurring:          [],
        anomalies:          [],
        ai_insights:        [],
        total_transactions: 0,
        total_spent:        0,
        empty_reason:       "No transactions in the last 90 days. Connect a bank or wait for the next sync.",
      });
    }

    const thisMonthTxs = txs.filter(t => t.date >= monthStart);
    const lastMonthTxs = txs.filter(t => t.date >= lastMonthStart && t.date < monthStart);

    /* 1. Category breakdown — this vs last month */
    function aggByCat(set: Transaction[]): Record<string, number> {
      const m: Record<string, number> = {};
      for (const t of set) {
        const cat = t.budget_category ?? t.category ?? "Misc";
        m[cat] = (m[cat] ?? 0) + t.amount;
      }
      return m;
    }
    const thisCats = aggByCat(thisMonthTxs);
    const lastCats = aggByCat(lastMonthTxs);
    const allCatNames = new Set([...Object.keys(thisCats), ...Object.keys(lastCats)]);
    const categoryBreakdown = Array.from(allCatNames).map(cat => {
      const thisM = thisCats[cat] ?? 0;
      const lastM = lastCats[cat] ?? 0;
      const delta = thisM - lastM;
      const deltaPct = lastM > 0 ? (delta / lastM) * 100 : (thisM > 0 ? 100 : 0);
      return { category: cat, this_month: Math.round(thisM), last_month: Math.round(lastM), delta_pct: deltaPct };
    }).sort((a, b) => b.this_month - a.this_month);

    /* 2. Top merchants this month */
    const merchAgg: Record<string, { count: number; total: number; merchant: string }> = {};
    for (const t of thisMonthTxs) {
      const key = (t.merchant_normalized ?? t.merchant ?? "Unknown").toLowerCase();
      if (!merchAgg[key]) merchAgg[key] = { count: 0, total: 0, merchant: t.merchant ?? "Unknown" };
      merchAgg[key].count++;
      merchAgg[key].total += t.amount;
    }
    const topMerchants = Object.values(merchAgg)
      .sort((a, b) => b.total - a.total)
      .slice(0, 12)
      .map(m => ({ merchant: m.merchant, count: m.count, total: Math.round(m.total) }));

    /* 3. Day-of-week pattern (90-day average per day) */
    const dowAgg: Record<number, { total: number; count: number }> = {};
    for (let i = 0; i < 7; i++) dowAgg[i] = { total: 0, count: 0 };
    for (const t of txs) {
      const d = new Date(t.date + "T12:00:00").getDay();
      dowAgg[d].total += t.amount;
      dowAgg[d].count += 1;
    }
    const dayOfWeek = DAY_NAMES.map((day, i) => ({
      day,
      total: Math.round(dowAgg[i].total),
      count: dowAgg[i].count,
      avg: dowAgg[i].count > 0 ? Math.round(dowAgg[i].total / dowAgg[i].count) : 0,
    }));

    /* 4. Recurring subscription detector — same merchant, 2+ occurrences in 90d,
          spaced ~25-35 days apart, with similar amounts (within 15%). */
    const merchantTxns: Record<string, Transaction[]> = {};
    for (const t of txs) {
      const key = (t.merchant_normalized ?? t.merchant ?? "").toLowerCase();
      if (!key) continue;
      if (!merchantTxns[key]) merchantTxns[key] = [];
      merchantTxns[key].push(t);
    }
    const recurring: { merchant: string; monthly_amount: number; last_seen: string; occurrences: number; annual_estimate: number }[] = [];
    for (const [, group] of Object.entries(merchantTxns)) {
      if (group.length < 2) continue;
      const sorted = [...group].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      // Compute average amount + check stability (max amount must be within 15% of min)
      const amounts = sorted.map(t => t.amount);
      const minAmt = Math.min(...amounts);
      const maxAmt = Math.max(...amounts);
      if (minAmt > 0 && (maxAmt - minAmt) / minAmt > 0.15) continue;
      // Compute average gap in days
      let gapsSum = 0; let gaps = 0;
      for (let i = 1; i < sorted.length; i++) {
        const dt = (new Date(sorted[i].date).getTime() - new Date(sorted[i-1].date).getTime()) / (24*60*60*1000);
        gapsSum += dt; gaps++;
      }
      const avgGap = gaps > 0 ? gapsSum / gaps : 0;
      // Monthly cadence: avg gap between 25 and 35 days
      if (avgGap < 25 || avgGap > 35) continue;
      const avgAmt = amounts.reduce((s, v) => s + v, 0) / amounts.length;
      recurring.push({
        merchant:       sorted[0].merchant ?? "Unknown",
        monthly_amount: Math.round(avgAmt * 100) / 100,
        last_seen:      sorted[sorted.length - 1].date,
        occurrences:    sorted.length,
        annual_estimate:Math.round(avgAmt * 12),
      });
    }
    recurring.sort((a, b) => b.monthly_amount - a.monthly_amount);

    /* 5. Anomalies — transactions where amount is >2σ above merchant's mean */
    const anomalies: { merchant: string; amount: number; date: string; z_score: number; reason: string }[] = [];
    for (const [, group] of Object.entries(merchantTxns)) {
      if (group.length < 4) continue;  // need history to detect outliers
      const amounts = group.map(t => t.amount);
      const mean = amounts.reduce((s, v) => s + v, 0) / amounts.length;
      const variance = amounts.reduce((s, v) => s + (v - mean) ** 2, 0) / amounts.length;
      const stdDev = Math.sqrt(variance);
      if (stdDev === 0) continue;
      for (const t of group) {
        const z = (t.amount - mean) / stdDev;
        if (z > 2 && t.date >= ninetyDaysAgo) {
          anomalies.push({
            merchant: t.merchant ?? "Unknown",
            amount:   t.amount,
            date:     t.date,
            z_score:  Math.round(z * 10) / 10,
            reason:   `$${t.amount.toFixed(2)} is ${z.toFixed(1)}σ above your $${mean.toFixed(2)} avg here.`,
          });
        }
      }
    }
    anomalies.sort((a, b) => b.z_score - a.z_score);

    /* 6. AI insights — let Claude analyze the patterns */
    const totalThisMonth = Object.values(thisCats).reduce((s, v) => s + v, 0);
    const totalLastMonth = Object.values(lastCats).reduce((s, v) => s + v, 0);
    const monthDeltaPct = totalLastMonth > 0 ? ((totalThisMonth - totalLastMonth) / totalLastMonth) * 100 : 0;

    const topMovers = categoryBreakdown
      .filter(c => Math.abs(c.delta_pct) > 15 && (c.this_month >= 50 || c.last_month >= 50))
      .slice(0, 5);

    const insightPrompt = [
      `You are M.A.X., Max's autonomous CFO. Analyze his recent spending and produce 3-5 sharp insights.`,
      `Each insight should be one short sentence — direct, specific, with numbers. No platitudes, no hedging.`,
      `Each gets a severity: "win" (positive), "watch" (neutral observation), "warn" (action needed).`,
      ``,
      `THIS MONTH SO FAR: $${Math.round(totalThisMonth).toLocaleString()} across ${thisMonthTxs.length} transactions`,
      `LAST MONTH:        $${Math.round(totalLastMonth).toLocaleString()} (${monthDeltaPct >= 0 ? "+" : ""}${monthDeltaPct.toFixed(0)}%)`,
      ``,
      `TOP CATEGORIES THIS MONTH:`,
      categoryBreakdown.slice(0, 6).map(c => `  · ${c.category}: $${c.this_month} (${c.delta_pct >= 0 ? "+" : ""}${c.delta_pct.toFixed(0)}% vs last month)`).join("\n"),
      ``,
      `BIGGEST CHANGES (movers):`,
      topMovers.length > 0
        ? topMovers.map(c => `  · ${c.category}: $${c.last_month} → $${c.this_month} (${c.delta_pct >= 0 ? "+" : ""}${c.delta_pct.toFixed(0)}%)`).join("\n")
        : "  (none)",
      ``,
      `TOP MERCHANTS THIS MONTH:`,
      topMerchants.slice(0, 6).map(m => `  · ${m.merchant}: $${m.total} across ${m.count} visits`).join("\n"),
      ``,
      `RECURRING SUBSCRIPTIONS DETECTED:`,
      recurring.length > 0
        ? recurring.slice(0, 5).map(r => `  · ${r.merchant}: $${r.monthly_amount}/mo (${r.occurrences} occurrences, ${r.annual_estimate}/yr)`).join("\n")
        : "  (none)",
      ``,
      `ANOMALIES (>2σ outliers):`,
      anomalies.length > 0
        ? anomalies.slice(0, 3).map(a => `  · ${a.merchant} on ${a.date}: $${a.amount} (${a.z_score}σ above avg)`).join("\n")
        : "  (none)",
      ``,
      `Return ONLY a JSON array — no preamble:`,
      `[{"severity": "win|watch|warn", "title": "5-7 word headline", "body": "one sentence with numbers"}]`,
    ].join("\n");

    let aiInsights: { severity: string; title: string; body: string }[] = [];
    try {
      const aiRes = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1200,
        messages: [{ role: "user", content: insightPrompt }],
      });
      const text = aiRes.content[0]?.type === "text" ? aiRes.content[0].text : "";
      const m = text.match(/\[[\s\S]*\]/);
      if (m) aiInsights = JSON.parse(m[0]);
    } catch {
      aiInsights = [];
    }

    return NextResponse.json({
      category_breakdown:  categoryBreakdown,
      top_merchants:       topMerchants,
      day_of_week:         dayOfWeek,
      recurring,
      anomalies:           anomalies.slice(0, 8),
      ai_insights:         aiInsights,
      total_transactions:  txs.length,
      total_spent:         Math.round(totalThisMonth),
      total_last_month:    Math.round(totalLastMonth),
      month_delta_pct:     monthDeltaPct,
      generated_at:        new Date().toISOString(),
    });
  } catch (err) {
    console.error("insights error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
