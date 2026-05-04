import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Subscription Audit — read or refresh detected recurring subscriptions.
 *
 * GET                       — list all rows in `recurring_subscriptions` with annual totals
 * POST { action: "decide", id, decision }  — record Max's accept/reject/snooze on a row
 * POST { action: "refresh" }               — re-run detection over last 90 days + ask
 *                                            Claude for cancel/keep/negotiate suggestions
 *
 * The detection algorithm matches /api/finance/insights but is persisted here
 * so the AI suggestions can hang off it and Max's decisions stick.
 */

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
  );
}

interface DetectedSub {
  merchant_pattern:     string;
  display_name:         string;
  monthly_amount:       number;
  cadence:              "monthly" | "quarterly" | "annual" | "weekly" | "irregular";
  occurrences:          number;
  first_seen:           string;
  last_seen:            string;
}

export async function GET() {
  const supabase = sb();
  const { data, error } = await supabase
    .from("recurring_subscriptions")
    .select("*")
    .order("monthly_amount", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const total_monthly = (data ?? []).reduce((s, r) => s + Number(r.monthly_amount), 0);
  const total_annual  = total_monthly * 12;
  return NextResponse.json({ subs: data ?? [], total_monthly, total_annual });
}

export async function POST(req: Request) {
  let body: { action?: string; id?: string; decision?: string } = {};
  try { body = await req.json(); } catch { /* default */ }

  if (body.action === "decide" && body.id && body.decision) {
    return recordDecision(body.id, body.decision);
  }
  return refreshDetection();
}

async function recordDecision(id: string, decision: string) {
  const valid = ["accepted", "rejected", "snoozed", "pending"];
  if (!valid.includes(decision)) {
    return NextResponse.json({ error: "invalid decision" }, { status: 400 });
  }
  const supabase = sb();
  const { error } = await supabase
    .from("recurring_subscriptions")
    .update({ user_decision: decision, user_decision_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

async function refreshDetection() {
  try {
    const supabase = sb();
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
    const { data: txs } = await supabase
      .from("transactions")
      .select("date,amount,merchant,merchant_normalized,pending")
      .gte("date", ninetyDaysAgo);

    const positive = (txs ?? []).filter(t => !t.pending && t.amount > 0);

    /* Same algorithm as insights: same merchant 2+, monthly cadence, ±15% amount */
    const byMerchant: Record<string, typeof positive> = {};
    for (const t of positive) {
      const key = String(t.merchant_normalized ?? t.merchant ?? "").toLowerCase();
      if (!key) continue;
      (byMerchant[key] ??= []).push(t);
    }

    const detected: DetectedSub[] = [];
    for (const [key, group] of Object.entries(byMerchant)) {
      if (group.length < 2) continue;
      const sorted = [...group].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const amounts = sorted.map(t => t.amount);
      const minAmt = Math.min(...amounts);
      const maxAmt = Math.max(...amounts);
      if (minAmt > 0 && (maxAmt - minAmt) / minAmt > 0.15) continue;

      let gapsSum = 0; let gaps = 0;
      for (let i = 1; i < sorted.length; i++) {
        const dt = (new Date(sorted[i].date).getTime() - new Date(sorted[i - 1].date).getTime()) / 86_400_000;
        gapsSum += dt; gaps++;
      }
      const avgGap = gaps > 0 ? gapsSum / gaps : 0;

      let cadence: DetectedSub["cadence"] = "irregular";
      if (avgGap >= 6 && avgGap <= 8)        cadence = "weekly";
      else if (avgGap >= 25 && avgGap <= 35) cadence = "monthly";
      else if (avgGap >= 80 && avgGap <= 100) cadence = "quarterly";
      else if (avgGap >= 350 && avgGap <= 380) cadence = "annual";
      else continue; // not a clean recurrence

      const avgAmt = amounts.reduce((s, v) => s + v, 0) / amounts.length;
      const monthlyEquiv =
        cadence === "weekly"    ? avgAmt * (52 / 12) :
        cadence === "monthly"   ? avgAmt :
        cadence === "quarterly" ? avgAmt / 3 :
        cadence === "annual"    ? avgAmt / 12 :
        avgAmt;

      detected.push({
        merchant_pattern: key,
        display_name:     sorted[0].merchant ?? key,
        monthly_amount:   Math.round(monthlyEquiv * 100) / 100,
        cadence,
        occurrences:      sorted.length,
        first_seen:       sorted[0].date,
        last_seen:        sorted[sorted.length - 1].date,
      });
    }

    /* Ask Claude for a suggestion per sub */
    let claudeSuggestions: Record<string, { suggestion: string; reasoning: string }> = {};
    if (detected.length > 0) {
      try {
        const list = detected.map(d => `- ${d.display_name}: $${d.monthly_amount.toFixed(2)}/mo (${d.cadence}, ${d.occurrences}× in 90d)`).join("\n");
        const prompt = [
          `You are M.A.X., Max's CFO. For each subscription, recommend ONE of: cancel, keep, negotiate, review.`,
          `Reasoning is one terse sentence with a number. Max is 22, $100K target year-1, has a girlfriend.`,
          ``,
          `SUBS:`,
          list,
          ``,
          `Return JSON only:`,
          `[{"merchant_pattern": "<lowercase pattern>", "suggestion": "cancel|keep|negotiate|review", "reasoning": "..."}]`,
        ].join("\n");
        const r = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1500,
          messages: [{ role: "user", content: prompt }],
        });
        const text = r.content[0]?.type === "text" ? r.content[0].text : "";
        const m = text.match(/\[[\s\S]*\]/);
        if (m) {
          const arr = JSON.parse(m[0]) as { merchant_pattern: string; suggestion: string; reasoning: string }[];
          claudeSuggestions = Object.fromEntries(
            arr.map(a => [a.merchant_pattern.toLowerCase(), { suggestion: a.suggestion, reasoning: a.reasoning }])
          );
        }
      } catch {
        claudeSuggestions = {};
      }
    }

    /* Upsert each detected row, preserving prior user_decision */
    for (const d of detected) {
      const sug = claudeSuggestions[d.merchant_pattern];
      const validSug = ["cancel","keep","negotiate","review"].includes(sug?.suggestion ?? "")
        ? sug?.suggestion : "review";

      await supabase.from("recurring_subscriptions").upsert({
        merchant_pattern:     d.merchant_pattern,
        display_name:         d.display_name,
        monthly_amount:       d.monthly_amount,
        cadence:              d.cadence,
        first_seen:           d.first_seen,
        last_seen:            d.last_seen,
        occurrences:          d.occurrences,
        suggestion:           validSug,
        suggestion_reasoning: sug?.reasoning ?? null,
        detected_at:          new Date().toISOString(),
      }, { onConflict: "merchant_pattern" });
    }

    const { data: subs } = await supabase
      .from("recurring_subscriptions")
      .select("*")
      .order("monthly_amount", { ascending: false });

    const total_monthly = (subs ?? []).reduce((s, r) => s + Number(r.monthly_amount), 0);
    return NextResponse.json({
      subs: subs ?? [],
      detected_count: detected.length,
      total_monthly,
      total_annual: total_monthly * 12,
    });
  } catch (err) {
    console.error("recurring error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
