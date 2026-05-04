import { NextResponse } from "next/server";
import { notify } from "@/lib/notify";
import { requireCron } from "@/lib/auth-guards";

/**
 * Quarterly narrative cron — runs on the 1st of Apr/Jul/Oct/Jan.
 * Hits /api/finance/reports POST (no body = previous full quarter),
 * then pings Max via the bell + Telegram with a teaser link.
 */
export async function GET(req: Request) {
  const guard = requireCron(req); if (guard) return guard;
  try {
    const base = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

    const res = await fetch(`${base}/api/finance/reports`, { method: "POST" });
    const json = await res.json();

    if (json.report) {
      const r = json.report;
      const teaser = (r.content ?? "").split("\n").find((l: string) => l.trim().length > 0)?.slice(0, 240) ?? "";
      await notify({
        category: "max_insight",  // proactive analysis
        title:    `${r.period_label} narrative ready`,
        body:     teaser || "Open the Finance page to read the full report.",
        actionUrl: "/dashboard/finance",
        telegramText: `📜 *${r.period_label} narrative ready*\n\n${teaser}\n\n_Open the Finance page for the full report._`,
      });
    }

    return NextResponse.json({ ran_at: new Date().toISOString(), ...json });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
