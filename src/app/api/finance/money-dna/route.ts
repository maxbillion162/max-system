import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Money DNA — Claude analyzes 6 months of categorized transactions and
 * produces 4-6 personality patterns about Max's spending behavior.
 *
 * GET   → most-recent row from money_dna table
 * POST  → recompute (read 6mo, ask Claude, insert new row)
 *
 * The /api/cron/money-dna-refresh endpoint hits POST weekly.
 * The patterns are structured so MoneyDNA.tsx can render them with
 * severity coloring + an evidence metric per pattern.
 */

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

interface Pattern {
  title:           string;
  body:            string;
  severity:        "win" | "watch" | "warn" | string;
  evidence_metric: string;
}

export async function GET() {
  const supabase = sb();
  const { data, error } = await supabase
    .from("money_dna")
    .select("*")
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ dna: data ?? null });
}

export async function POST() {
  try {
    const supabase = sb();
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth() - 6, 1);
    const startIso = start.toISOString().slice(0, 10);
    const endIso   = today.toISOString().slice(0, 10);

    const { data: txData } = await supabase
      .from("transactions")
      .select("date,amount,merchant,merchant_normalized,category,budget_category,pending")
      .gte("date", startIso)
      .order("date", { ascending: false });

    const txs = (txData ?? []).filter(t => !t.pending && t.amount > 0);
    if (txs.length < 30) {
      return NextResponse.json({
        dna: null,
        empty_reason: `Only ${txs.length} transactions in the last 6 months — need 30+ to read your DNA.`,
      });
    }

    /* Aggregate signals deterministically — Claude only writes the prose */
    const total = txs.reduce((s, t) => s + t.amount, 0);
    const byCat: Record<string, number> = {};
    const byDay: Record<number, { total: number; count: number }> = {};
    const byHour: Record<number, number> = {};            // not available without time, skip if dates only
    const byMerchant: Record<string, { count: number; total: number; merchant: string }> = {};

    for (const t of txs) {
      const cat = t.budget_category ?? t.category ?? "Misc";
      byCat[cat] = (byCat[cat] ?? 0) + t.amount;

      const dow = new Date(t.date + "T12:00:00").getDay();
      if (!byDay[dow]) byDay[dow] = { total: 0, count: 0 };
      byDay[dow].total += t.amount; byDay[dow].count += 1;

      const m = String(t.merchant_normalized ?? t.merchant ?? "").toLowerCase();
      if (!m) continue;
      if (!byMerchant[m]) byMerchant[m] = { count: 0, total: 0, merchant: t.merchant ?? m };
      byMerchant[m].count++; byMerchant[m].total += t.amount;
    }

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dowAvgs = Object.entries(byDay).map(([d, v]) => ({
      day: dayNames[Number(d)], total: v.total, count: v.count, avg: v.total / v.count,
    })).sort((a, b) => b.total - a.total);

    const topCats = Object.entries(byCat)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([cat, amt]) => ({ cat, amt: Math.round(amt), share: amt / total }));

    const topMerchants = Object.values(byMerchant)
      .sort((a, b) => b.total - a.total)
      .slice(0, 8)
      .map(m => ({ merchant: m.merchant, count: m.count, total: Math.round(m.total) }));

    const weekendShare = (byDay[0]?.total ?? 0) + (byDay[6]?.total ?? 0);
    const weekendPct = total > 0 ? (weekendShare / total) * 100 : 0;

    /* Ask Claude for personality patterns */
    const prompt = [
      `You are M.A.X., Max's autonomous CFO. Analyze 6 months of his spending and identify 4-6 personality patterns.`,
      `These are NOT generic platitudes. Each is a SHARP, SPECIFIC observation grounded in the data — like a therapist who's read every transaction.`,
      `Each pattern: 5-7 word title, 1-2 sentence body (must include a number), severity (win/watch/warn), and one-line evidence_metric.`,
      `Tone: dry, direct, observational — no hedging, no "you might want to consider".`,
      ``,
      `WHO MAX IS: 22, Orlando, just graduated FSU, starts an Account Manager job July 2026 ($100K target year-1), goal $10K emergency fund, gym 3-5x/wk, has a girlfriend.`,
      ``,
      `6-MONTH TOTALS:`,
      `Total spend: $${Math.round(total).toLocaleString()} across ${txs.length} transactions`,
      `Period: ${startIso} → ${endIso}`,
      ``,
      `TOP CATEGORIES:`,
      topCats.map(c => `  · ${c.cat}: $${c.amt} (${(c.share*100).toFixed(0)}% of total)`).join("\n"),
      ``,
      `DAY-OF-WEEK PATTERN (sorted by total):`,
      dowAvgs.map(d => `  · ${d.day}: $${Math.round(d.total)} across ${d.count} txns (avg $${Math.round(d.avg)})`).join("\n"),
      `Weekend share: ${weekendPct.toFixed(0)}% of total spend`,
      ``,
      `TOP MERCHANTS:`,
      topMerchants.map(m => `  · ${m.merchant}: $${m.total} across ${m.count} visits (avg $${Math.round(m.total/m.count)})`).join("\n"),
      ``,
      `Return ONLY a JSON array — no preamble. 4-6 items.`,
      `[{"title": "...", "body": "...", "severity": "win|watch|warn", "evidence_metric": "..."}]`,
    ].join("\n");

    let patterns: Pattern[] = [];
    try {
      const r = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      });
      const text = r.content[0]?.type === "text" ? r.content[0].text : "";
      const m = text.match(/\[[\s\S]*\]/);
      if (m) patterns = JSON.parse(m[0]);
    } catch {
      patterns = [];
    }

    if (patterns.length === 0) {
      return NextResponse.json({ error: "Claude returned no patterns" }, { status: 500 });
    }

    const { data: row, error: insertErr } = await supabase
      .from("money_dna")
      .insert({
        patterns,
        baseline_period_start: startIso,
        baseline_period_end:   endIso,
        txn_count:             txs.length,
      })
      .select()
      .single();

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
    return NextResponse.json({ dna: row });
  } catch (err) {
    console.error("money-dna error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
