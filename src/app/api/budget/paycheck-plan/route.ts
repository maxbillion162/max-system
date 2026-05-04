import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

/**
 * Paycheck Planner.
 *
 * Given a paycheck amount (and optional date), proposes how Max should
 * distribute it across upcoming bills, savings goals, and discretionary.
 *
 * Input:  { amount: number, source?: string, date?: string }
 * Output: { plan: { allocations: [...], summary, total }, paycheck }
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
    const { amount, source, date } = await req.json() as { amount?: number; source?: string; date?: string };
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "amount required" }, { status: 400 });
    }

    const supabase = sb();
    const today = new Date();
    const periodStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
    const dayOfMonth = today.getDate();

    const [billsRes, allocRes, goalsRes, wealthRes] = await Promise.all([
      supabase.from("bills").select("*"),
      supabase.from("budget_allocations").select("category,budgeted").eq("period_start", periodStart),
      supabase.from("goals").select("id,label,current,target,deadline").limit(10),
      supabase.from("wealth").select("savings,ira").eq("id", "max").single(),
    ]);

    const bills = (billsRes.data ?? []) as { name: string; amt: number; due_day: number; due?: number }[];
    const upcomingBills = bills
      .map(b => {
        const dueDay = b.due_day ?? b.due ?? 1;
        const daysOut = dueDay >= dayOfMonth ? dueDay - dayOfMonth : (31 - dayOfMonth + dueDay);
        return { name: b.name, amount: b.amt, due_day: dueDay, days_out: daysOut };
      })
      .filter(b => b.days_out <= 30)
      .sort((a, b) => a.days_out - b.days_out);

    const allocs = (allocRes.data ?? []) as { category: string; budgeted: number }[];
    const goals = (goalsRes.data ?? []) as { id: string; label: string; current: number; target: number; deadline: string | null }[];
    const wealth = wealthRes.data as { savings: number; ira: number } | null;

    const prompt = [
      `You are M.A.X. proposing how Max should distribute a paycheck that just landed.`,
      ``,
      `PAYCHECK: $${amount} ${source ? `(${source})` : ""} ${date ? `on ${date}` : ""}`,
      `TODAY: ${today.toISOString().slice(0, 10)} (day ${dayOfMonth} of the month)`,
      ``,
      `UPCOMING BILLS (next 30 days):`,
      upcomingBills.length > 0
        ? upcomingBills.map(b => `  · ${b.name}: $${b.amount} (day ${b.due_day}, in ${b.days_out} days)`).join("\n")
        : "  (none scheduled)",
      ``,
      `CURRENT MONTH BUDGET ALLOCATIONS:`,
      allocs.length > 0
        ? allocs.map(a => `  · ${a.category}: $${a.budgeted}`).join("\n")
        : "  (no budget set)",
      ``,
      `ACTIVE GOALS:`,
      goals.length > 0
        ? goals.map(g => `  · ${g.label}: $${g.current}/$${g.target}${g.deadline ? ` by ${g.deadline}` : ""}`).join("\n")
        : "  (none)",
      ``,
      `CURRENT SAVINGS: $${wealth?.savings ?? 0}`,
      `EMERGENCY FUND TARGET: $10,000 (per Max's plan)`,
      ``,
      `YOUR JOB:`,
      `Propose a complete distribution of this paycheck across:`,
      `  · Bills due in the next 30 days that should be set aside now`,
      `  · Savings goals (especially Emergency Fund — top priority until $10K)`,
      `  · Roth IRA contribution if budget allows`,
      `  · Discretionary remainder for the period`,
      ``,
      `Be specific with dollar amounts. Sum must equal $${amount}.`,
      `Lead with the highest-priority bucket, end with discretionary.`,
      ``,
      `Return ONLY a JSON object:`,
      `{`,
      `  "summary": "1-2 sentence framing of the trade-off",`,
      `  "allocations": [`,
      `    { "bucket": "Emergency Fund", "amount": 400, "kind": "savings_goal", "reasoning": "...", "goal_id": "uuid or null" }`,
      `  ]`,
      `}`,
      ``,
      `Valid kinds: bill, savings_goal, ira_contribution, budget_category, discretionary`,
    ].join("\n");

    const aiRes = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1800,
      messages: [{ role: "user", content: prompt }],
    });

    const text = aiRes.content[0]?.type === "text" ? aiRes.content[0].text : "";
    let plan: { summary: string; allocations: { bucket: string; amount: number; kind: string; reasoning: string; goal_id?: string | null }[] } | null = null;
    try {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) plan = JSON.parse(m[0]);
    } catch {
      plan = null;
    }

    if (!plan) {
      return NextResponse.json({ error: "M.A.X. couldn't form a coherent plan" }, { status: 500 });
    }

    const total = plan.allocations.reduce((s, a) => s + a.amount, 0);

    return NextResponse.json({
      plan,
      paycheck: { amount, source: source ?? null, date: date ?? null },
      total,
      remainder: amount - total,
    });
  } catch (err) {
    console.error("paycheck-plan error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
