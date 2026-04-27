import { NextResponse } from "next/server";

/** Money DNA refresh — weekly. Hits /api/finance/money-dna POST. */
export async function GET() {
  try {
    const base = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
    const res = await fetch(`${base}/api/finance/money-dna`, { method: "POST" });
    const json = await res.json();
    return NextResponse.json({ ran_at: new Date().toISOString(), ...json });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
