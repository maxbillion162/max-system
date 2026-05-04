import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

/**
 * Goal-Driven Allocator.
 *
 * Input:  { goal_id: string }  — one of Max's active goals
 * Output: { plan: { goal: {...}, monthly_savings_required, distribution: [{category, budgeted, classification, reasoning}], unallocated, deadline_feasible } }
 *
 * The principle: budgets work backwards from goals, not the other way around.
 * Pick the primary goal → compute the monthly savings rate it implies →
 * subtract from income → distribute the remainder across categories using
 * Max's actual historic spending pattern as the baseline, with M.A.X.
 * adding judgment about needs vs wants.
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
    const { goal_id } = await req.json() as { goal_id?: string };
    if (!goal_id) return NextResponse.json({ error: "goal_id required" }, { status: 400 });

    const supabase = sb();
    const today = new Date();
    const ninetyDaysAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const periodStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;

    const [goalRes, txRes, allocRes, incomeRes, classRes] = await Promise.all([
      supabase.from("goals").select("*").eq("id", goal_id).single(),
      supabase.from("transactions").select("amount,date,budget_category,category,pending").gte("date", ninetyDaysAgo),
      supabase.from("budget_allocations").select("category,budgeted").eq("period_start", periodStart),
      supabase.from("settings").select("value").eq("key", "monthly_income").single(),
      supabase.from("category_classification").select("category,type"),
    ]);

    const goal = goalRes.data as { id: string; label: string; current: number; target: number; unit: string; deadline: string | null; category: string | null } | null;
    if (!goal) return NextResponse.json({ error: "goal not found" }, { status: 404 });

    const income = Number(incomeRes.data?.value ?? 0);
    if (!income || income <= 0) {
      return NextResponse.json({ error: "monthly_income not set yet — set it on the Budget tab first" }, { status: 400 });
    }

    /* Compute monthly savings rate required to hit the goal by deadline */
    const remaining = Math.max(0, goal.target - goal.current);
    let monthsToGo = 12;
    let deadlineFeasible = true;
    if (goal.deadline) {
      const deadlineDate = new Date(goal.deadline);
      const ms = deadlineDate.getTime() - today.getTime();
      monthsToGo = Math.max(1, Math.round(ms / (30 * 24 * 60 * 60 * 1000)));
      if (ms < 0) deadlineFeasible = false;
    }
    const monthlyRequired = remaining / monthsToGo;

    /* Build historic spending baseline by category (90 days → monthly avg) */
    const byCat: Record<string, number> = {};
    const txs = (txRes.data ?? []).filter(t => !t.pending && t.amount > 0);
    for (const t of txs) {
      const cat = t.budget_category ?? t.category ?? "Misc";
      byCat[cat] = (byCat[cat] ?? 0) + t.amount;
    }
    const monthlyAvg: Record<string, number> = {};
    for (const [cat, total] of Object.entries(byCat)) monthlyAvg[cat] = total / 3;

    const classifications = (classRes.data ?? []) as { category: string; type: "need"|"want"|"savings"|"investment" }[];
    const classMap = new Map(classifications.map(c => [c.category, c.type]));

    const allocs = (allocRes.data ?? []) as { category: string; budgeted: number }[];
    const currentAllocByCat = new Map(allocs.map(a => [a.category, a.budgeted]));

    /* Prepare data for Claude — let it propose the distribution with judgment */
    const prompt = [
      `You are M.A.X. building Max's budget BACKWARDS from his goal.`,
      ``,
      `THE GOAL:`,
      `  ${goal.label}: $${goal.current} → $${goal.target} (${goal.unit ?? "$"}) by ${goal.deadline ?? "no deadline"}`,
      `  Monthly contribution required to hit it: $${Math.round(monthlyRequired)}/mo over ${monthsToGo} months`,
      ``,
      `MAX'S MONTHLY INCOME: $${income}`,
      `LEAVES FOR EVERYTHING ELSE: $${Math.round(income - monthlyRequired)}/mo`,
      ``,
      `MAX'S HISTORIC MONTHLY SPEND BY CATEGORY (90-day average):`,
      Object.entries(monthlyAvg)
        .filter(([, v]) => v > 5)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([cat, avg]) => `  ${cat}: $${Math.round(avg)} (current target: ${currentAllocByCat.get(cat) ? "$" + currentAllocByCat.get(cat) : "none"}, type: ${classMap.get(cat) ?? "want"})`)
        .join("\n"),
      ``,
      `YOUR JOB:`,
      `Propose a monthly budget that fully covers the goal contribution and stays within income.`,
      `Use historic spend as a baseline but trim wants where needed to make the goal feasible.`,
      `Don't trim needs (rent, groceries, utilities, insurance, etc.) below their historic average — they're non-negotiable.`,
      `Add a "${goal.label} (savings)" category for the goal contribution itself.`,
      ``,
      `Return ONLY a JSON object, no preamble:`,
      `{`,
      `  "monthly_savings_required": ${Math.round(monthlyRequired)},`,
      `  "deadline_feasible": ${deadlineFeasible},`,
      `  "summary": "2-sentence narrative that frames the trade-off (what got trimmed, what was preserved, whether the goal is realistic)",`,
      `  "distribution": [`,
      `    { "category": "...", "budgeted": 123, "classification": "need|want|savings|investment", "reasoning": "one sentence why this number" }`,
      `  ]`,
      `}`,
    ].join("\n");

    const aiRes = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2200,
      messages: [{ role: "user", content: prompt }],
    });

    const text = aiRes.content[0]?.type === "text" ? aiRes.content[0].text : "";
    let plan: { monthly_savings_required: number; deadline_feasible: boolean; summary: string; distribution: { category: string; budgeted: number; classification: string; reasoning: string }[] } | null = null;
    try {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) plan = JSON.parse(m[0]);
    } catch {
      plan = null;
    }

    if (!plan) {
      return NextResponse.json({ error: "M.A.X. couldn't form a coherent plan — try again or set up budget manually" }, { status: 500 });
    }

    const totalBudgeted = plan.distribution.reduce((s, d) => s + d.budgeted, 0);
    const unallocated = income - totalBudgeted;

    return NextResponse.json({
      plan: {
        goal: { id: goal.id, label: goal.label, current: goal.current, target: goal.target, deadline: goal.deadline },
        income,
        monthly_savings_required: plan.monthly_savings_required,
        deadline_feasible: plan.deadline_feasible,
        summary: plan.summary,
        distribution: plan.distribution,
        total_budgeted: totalBudgeted,
        unallocated,
      },
    });
  } catch (err) {
    console.error("suggest-allocation error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
