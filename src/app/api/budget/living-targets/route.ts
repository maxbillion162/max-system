import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

/**
 * Living Targets — propose realistic, slightly leaner budget targets per category
 * based on Max's actual last-90-days spend. The principle: leaner-than-actual
 * by 10-15% drives incremental wins. Aspirational targets that he never hits
 * train him to ignore his own budget.
 *
 * Output shape:
 *   [{ category, current_target, suggested_target, reasoning }]
 *
 * The page renders these in a modal; Max accepts/edits/rejects per category.
 */

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

interface Suggestion {
  category:         string;
  current_target:   number;
  suggested_target: number;
  monthly_avg:      number;
  reasoning:        string;
}

export async function POST() {
  try {
    const supabase = sb();
    const today = new Date();
    const ninetyDaysAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const periodStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;

    const [txRes, allocRes] = await Promise.all([
      supabase
        .from("transactions")
        .select("amount,date,budget_category,category,pending")
        .gte("date", ninetyDaysAgo)
        .order("date"),
      supabase
        .from("budget_allocations")
        .select("category,budgeted")
        .eq("period_start", periodStart),
    ]);

    const txs = (txRes.data ?? []).filter(t => !t.pending && t.amount > 0);
    const allocs = (allocRes.data ?? []) as { category: string; budgeted: number }[];

    if (txs.length < 20) {
      return NextResponse.json({
        suggestions: [],
        reason: "Not enough transaction history yet (need at least 20 transactions in the last 90 days).",
      });
    }

    /* Aggregate per-category spend over 90 days, divide by 3 for monthly avg */
    const byCategory: Record<string, number> = {};
    for (const t of txs) {
      const cat = t.budget_category ?? t.category ?? "Misc";
      byCategory[cat] = (byCategory[cat] ?? 0) + t.amount;
    }

    const monthlyAvg: Record<string, number> = {};
    for (const [cat, total] of Object.entries(byCategory)) {
      monthlyAvg[cat] = total / 3;
    }

    /* Build deterministic suggestions: 10-15% under historic monthly average,
       capped to non-negative. We then ask Claude to add reasoning per category
       — the math is fixed, the narrative is what we use the model for. */
    const allocByCategory: Record<string, number> = {};
    for (const a of allocs) allocByCategory[a.category] = a.budgeted;

    const baseSuggestions: Omit<Suggestion, "reasoning">[] = Object.entries(monthlyAvg)
      .filter(([, avg]) => avg >= 10)  // ignore rounding noise
      .map(([category, avg]) => {
        // 10% leaner if you're already close to budget; 15% if heavily over
        const current = allocByCategory[category] ?? 0;
        const overspend = current > 0 ? Math.max(0, avg - current) / current : 0;
        const trim = overspend > 0.2 ? 0.15 : 0.10;
        return {
          category,
          current_target:   current,
          suggested_target: Math.max(10, Math.round(avg * (1 - trim))),
          monthly_avg:      Math.round(avg),
        };
      })
      .sort((a, b) => b.monthly_avg - a.monthly_avg)
      .slice(0, 12);

    if (baseSuggestions.length === 0) {
      return NextResponse.json({ suggestions: [], reason: "No categories have enough volume to suggest targets." });
    }

    /* Ask Claude for one-line reasoning per category */
    const reasoningPrompt = [
      `You are M.A.X. proposing slightly-leaner budget targets to Max based on his actual recent spending.`,
      `Below is his monthly average per category (over 90 days) and a proposed leaner target.`,
      `Write a one-sentence reason per category that sounds like Max's smart financial assistant — direct, specific, no fluff.`,
      `Mention the actual numbers. Frame each as a small concrete win. NO platitudes ("you've got this"), NO hedging ("you might want to").`,
      ``,
      `Return ONLY a JSON array, no preamble: [{"category":"...","reasoning":"..."}, ...]`,
      ``,
      `Categories:`,
      JSON.stringify(baseSuggestions.map(s => ({
        category:         s.category,
        monthly_avg:      s.monthly_avg,
        current_target:   s.current_target || null,
        suggested_target: s.suggested_target,
      })), null, 2),
    ].join("\n");

    const aiRes = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      messages: [{ role: "user", content: reasoningPrompt }],
    });

    const text = aiRes.content[0]?.type === "text" ? aiRes.content[0].text : "";
    let parsed: { category: string; reasoning: string }[] = [];
    try {
      const m = text.match(/\[[\s\S]*\]/);
      if (m) parsed = JSON.parse(m[0]);
    } catch {
      parsed = [];
    }

    const reasoningByCategory = new Map(parsed.map(p => [p.category, p.reasoning]));

    const suggestions: Suggestion[] = baseSuggestions.map(s => ({
      ...s,
      reasoning: reasoningByCategory.get(s.category)
        ?? `90-day monthly avg is $${s.monthly_avg}. Trimming to $${s.suggested_target} keeps room without forcing it.`,
    }));

    return NextResponse.json({ suggestions, period_days: 90, transaction_count: txs.length });
  } catch (err) {
    console.error("living-targets error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
