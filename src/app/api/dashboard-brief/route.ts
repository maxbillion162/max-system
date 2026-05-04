import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/supabase";
const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CACHE_MS = 10 * 60 * 1000;

function periodStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

async function generateBrief() {
  const ps = periodStart();

  const [habitsRes, tasksRes, wealthRes, allocRes, txRes] = await Promise.allSettled([
    supabase.from("habits").select("name,completed"),
    supabase.from("tasks").select("text,completed,priority,due_date").eq("completed", false).limit(8),
    supabase.from("wealth").select("ira,savings,btc_amount,xrp_amount").eq("id", "max").single(),
    supabase.from("budget_allocations").select("category,budgeted").eq("period_start", ps),
    supabase.from("transactions").select("amount,budget_category").gte("date", ps).gt("amount", 0),
  ]);

  const habits = habitsRes.status === "fulfilled" ? habitsRes.value.data ?? [] : [];
  const tasks  = tasksRes.status  === "fulfilled" ? tasksRes.value.data  ?? [] : [];
  const wealth = wealthRes.status === "fulfilled" ? wealthRes.value.data ?? null : null;
  const allocs = allocRes.status  === "fulfilled" ? allocRes.value.data  ?? [] : [];
  const txs    = txRes.status     === "fulfilled" ? txRes.value.data     ?? [] : [];

  const habitsDone = habits.filter((h: { completed: boolean }) => h.completed).length;
  const openTasks  = tasks.map((t: { text: string; due_date?: string; priority?: string }) => t.text).slice(0, 4);

  const spendMap: Record<string, number> = {};
  for (const tx of txs as { amount: number; budget_category: string | null }[]) {
    const cat = tx.budget_category ?? "Misc";
    spendMap[cat] = (spendMap[cat] ?? 0) + tx.amount;
  }
  const totalBudgeted = allocs.reduce((s: number, a: { budgeted: number }) => s + a.budgeted, 0);
  const totalSpent    = Object.values(spendMap).reduce((s, v) => s + v, 0);
  const overBudget    = allocs
    .map((a: { category: string; budgeted: number }) => ({ cat: a.category, over: spendMap[a.category] ?? 0, bud: a.budgeted }))
    .filter(a => a.over > a.bud)
    .sort((a, b) => (b.over - b.bud) - (a.over - a.bud))
    .slice(0, 2);

  const hour = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" })).getHours();
  const timeLabel = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

  const prompt = `You are M.A.X., a sharp AI personal assistant. Generate a concise dashboard briefing for Max (${timeLabel}).

Context:
- Habits: ${habitsDone}/${habits.length} complete today
- Open tasks: ${openTasks.length > 0 ? openTasks.join(" | ") : "none"}
- Savings: ${wealth ? `$${wealth.savings.toLocaleString()}` : "unknown"} | IRA: ${wealth ? `$${wealth.ira.toLocaleString()}` : "unknown"}
- Monthly spend: $${Math.round(totalSpent)} of $${Math.round(totalBudgeted)} budgeted
${overBudget.length > 0 ? `- Over budget: ${overBudget.map(o => `${o.cat} +$${Math.round(o.over - o.bud)}`).join(", ")}` : "- All categories on budget"}

Return ONLY valid JSON array, no markdown:
[{"icon":"◈","text":"insight under 90 chars"},{"icon":"✦","text":"..."},{"icon":"◎","text":"..."},{"icon":"↗","text":"..."}]

Use these icons: ◈ ◎ ✦ ↗ ↘ ◉ ↑. Be direct, sharp, reference specific numbers. No fluff.`;

  let lines: { icon: string; text: string }[] = [];

  try {
    const response = await ai.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = (response.content[0] as { text: string }).text.trim();
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) lines = JSON.parse(match[0]);
  } catch {
    lines = [
      { icon: "◎", text: `${habitsDone}/${habits.length} habits done today.` },
      { icon: "◈", text: `Monthly spend $${Math.round(totalSpent)} of $${Math.round(totalBudgeted)} budgeted.` },
    ];
  }

  const generatedAt = new Date().toISOString();
  await supabase.from("settings").upsert({ key: "dashboard_brief", value: { lines, generatedAt } });

  return NextResponse.json({ lines, generatedAt, cached: false });
}

export async function GET() {
  const { data } = await supabase.from("settings").select("value").eq("key", "dashboard_brief").single();
  if (data?.value) {
    const { lines, generatedAt } = data.value as { lines: { icon: string; text: string }[]; generatedAt: string };
    if (lines && Date.now() - new Date(generatedAt).getTime() < CACHE_MS) {
      return NextResponse.json({ lines, generatedAt, cached: true });
    }
  }
  return generateBrief();
}

export async function POST() {
  return generateBrief();
}
