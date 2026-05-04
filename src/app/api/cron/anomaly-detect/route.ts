import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isOptedIn } from "@/lib/notify";
import { requireCron } from "@/lib/auth-guards";

/**
 * Anomaly Detection — nightly cron.
 *
 * For each new transaction in the last 24h, computes z-score against
 * Max's normal pattern at that merchant. If the merchant is brand-new
 * OR the z-score >= 3, writes to `anomaly_log` and pings Max on
 * Telegram with inline ✓ Legit / ✗ Flag buttons (callback prefix `an:`).
 *
 * The Telegram webhook (src/app/api/telegram/route.ts) handles
 * `an:legit:<id>` and `an:flag:<id>` and updates the anomaly_log row.
 *
 * Gated by the `anomaly_alert` notify category — Max controls in Settings.
 */

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
  );
}

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID   = process.env.TELEGRAM_CHAT_ID;

const Z_THRESHOLD = 3;
const NEW_MERCHANT_MIN_AMT = 50;       // ignore tiny first-time txns
const HISTORY_WINDOW_DAYS = 180;       // baseline pulled from this window

export async function GET(req: Request) {
  const guard = requireCron(req); if (guard) return guard;
  return runDetect();
}

async function runDetect() {
  try {
    const supabase = sb();
    const sinceIso = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const baselineIso = new Date(Date.now() - HISTORY_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);

    /* New transactions to evaluate (last ~36h to be safe with overnight syncs) */
    const { data: newTxs } = await supabase
      .from("transactions")
      .select("plaid_transaction_id,date,amount,merchant,merchant_normalized,pending")
      .gte("date", sinceIso)
      .order("date", { ascending: false });

    const candidates = (newTxs ?? []).filter(t => !t.pending && t.amount > 0);
    if (candidates.length === 0) {
      return NextResponse.json({ ran_at: new Date().toISOString(), evaluated: 0, flagged: 0 });
    }

    /* Pull baseline 180-day history once */
    const { data: histTxs } = await supabase
      .from("transactions")
      .select("date,amount,merchant_normalized,merchant,pending")
      .gte("date", baselineIso)
      .lt("date", sinceIso);

    const baseline = (histTxs ?? []).filter(t => !t.pending && t.amount > 0);

    /* Group baseline by merchant */
    const byMerchant: Record<string, number[]> = {};
    for (const t of baseline) {
      const k = String(t.merchant_normalized ?? t.merchant ?? "").toLowerCase();
      if (!k) continue;
      (byMerchant[k] ??= []).push(t.amount);
    }

    /* Don't double-flag — pull anomalies already logged for this set of plaid_transaction_ids */
    const ids = candidates.map(c => c.plaid_transaction_id).filter(Boolean);
    const { data: existingAnoms } = ids.length
      ? await supabase.from("anomaly_log").select("transaction_id").in("transaction_id", ids)
      : { data: [] as { transaction_id: string }[] };
    const alreadyFlagged = new Set((existingAnoms ?? []).map(a => a.transaction_id));

    let flaggedCount = 0;
    const optedIn = await isOptedIn("anomaly_alert");

    for (const t of candidates) {
      if (alreadyFlagged.has(t.plaid_transaction_id)) continue;
      const k = String(t.merchant_normalized ?? t.merchant ?? "").toLowerCase();
      if (!k) continue;

      const history = byMerchant[k] ?? [];
      let reason   = "";
      let zScore   = 0;
      let isAnomaly = false;

      if (history.length === 0) {
        /* Brand-new merchant */
        if (t.amount >= NEW_MERCHANT_MIN_AMT) {
          isAnomaly = true;
          reason = `New merchant: $${t.amount.toFixed(2)} at ${t.merchant} — never seen before.`;
          zScore = 99;  // sentinel for "no history"
        }
      } else if (history.length >= 3) {
        const mean = history.reduce((s, v) => s + v, 0) / history.length;
        const variance = history.reduce((s, v) => s + (v - mean) ** 2, 0) / history.length;
        const stdDev = Math.sqrt(variance);
        if (stdDev > 0) {
          zScore = (t.amount - mean) / stdDev;
          if (zScore >= Z_THRESHOLD) {
            isAnomaly = true;
            reason = `$${t.amount.toFixed(2)} at ${t.merchant} is ${zScore.toFixed(1)}σ above your $${mean.toFixed(2)} avg here.`;
          }
        }
      }

      if (!isAnomaly) continue;
      flaggedCount++;

      /* Insert anomaly_log row */
      const { data: anomRow } = await supabase
        .from("anomaly_log")
        .insert({
          transaction_id: t.plaid_transaction_id,
          merchant:       t.merchant,
          amount:         t.amount,
          z_score:        Math.round(zScore * 100) / 100,
          reason,
          status:         "pending",
        })
        .select("id")
        .single();

      if (!anomRow?.id) continue;

      /* Send Telegram ✓ Legit / ✗ Flag card if opted in */
      if (optedIn && BOT_TOKEN && CHAT_ID) {
        try {
          const body = [
            "🚨 *Unusual Transaction*",
            "",
            reason,
            `Date: ${t.date}`,
            "",
            "_Was this you?_",
          ].join("\n");

          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({
              chat_id: CHAT_ID,
              text: body,
              parse_mode: "Markdown",
              reply_markup: {
                inline_keyboard: [[
                  { text: "✓ Legit",     callback_data: `an:legit:${anomRow.id}` },
                  { text: "✗ Flag fraud", callback_data: `an:flag:${anomRow.id}`  },
                ]],
              },
            }),
          });
        } catch {
          /* non-fatal */
        }
      }
    }

    return NextResponse.json({
      ran_at:     new Date().toISOString(),
      evaluated:  candidates.length,
      flagged:    flaggedCount,
      opted_in:   optedIn,
    });
  } catch (err) {
    console.error("anomaly-detect error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
