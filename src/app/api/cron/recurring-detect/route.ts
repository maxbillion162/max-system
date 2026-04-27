import { NextResponse } from "next/server";

/**
 * Recurring-detect cron — weekly. Re-scans the last 90 days of transactions,
 * upserts detected subscriptions into `recurring_subscriptions`, and refreshes
 * Claude's cancel/keep/negotiate suggestion per row.
 *
 * The actual work lives in /api/finance/recurring (POST without an action
 * triggers `refreshDetection`); the cron just hits it.
 */
export async function GET() {
  try {
    const base = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

    const res = await fetch(`${base}/api/finance/recurring`, { method: "POST" });
    const json = await res.json();
    return NextResponse.json({ ran_at: new Date().toISOString(), ...json });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
