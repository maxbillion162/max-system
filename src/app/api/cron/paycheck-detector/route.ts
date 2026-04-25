import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { notify } from "@/lib/notify";

/**
 * Paycheck Detector — daily cron.
 *
 * Scans newly-synced transactions for credits (negative-amount in Plaid) that
 * look like paychecks: ≥ $500 AND not already detected. Writes a notification
 * to the bell + Telegram (gated by the new "paycheck_detected" category) with
 * a link to the Finance page where the planner modal opens.
 *
 * Detected paychecks are recorded in settings.paycheck_history so we never
 * double-fire on the same transaction.
 */

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

const PAYCHECK_MIN = 500;          // ignore small credits (refunds, transfers)

interface DetectedPaycheck {
  transaction_id: string;
  amount:         number;
  date:           string;
  merchant:       string;
}

export async function GET() {
  return runDetect();
}
export async function POST() {
  return runDetect();
}

async function runDetect() {
  const supabase = sb();

  /* Pull the last 14 days of negative-amount (income) transactions */
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data: txs } = await supabase
    .from("transactions")
    .select("id,plaid_transaction_id,date,amount,merchant,merchant_normalized,pending")
    .gte("date", since)
    .lt("amount", -PAYCHECK_MIN)        // Plaid: negative = inflow
    .order("date", { ascending: false });

  if (!txs || txs.length === 0) {
    return NextResponse.json({ detected: 0, reason: "no large credits in window" });
  }

  /* Load existing detection history */
  const { data: histRow } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "paycheck_history")
    .single();
  const history = (histRow?.value ?? []) as DetectedPaycheck[];
  const seenIds = new Set(history.map(h => h.transaction_id));

  const newPaychecks: DetectedPaycheck[] = [];
  for (const t of txs) {
    if (t.pending) continue;
    const id = t.plaid_transaction_id ?? String(t.id);
    if (seenIds.has(id)) continue;
    newPaychecks.push({
      transaction_id: id,
      amount:         Math.abs(t.amount),
      date:           t.date,
      merchant:       t.merchant ?? "Unknown",
    });
  }

  if (newPaychecks.length === 0) {
    return NextResponse.json({ detected: 0, reason: "no new paychecks" });
  }

  /* Store updated history (cap at 50 most-recent) */
  const newHistory = [...newPaychecks, ...history].slice(0, 50);
  await supabase.from("settings").upsert({ key: "paycheck_history", value: newHistory });

  /* Fire one notification per new paycheck */
  for (const p of newPaychecks) {
    await notify({
      category: "paycheck_detected",
      title:    `Paycheck detected: $${Math.round(p.amount).toLocaleString()}`,
      body:     `${p.merchant} on ${p.date}. M.A.X. has a proposed distribution waiting on your Finance page.`,
      actionUrl: "/dashboard/finance",
      telegramText: [
        `💰 *Paycheck detected*`,
        ``,
        `$${Math.round(p.amount).toLocaleString()} from ${p.merchant} on ${p.date}.`,
        ``,
        `Open Finance — M.A.X. has a distribution proposal ready.`,
      ].join("\n"),
    });
  }

  return NextResponse.json({ detected: newPaychecks.length, paychecks: newPaychecks });
}
