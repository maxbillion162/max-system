import { NextResponse } from "next/server";
import { fetchThreads, classifyAndStore } from "@/lib/email-intel";

/**
 * Email intel refresh — runs every 30 minutes during waking hours.
 *
 * Pulls a wider net of recent threads from Gmail (in:inbox -in:trash) and
 * routes each through classifyAndStore() — rules first, then Claude for the
 * remainder. Idempotent via model_input_hash, so re-runs on unchanged
 * threads cost nothing.
 */
export async function GET() {
  try {
    const threads = await fetchThreads({ maxResults: 80, query: "in:inbox -in:trash" });
    if (threads.length === 0) {
      return NextResponse.json({ ran_at: new Date().toISOString(), processed: 0, reason: "no threads / not connected" });
    }
    const results = await classifyAndStore(threads);
    const counts = results.reduce<Record<string, number>>((acc, r) => {
      acc[r.source] = (acc[r.source] ?? 0) + 1;
      return acc;
    }, {});
    return NextResponse.json({ ran_at: new Date().toISOString(), processed: results.length, counts });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
