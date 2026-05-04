import { NextResponse } from "next/server";
import { requireCron } from "@/lib/auth-guards";

// Cron: daily at 6am ET — calls the Plaid sync route
export async function GET(req: Request) {
  const guard = requireCron(req); if (guard) return guard;
  const base = process.env.APP_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  try {
    const res  = await fetch(`${base}/api/plaid/sync`, { method: "POST" });
    const data = await res.json();
    return NextResponse.json({ ok: true, ...data });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
