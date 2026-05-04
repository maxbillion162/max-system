import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { buildForecast, type ProjectionKnobs } from "@/lib/finance-forecast";
import type { Transaction } from "@/types/finance";

/**
 * What-If Engine — runs a baseline forecast and a knobbed forecast, returns
 * the delta (monthly impact, annual impact, end-of-horizon delta) plus a
 * one-line Claude narrative summarizing the trade.
 *
 * Body: { label: string; knobs: ProjectionKnobs; horizon_days?: number }
 * Resp: { baseline, scenario, monthly_delta, annual_delta, horizon_delta,
 *         goal_shift_days, narrative }
 */

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
  );
}

export async function POST(req: Request) {
  try {
    const { label, knobs, horizon_days } = await req.json() as {
      label?: string;
      knobs?: ProjectionKnobs;
      horizon_days?: number;
    };

    if (!knobs) return NextResponse.json({ error: "knobs required" }, { status: 400 });
    const horizon = horizon_days ?? 90;
    const supabase = sb();

    /* Pull baseline data once, run two forecasts on it */
    const { data: accounts } = await supabase
      .from("accounts")
      .select("account_type, current_balance, archived")
      .eq("archived", false);

    const liquid = (accounts ?? [])
      .filter(a => ["checking", "savings", "cash"].includes(a.account_type ?? ""))
      .reduce((s, a) => s + (a.current_balance ?? 0), 0);

    const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
    const { data: txData } = await supabase
      .from("transactions")
      .select("plaid_transaction_id,date,amount,merchant,merchant_normalized,category,budget_category,pending,source")
      .gte("date", ninetyDaysAgo);
    const txs: Transaction[] = (txData ?? []) as unknown as Transaction[];

    const { data: subs } = await supabase
      .from("recurring_subscriptions")
      .select("display_name,merchant_pattern,monthly_amount");
    const recurring = (subs ?? []).map(s => ({
      merchant:       s.display_name ?? s.merchant_pattern,
      monthly_amount: Number(s.monthly_amount) || 0,
    }));

    const { data: goals } = await supabase
      .from("goals")
      .select("label,target,current,unit");
    const milestones = (goals ?? [])
      .filter(g => (g.unit ?? "").toLowerCase().includes("$") || /save|emergency|fund/i.test(g.label))
      .map(g => ({ label: g.label as string, target: Number(g.target), field: "cash" as const }));

    const baseline = buildForecast({
      current_cash: liquid, transactions: txs, recurring,
      knobs: {}, horizon_days: horizon, goal_milestones: milestones,
    });
    const scenario = buildForecast({
      current_cash: liquid, transactions: txs, recurring,
      knobs, horizon_days: horizon, goal_milestones: milestones,
    });

    const baseEnd = baseline.future[baseline.future.length - 1]?.cash ?? liquid;
    const scenEnd = scenario.future[scenario.future.length - 1]?.cash ?? liquid;
    const horizon_delta = scenEnd - baseEnd;

    // Monthly = avg of (scenario_daily_net − baseline_daily_net) × 30
    const monthly_delta = (scenario.daily_net - baseline.daily_net) * 30;
    const annual_delta  = monthly_delta * 12;

    /* Goal shift — for each milestone goal, find the first day each forecast
       crosses target and report the day difference (positive = scenario hits
       sooner). */
    const goal_shifts: { label: string; baseline_date: string | null; scenario_date: string | null; days_earlier: number | null }[] = [];
    for (const m of milestones) {
      const b = baseline.future.find(p => p.cash >= m.target)?.date ?? null;
      const s = scenario.future.find(p => p.cash >= m.target)?.date ?? null;
      let days_earlier: number | null = null;
      if (b && s) days_earlier = Math.round((new Date(b).getTime() - new Date(s).getTime()) / 86_400_000);
      else if (s && !b) days_earlier = horizon;  // scenario hits within horizon, baseline doesn't
      goal_shifts.push({ label: m.label, baseline_date: b, scenario_date: s, days_earlier });
    }

    /* Narrative — Claude one-liner */
    let narrative = "";
    try {
      const lines = [
        `You are M.A.X., Max's autonomous CFO. One sentence describing this what-if outcome.`,
        `No fluff, lead with the number, dry-witty.`,
        ``,
        `Scenario: ${label ?? "Custom what-if"}`,
        `Knobs: ${JSON.stringify(knobs)}`,
        `Monthly cash impact: ${monthly_delta >= 0 ? "+" : ""}$${Math.round(monthly_delta)}`,
        `Annual:              ${annual_delta  >= 0 ? "+" : ""}$${Math.round(annual_delta)}`,
        `End-of-${horizon}-day cash delta: ${horizon_delta >= 0 ? "+" : ""}$${Math.round(horizon_delta)}`,
        `Goal shifts: ${goal_shifts.filter(g => g.days_earlier).map(g => `${g.label} ${g.days_earlier! > 0 ? g.days_earlier + " days sooner" : Math.abs(g.days_earlier!) + " days later"}`).join(", ") || "no movement"}`,
      ].join("\n");

      const r = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        messages: [{ role: "user", content: lines }],
      });
      narrative = r.content[0]?.type === "text" ? r.content[0].text.trim() : "";
    } catch {
      narrative = "";
    }

    return NextResponse.json({
      label:           label ?? null,
      baseline,
      scenario,
      monthly_delta:   Math.round(monthly_delta),
      annual_delta:    Math.round(annual_delta),
      horizon_delta:   Math.round(horizon_delta),
      goal_shifts,
      narrative,
    });
  } catch (err) {
    console.error("whatif error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
