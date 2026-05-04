/**
 * Trend detection — the "M.A.X. Insights" producer.
 *
 * Runs daily. Scans habits, budget, goals, crypto, emergency fund, calendar
 * load. Computes a candidate list of insights with rule-based scoring,
 * picks the single most notable one, and fires it through notify() with
 * category: "max_insight".
 *
 * Nothing fires unless the user enabled max_insight in Settings.
 * Deterministic by design — no LLM call here, so output is predictable
 * and diffable. Tuning happens in the rules below, not in a prompt.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readCrypto, readHabits } from "@/lib/max-tools";
import { isOptedIn, notify } from "@/lib/notify";
import { requireCron } from "@/lib/auth-guards";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

interface Candidate {
  score:    number;       // 0-100, higher = more worth surfacing
  title:    string;
  body:     string;
  actionUrl?: string;
}

export async function GET(req: Request) {
  const guard = requireCron(req); if (guard) return guard;
  // Skip expensive work if user isn't opted in
  if (!(await isOptedIn("max_insight"))) {
    return NextResponse.json({ delivered: false, reason: "not opted in" });
  }

  const today        = new Date().toISOString().slice(0, 10);
  const periodStart  = today.slice(0, 7) + "-01";
  const candidates: Candidate[] = [];

  // Load everything we need in parallel — one round trip of DB reads
  const [
    cryptoRes, habitsRes, habitLogsRes,
    goalsRes, wealthRes, txRes, allocRes, billsRes,
  ] = await Promise.allSettled([
    readCrypto(),
    readHabits(),
    supabase.from("habit_logs").select("habit_id,date,completed").gte("date", daysAgo(14)),
    supabase.from("goals").select("id,label,current,target,deadline").order("deadline"),
    supabase.from("wealth").select("*").eq("id", "max").single(),
    supabase.from("transactions").select("amount,budget_category,pending,date").gte("date", periodStart).gt("amount", 0),
    supabase.from("budget_allocations").select("category,budgeted").eq("period_start", periodStart),
    supabase.from("bills").select("name,amt,due_day"),
  ]);

  // ─── Rule 1: Crypto move ±5% in 24h ─────────────────────────────
  if (cryptoRes.status === "fulfilled") {
    for (const c of cryptoRes.value as { symbol: string; price: number; change24h: number }[]) {
      const abs = Math.abs(c.change24h);
      if (abs >= 5) {
        const dir = c.change24h >= 0 ? "up" : "down";
        candidates.push({
          score: 50 + Math.min(40, abs * 2),
          title: `${c.symbol} ${dir} ${abs.toFixed(1)}% in 24h`,
          body:  `${c.symbol} is at $${c.symbol === "XRP" ? c.price.toFixed(4) : Math.round(c.price).toLocaleString()} — notable move.`,
          actionUrl: "/dashboard/finance",
        });
      }
    }
  }

  // ─── Rule 2: Habit slipping (not completed 3+ days in last 7) ───
  if (habitsRes.status === "fulfilled" && habitLogsRes.status === "fulfilled" && habitLogsRes.value.data) {
    type Habit = { id: string; name: string };
    const habits = habitsRes.value as Habit[];
    const logs   = habitLogsRes.value.data as { habit_id: string; date: string; completed: boolean }[];
    const last7  = new Set(Array.from({ length: 7 }, (_, i) => daysAgo(i)));

    for (const h of habits) {
      const completedDates = new Set(
        logs.filter(l => l.habit_id === h.id && l.completed && last7.has(l.date)).map(l => l.date)
      );
      const missed = 7 - completedDates.size;
      if (missed >= 4) {
        candidates.push({
          score: 55 + missed * 3,
          title: `${h.name} slipping`,
          body:  `Only ${7 - missed}/7 days done this week.`,
          actionUrl: "/dashboard/habits",
        });
      }
    }
  }

  // ─── Rule 3: Budget category over by 10%+ ───────────────────────
  if (txRes.status === "fulfilled" && allocRes.status === "fulfilled") {
    const txs    = (txRes.value.data ?? []) as { amount: number; budget_category: string | null; pending: boolean }[];
    const allocs = (allocRes.value.data ?? []) as { category: string; budgeted: number }[];

    const spend: Record<string, number> = {};
    for (const tx of txs) {
      if (tx.pending) continue;
      const cat = tx.budget_category ?? "Misc";
      spend[cat] = (spend[cat] ?? 0) + tx.amount;
    }
    for (const a of allocs) {
      const s = spend[a.category] ?? 0;
      if (a.budgeted > 0 && s > a.budgeted * 1.1) {
        const over = s - a.budgeted;
        const pctOver = Math.round((over / a.budgeted) * 100);
        candidates.push({
          score: 70 + Math.min(20, pctOver / 3),
          title: `Over on ${a.category} this month`,
          body:  `$${Math.round(s).toLocaleString()} spent against $${Math.round(a.budgeted).toLocaleString()} budget — ${pctOver}% over.`,
          actionUrl: "/dashboard/finance",
        });
      }
    }
  }

  // ─── Rule 4: Emergency fund milestone crossing ──────────────────
  if (wealthRes.status === "fulfilled" && wealthRes.value.data) {
    const savings = Number(wealthRes.value.data.savings ?? 0);
    const milestones = [2500, 5000, 7500, 10000];
    for (const m of milestones) {
      // Fired the first day savings is within 2% above a milestone it hadn't hit
      if (savings >= m && savings < m * 1.02) {
        candidates.push({
          score: 85,
          title: `Emergency fund crossed $${m.toLocaleString()}`,
          body:  `Savings now at $${Math.round(savings).toLocaleString()}. ${m === 10000 ? "Emergency fund goal hit." : `$${(10000 - savings).toLocaleString()} to the $10K goal.`}`,
          actionUrl: "/dashboard/finance",
        });
      }
    }
  }

  // ─── Rule 5: Goal deadline <30 days at <70% progress ────────────
  if (goalsRes.status === "fulfilled" && goalsRes.value.data) {
    const goals = goalsRes.value.data as { label: string; current: number; target: number; deadline: string | null }[];
    for (const g of goals) {
      if (!g.deadline || g.target <= 0) continue;
      const deadline = new Date(g.deadline).getTime();
      const daysLeft = Math.round((deadline - Date.now()) / 86_400_000);
      const pct      = Math.min(100, Math.round((g.current / g.target) * 100));
      if (daysLeft > 0 && daysLeft <= 30 && pct < 70) {
        candidates.push({
          score: 60 + (30 - daysLeft),
          title: `${g.label} behind pace`,
          body:  `${pct}% complete with ${daysLeft} days to deadline.`,
          actionUrl: "/dashboard/goals",
        });
      }
    }
  }

  // ─── Rule 6: Bill due in ≤3 days ────────────────────────────────
  if (billsRes.status === "fulfilled" && billsRes.value.data) {
    const dayOfMonth = new Date().getDate();
    const bills = billsRes.value.data as { name: string; amt: number; due_day: number }[];
    for (const b of bills) {
      const daysUntil = b.due_day >= dayOfMonth ? b.due_day - dayOfMonth : 31 - dayOfMonth + b.due_day;
      if (daysUntil >= 0 && daysUntil <= 3) {
        candidates.push({
          score: 90 - daysUntil * 5,
          title: `${b.name} due in ${daysUntil === 0 ? "today" : `${daysUntil}d`}`,
          body:  `$${b.amt.toFixed(2)} — ${daysUntil === 0 ? "today." : `due on the ${b.due_day}${ordinal(b.due_day)}.`}`,
          actionUrl: "/dashboard/finance",
        });
      }
    }
  }

  // No candidates? Quietly do nothing.
  if (candidates.length === 0) {
    return NextResponse.json({ delivered: false, reason: "no notable trends", scanned: 6 });
  }

  // Pick the single most notable insight — one ping per day max
  candidates.sort((a, b) => b.score - a.score);
  const top = candidates[0];

  await notify({
    category:  "max_insight",
    title:     top.title,
    body:      top.body,
    actionUrl: top.actionUrl,
    telegramText: `◆ *M.A.X. Insight*\n\n*${top.title}*\n${top.body}`,
  });

  return NextResponse.json({
    delivered: true,
    picked:    top.title,
    score:     top.score,
    candidates: candidates.length,
  });
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
}
function ordinal(n: number): string {
  return n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th";
}
