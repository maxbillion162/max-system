/**
 * Smart habit suggestions for a goal.
 *
 * POST { goalId } → { suggestions: [{ name, category, reason }] }
 *
 * Pulls the goal + Max's durable memories, asks Claude Haiku for 2-3
 * concrete daily habits that would genuinely feed this goal *for him
 * specifically* — not generic advice. The more memories accumulate
 * (from the auto-extract cron), the more personal these get.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
);

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const VALID_CATS = ["Morning", "Health", "Nutrition", "Learning", "Sleep", "Mindset", "Work", "Other"];

const SYSTEM_PROMPT = `You suggest daily habits that feed a specific goal for Max, a 22-year-old starting his career in sales, actively building discipline. Suggestions must be specific to him based on the memory context, not generic self-help.

Rules:
- Suggest exactly 2–3 habits.
- Each habit: daily, concrete, measurable in under 10 minutes (or obvious from the name).
- Name is short (under 40 chars), imperative or noun ("Morning 2-min meditation", "Log every transaction", "Protein 150g").
- Category must be one of: Morning, Health, Nutrition, Learning, Sleep, Mindset, Work, Other.
- Reason: one sentence, under 180 chars, explains why THIS habit for THIS goal.
- Output ONLY a JSON array. No prose, no markdown. Each element: { "name": string, "category": string, "reason": string }.
- If the goal is vague or you can't confidently suggest, return [].

Good example output:
[
  {"name": "Log every transaction", "category": "Work", "reason": "Emergency fund needs visibility — logging daily forces awareness of where $5-$20 leaks."},
  {"name": "No-spend morning", "category": "Morning", "reason": "Cuts ~$8/day coffee + breakfast variance that compounds over 6 months."}
]`;

interface Goal {
  id: string; label: string; description: string | null;
  current: number; target: number; unit: string;
  deadline: string | null; category: string;
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ suggestions: [], reason: "no API key" }, { status: 200 });
  }

  let body: { goalId?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad request" }, { status: 400 }); }
  if (!body.goalId) return NextResponse.json({ error: "goalId required" }, { status: 400 });

  // Load the goal
  const { data: goalRow } = await supabase
    .from("goals")
    .select("id, label, description, current, target, unit, deadline, category")
    .eq("id", body.goalId)
    .single();

  if (!goalRow) return NextResponse.json({ error: "goal not found" }, { status: 404 });
  const goal = goalRow as Goal;

  // Pull memories to personalize
  const { data: memRows } = await supabase
    .from("memories")
    .select("content, tags")
    .order("created_at", { ascending: false })
    .limit(40);
  const memories = ((memRows ?? []) as { content: string; tags: string[] | null }[])
    .map(m => m.content)
    .slice(0, 25);

  // Build the user prompt
  const userPrompt = [
    `GOAL: ${goal.label}`,
    goal.description ? `DESCRIPTION: ${goal.description}` : null,
    `PROGRESS: ${goal.unit === "$" ? `$${Math.round(goal.current).toLocaleString()} / $${Math.round(goal.target).toLocaleString()}` : `${goal.current} / ${goal.target} ${goal.unit}`}`,
    goal.deadline ? `DEADLINE: ${goal.deadline}` : null,
    `CATEGORY: ${goal.category}`,
    "",
    "WHAT WE KNOW ABOUT MAX:",
    memories.length > 0 ? memories.map(m => `- ${m}`).join("\n") : "- (no durable memories yet — suggestions will be more generic)",
  ].filter(Boolean).join("\n");

  let parsed: { name: string; category: string; reason: string }[] = [];
  try {
    const res = await client.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 600,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: "user", content: userPrompt }],
    });
    const block = res.content.find(c => c.type === "text") as Anthropic.TextBlock | undefined;
    const text = (block?.text ?? "[]").trim();
    const match = text.match(/\[[\s\S]*\]/);
    const arr = JSON.parse(match ? match[0] : "[]");
    if (Array.isArray(arr)) {
      parsed = arr
        .filter((x): x is { name: string; category: string; reason: string } =>
          x && typeof x.name === "string" && typeof x.category === "string" && typeof x.reason === "string")
        .map(x => ({
          name:     x.name.slice(0, 60),
          category: VALID_CATS.includes(x.category) ? x.category : "Other",
          reason:   x.reason.slice(0, 240),
        }))
        .slice(0, 3);
    }
  } catch (err) {
    return NextResponse.json({ suggestions: [], error: err instanceof Error ? err.message : "generation failed" }, { status: 200 });
  }

  return NextResponse.json({ suggestions: parsed });
}
