import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export interface InsightCard {
  id: string;
  domains: string[];
  headline: string;
  statA: { label: string; value: string };
  statB: { label: string; value: string };
  statARaw: number;
  statBRaw: number;
  evidence: string;
  take: string;
  trend: "positive" | "negative" | "neutral";
  color: string;
}

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

interface DayProfile {
  completedHabits: Set<string>;
  spent: number;
}

export async function GET(req: Request) {
  const forceRefresh = new URL(req.url).searchParams.get("refresh") === "1";

  if (!forceRefresh) {
    const { data: cached } = await supabase
      .from("settings").select("value").eq("key", "pattern_insights").single();
    if (cached?.value) {
      const cv = cached.value as { cards: InsightCard[]; generated_at: string; days_of_data: number };
      if (Date.now() - new Date(cv.generated_at).getTime() < CACHE_TTL_MS) {
        return NextResponse.json({ ...cv, cached: true });
      }
    }
  }

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [habitsRes, logsRes, txRes, wealthRes] = await Promise.all([
    supabase.from("habits").select("id,name,cat"),
    supabase.from("habit_logs").select("habit_id,date").eq("completed", true).gte("date", ninetyDaysAgo),
    supabase.from("transactions").select("date,amount,category").gte("date", ninetyDaysAgo),
    supabase.from("wealth_history").select("recorded_at,net_worth").gte("recorded_at", ninetyDaysAgo).order("recorded_at"),
  ]);

  const habits  = habitsRes.data  ?? [];
  const logs    = logsRes.data    ?? [];
  const txs     = txRes.data      ?? [];
  const wealth  = wealthRes.data  ?? [];

  const allDates = [...new Set(logs.map((l: { date: string }) => l.date))].sort() as string[];

  if (allDates.length < 14) {
    return NextResponse.json({ cards: [], days_of_data: allDates.length, insufficient_data: true });
  }

  // ── Build day profiles ──────────────────────────────────────────────────────
  const dayMap = new Map<string, DayProfile>();
  for (const date of allDates) {
    const dayLogs = (logs as { habit_id: string; date: string }[]).filter(l => l.date === date);
    const dayTxs  = (txs as { date: string; amount: number }[]).filter(t => t.date === date);
    const spent   = dayTxs.reduce((s, t) => s + Math.abs(t.amount), 0);
    dayMap.set(date, { completedHabits: new Set(dayLogs.map(l => l.habit_id)), spent });
  }

  const totalHabits = habits.length || 1;
  const days = [...dayMap.entries()] as [string, DayProfile][];

  // ── Per-habit correlations ──────────────────────────────────────────────────
  interface HabitStat {
    name: string;
    doneDays: number; skipDays: number;
    avgSpendDone: number; avgSpendSkip: number;
    avgHabitsDone: number; avgHabitsSkip: number;
    nextDayRepeat: number; // % chance of doing same habit the next day after a streak day
  }

  const habitStats: HabitStat[] = [];
  for (const h of habits as { id: string; name: string }[]) {
    const done = days.filter(([, d]) => d.completedHabits.has(h.id));
    const skip = days.filter(([, d]) => !d.completedHabits.has(h.id));
    if (done.length < 5 || skip.length < 5) continue;

    const avg = (ds: [string, DayProfile][], fn: (d: DayProfile) => number) =>
      ds.reduce((s, [, d]) => s + fn(d), 0) / ds.length;

    let nextRepeat = 0, nextTotal = 0;
    for (const [date] of done) {
      const next = new Date(date); next.setDate(next.getDate() + 1);
      const nextStr = next.toISOString().slice(0, 10);
      if (dayMap.has(nextStr)) {
        nextTotal++;
        if (dayMap.get(nextStr)!.completedHabits.has(h.id)) nextRepeat++;
      }
    }

    habitStats.push({
      name: h.name,
      doneDays: done.length, skipDays: skip.length,
      avgSpendDone: Math.round(avg(done, d => d.spent) * 100) / 100,
      avgSpendSkip: Math.round(avg(skip, d => d.spent) * 100) / 100,
      avgHabitsDone: Math.round(avg(done, d => d.completedHabits.size) * 10) / 10,
      avgHabitsSkip: Math.round(avg(skip, d => d.completedHabits.size) * 10) / 10,
      nextDayRepeat: nextTotal > 0 ? Math.round((nextRepeat / nextTotal) * 100) : 0,
    });
  }

  // ── Day-of-week patterns ────────────────────────────────────────────────────
  const DOW = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const dowMap: Record<string, { compPcts: number[]; spends: number[] }> = {};
  for (const [date, data] of days) {
    const dow = DOW[new Date(date).getDay()];
    if (!dowMap[dow]) dowMap[dow] = { compPcts: [], spends: [] };
    dowMap[dow].compPcts.push(data.completedHabits.size / totalHabits);
    if (data.spent > 0) dowMap[dow].spends.push(data.spent);
  }
  const dowStats = Object.entries(dowMap)
    .filter(([, d]) => d.compPcts.length >= 3)
    .map(([day, d]) => ({
      day,
      avgPct: Math.round((d.compPcts.reduce((a, b) => a + b, 0) / d.compPcts.length) * 100),
      avgSpend: d.spends.length ? Math.round(d.spends.reduce((a, b) => a + b, 0) / d.spends.length) : 0,
      n: d.compPcts.length,
    }))
    .sort((a, b) => b.avgPct - a.avgPct);

  const bestDay  = dowStats[0];
  const worstDay = dowStats[dowStats.length - 1];

  // ── Power combos ────────────────────────────────────────────────────────────
  interface PowerCombo {
    habitA: string; habitB: string;
    bothDays: number;
    avgAllOnBoth: number; avgAllOnOther: number;
    multiplier: number;
  }
  const powerCombos: PowerCombo[] = [];
  if (habits.length >= 3) {
    for (let i = 0; i < habits.length - 1; i++) {
      for (let j = i + 1; j < habits.length; j++) {
        const hA = (habits as { id: string; name: string }[])[i];
        const hB = (habits as { id: string; name: string }[])[j];
        const both  = days.filter(([, d]) => d.completedHabits.has(hA.id) && d.completedHabits.has(hB.id));
        const other = days.filter(([, d]) => !(d.completedHabits.has(hA.id) && d.completedHabits.has(hB.id)));
        if (both.length < 5 || other.length < 5) continue;
        const avgBoth  = both.reduce((s, [, d]) => s + d.completedHabits.size, 0) / both.length;
        const avgOther = other.reduce((s, [, d]) => s + d.completedHabits.size, 0) / other.length;
        if (avgBoth / avgOther >= 1.35) {
          powerCombos.push({
            habitA: hA.name, habitB: hB.name,
            bothDays: both.length,
            avgAllOnBoth: Math.round(avgBoth * 10) / 10,
            avgAllOnOther: Math.round(avgOther * 10) / 10,
            multiplier: Math.round((avgBoth / avgOther) * 100) / 100,
          });
        }
      }
    }
    powerCombos.sort((a, b) => b.multiplier - a.multiplier);
  }

  // ── Weekly wealth correlation ───────────────────────────────────────────────
  let wealthCorr: { highHabitWeeks: { n: number; avgChange: number }; lowHabitWeeks: { n: number; avgChange: number } } | null = null;
  if (wealth.length >= 8) {
    const wSnaps = (wealth as { recorded_at: string; net_worth: number }[]);
    const weekBuckets = new Map<string, { dates: string[] }>();
    for (const [date] of days) {
      const d = new Date(date);
      const ws = new Date(d); ws.setDate(d.getDate() - d.getDay());
      const wk = ws.toISOString().slice(0, 10);
      if (!weekBuckets.has(wk)) weekBuckets.set(wk, { dates: [] });
      weekBuckets.get(wk)!.dates.push(date);
    }

    const weekData: { avgComp: number; wealthDelta: number }[] = [];
    for (const [wk, wb] of weekBuckets.entries()) {
      if (wb.dates.length < 4) continue;
      const wkEnd = new Date(wk); wkEnd.setDate(wkEnd.getDate() + 6);
      const wkEndStr = wkEnd.toISOString().slice(0, 10);
      const startSnap = wSnaps.find(w => w.recorded_at.slice(0, 10) >= wk);
      const endSnap   = [...wSnaps].reverse().find(w => w.recorded_at.slice(0, 10) <= wkEndStr);
      if (!startSnap || !endSnap || startSnap.recorded_at === endSnap.recorded_at) continue;
      const avgComp = wb.dates.reduce((s, d) => {
        const p = dayMap.get(d); return s + (p ? p.completedHabits.size / totalHabits : 0);
      }, 0) / wb.dates.length;
      weekData.push({ avgComp, wealthDelta: endSnap.net_worth - startSnap.net_worth });
    }

    if (weekData.length >= 4) {
      const hi = weekData.filter(w => w.avgComp >= 0.6);
      const lo = weekData.filter(w => w.avgComp < 0.6);
      if (hi.length >= 2 && lo.length >= 2) {
        wealthCorr = {
          highHabitWeeks: { n: hi.length, avgChange: Math.round(hi.reduce((s, w) => s + w.wealthDelta, 0) / hi.length) },
          lowHabitWeeks:  { n: lo.length, avgChange: Math.round(lo.reduce((s, w) => s + w.wealthDelta, 0) / lo.length) },
        };
      }
    }
  }

  // ── Streak momentum ─────────────────────────────────────────────────────────
  interface StreakMomentum {
    name: string;
    afterStreak3Plus: number; // % full habit completion day after 3+ consecutive days
    baseline: number;
  }
  const streakMomentum: StreakMomentum[] = [];
  for (const h of habits as { id: string; name: string }[]) {
    const sortedDates = allDates.slice().sort();
    let streak = 0;
    const streakAfter: boolean[] = [];
    const baselineAfter: boolean[] = [];

    for (let i = 0; i < sortedDates.length; i++) {
      const date = sortedDates[i];
      const did = dayMap.get(date)?.completedHabits.has(h.id) ?? false;
      if (did) streak++; else streak = 0;

      if (i < sortedDates.length - 1) {
        const nextDate = sortedDates[i + 1];
        const nextProfile = dayMap.get(nextDate);
        if (!nextProfile) continue;
        const nextDayFullPct = nextProfile.completedHabits.size / totalHabits;
        const isGoodDay = nextDayFullPct >= 0.6;

        if (streak >= 3) streakAfter.push(isGoodDay);
        else baselineAfter.push(isGoodDay);
      }
    }

    if (streakAfter.length >= 4 && baselineAfter.length >= 4) {
      const afterPct    = Math.round((streakAfter.filter(Boolean).length / streakAfter.length) * 100);
      const baselinePct = Math.round((baselineAfter.filter(Boolean).length / baselineAfter.length) * 100);
      if (afterPct - baselinePct >= 15) {
        streakMomentum.push({ name: h.name, afterStreak3Plus: afterPct, baseline: baselinePct });
      }
    }
  }

  // ── Build Claude prompt ─────────────────────────────────────────────────────
  const stats = {
    dataWindow: `${allDates.length} tracked days (${allDates[0]} → ${allDates[allDates.length - 1]})`,
    habitNames: habits.map((h: { name: string }) => h.name),
    habitStats: habitStats.slice(0, 6),
    bestDay:  bestDay  ? { day: bestDay.day,  avgCompletionPct: bestDay.avgPct,  avgDailySpend: bestDay.avgSpend }  : null,
    worstDay: worstDay ? { day: worstDay.day, avgCompletionPct: worstDay.avgPct, avgDailySpend: worstDay.avgSpend } : null,
    powerCombos: powerCombos.slice(0, 2),
    wealthCorrelation: wealthCorr,
    streakMomentum: streakMomentum.slice(0, 2),
  };

  const prompt = `You are M.A.X. — Max's personal AI analyst. You've been silently watching his behavioral data for months. Now you're presenting 4 non-obvious pattern insights you've discovered.

Max's profile: 22yo, Orlando FL, starts Account Manager job in July 2026. Goals: $100K yr 1, $10K emergency fund. Gym 3-5x/week (push/pull/legs). Night owl building a morning routine. Holds BTC + XRP.

Computed statistics from ${stats.dataWindow}:
${JSON.stringify(stats, null, 2)}

Generate exactly 4 insight cards. Requirements:
- ONLY use patterns backed by the actual numbers above — zero fabrication
- Skip any insight if sampleSize < 5 or effect < 15%
- If a domain has no meaningful data, skip it — don't pad with weak insights
- Headlines must be specific and include the actual number: "Gym days cost $44 less. Every time." not "Gym affects spending"
- "take" is ONE sentence in M.A.X. voice: dry wit, Jarvis-grade confidence, personal to Max — no generic productivity advice
- Domains: pick 2 from ["Habits","Finance","Discipline","Wealth","Patterns"]
- trend: "positive" = good pattern for Max, "negative" = warning/red flag, "neutral" = informational
- color rgb: positive→"95,176,125"  negative→"200,90,90"  neutral→"125,184,232"

Return ONLY a JSON array — no markdown fences, no commentary:
[{
  "id": "kebab-slug",
  "domains": ["Habits","Finance"],
  "headline": "Gym days cost $44 less. Every time.",
  "statA": { "label": "GYM DAYS", "value": "$23 avg" },
  "statB": { "label": "REST DAYS", "value": "$67 avg" },
  "statARaw": 23,
  "statBRaw": 67,
  "evidence": "28 gym days · 42 rest days · 70-day window",
  "take": "Every rep is a $44 deposit your future self will appreciate.",
  "trend": "positive",
  "color": "95,176,125"
}]`;

  let cards: InsightCard[] = [];
  try {
    const res = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1800,
      messages: [{ role: "user", content: prompt }],
    });
    const text = res.content[0].type === "text" ? res.content[0].text.trim() : "";
    const match = text.match(/\[[\s\S]*\]/);
    if (match) cards = JSON.parse(match[0]);
  } catch { /* return empty on parse failure */ }

  const generated_at = new Date().toISOString();
  await supabase.from("settings").upsert(
    { key: "pattern_insights", value: { cards, generated_at, days_of_data: allDates.length } },
    { onConflict: "key" }
  );

  return NextResponse.json({ cards, generated_at, days_of_data: allDates.length });
}
