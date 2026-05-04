/**
 * Habit Coach — proactive Telegram push when Max is slacking.
 *
 * Runs daily late-afternoon ET (21 UTC). Scans:
 *  - Habits: how many of the last 5 days were each habit completed?
 *  - Goals: which are behind pace vs their deadline?
 *
 * Picks the single most actionable signal and pushes a targeted
 * nudge via notify() under the "habit_coach" category. Message
 * header is "Habit Coach" per Max's spec.
 *
 * Opt-in: nothing fires unless user enabled habit_coach in Settings.
 * At most one coach push per day.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isOptedIn, notify } from "@/lib/notify";
import { requireCron } from "@/lib/auth-guards";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

interface CoachCandidate {
  score: number;
  title: string;
  body:  string;
  telegramText: string;
  actionUrl?: string;
}

function daysAgoStr(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  const guard = requireCron(req); if (guard) return guard;
  if (!(await isOptedIn("habit_coach"))) {
    return NextResponse.json({ delivered: false, reason: "not opted in" });
  }

  const [habitsRes, logsRes, goalsRes] = await Promise.allSettled([
    supabase.from("habits").select("id, name"),
    supabase.from("habit_logs").select("habit_id, date, completed").gte("date", daysAgoStr(7)).eq("completed", true),
    supabase.from("goals").select("id, label, current, target, unit, deadline, category"),
  ]);

  const candidates: CoachCandidate[] = [];

  /* ─── Habit slipping rule ─────────────────────────────────
     A habit that's been done 0 or 1 of the last 5 days is slipping. */
  if (habitsRes.status === "fulfilled" && logsRes.status === "fulfilled" && habitsRes.value.data && logsRes.value.data) {
    const habits = habitsRes.value.data as { id: string; name: string }[];
    const logs   = logsRes.value.data   as { habit_id: string; date: string }[];
    const last5  = new Set(Array.from({ length: 5 }, (_, i) => daysAgoStr(i)));

    const slipping = habits.map(h => {
      const done = new Set(
        logs.filter(l => l.habit_id === h.id && last5.has(l.date)).map(l => l.date)
      ).size;
      return { habit: h, done, missed: 5 - done };
    }).filter(x => x.missed >= 4);  // 0 or 1 of 5 days

    if (slipping.length >= 2) {
      const names = slipping.slice(0, 3).map(s => s.habit.name);
      candidates.push({
        score: 90,
        title: `${slipping.length} habits slipping`,
        body:  `Missed ${names.join(", ")} most of this week. Shrink one or swap it out?`,
        telegramText: `🎯 *Habit Coach*\n\n${slipping.length} habits are slipping hard this week:\n${names.map(n => `• ${n}`).join("\n")}\n\nShrink one down or drop it — better to do something small every day than nothing.`,
        actionUrl: "/dashboard/discipline",
      });
    } else if (slipping.length === 1) {
      const s = slipping[0];
      candidates.push({
        score: 75,
        title: `${s.habit.name} is slipping`,
        body:  `${s.done}/5 days done this week. Try making it smaller.`,
        telegramText: `🎯 *Habit Coach*\n\n*${s.habit.name}* is slipping — only ${s.done}/5 days this week.\n\nWhat if you made it half the size for the next week? Small streaks beat perfect plans.`,
        actionUrl: "/dashboard/discipline",
      });
    }
  }

  /* ─── Goal falling behind rule ───────────────────────────
     A goal whose completion % is more than 20% below where it should be
     given the deadline timeline is falling behind. */
  if (goalsRes.status === "fulfilled" && goalsRes.value.data) {
    const now = Date.now();
    const goals = goalsRes.value.data as { id: string; label: string; current: number; target: number; unit: string; deadline: string }[];
    for (const g of goals) {
      if (!g.deadline || g.target <= 0 || g.current >= g.target) continue;
      const deadline = new Date(g.deadline).getTime();
      const daysLeft = Math.round((deadline - now) / 86_400_000);
      if (daysLeft <= 0 || daysLeft > 365) continue;
      // Assume started ~1 year before deadline as a reasonable timeline baseline
      const startDate = deadline - 365 * 86_400_000;
      const expectedPct = Math.min(100, ((now - startDate) / (deadline - startDate)) * 100);
      const actualPct   = Math.min(100, (g.current / g.target) * 100);
      const gap = expectedPct - actualPct;
      if (gap >= 20 && actualPct < 80) {
        const remaining = g.target - g.current;
        const perWeek = Math.ceil(remaining / Math.max(1, daysLeft / 7));
        const unitFmt = g.unit === "$" ? `$${perWeek.toLocaleString()}` : `${perWeek} ${g.unit}`;
        candidates.push({
          score: 70 + Math.min(25, gap),
          title: `${g.label} is falling behind`,
          body:  `${Math.round(actualPct)}% done with ${daysLeft}d left. Need ~${unitFmt}/week to catch up.`,
          telegramText: `🎯 *Habit Coach*\n\n*${g.label}* is falling behind pace.\n\n${Math.round(actualPct)}% complete with ${daysLeft} days left. To catch up you'd need roughly *${unitFmt} per week*.\n\nCan you carve out one weekly action for this?`,
          actionUrl: "/dashboard/discipline",
        });
      }
    }
  }

  if (candidates.length === 0) {
    return NextResponse.json({ delivered: false, reason: "nothing notable — Max is on pace" });
  }

  candidates.sort((a, b) => b.score - a.score);
  const top = candidates[0];

  await notify({
    category: "habit_coach",
    title:    top.title,
    body:     top.body,
    telegramText: top.telegramText,
    actionUrl: top.actionUrl,
  });

  return NextResponse.json({ delivered: true, picked: top.title, candidates: candidates.length });
}
