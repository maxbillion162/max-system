import { NextResponse } from "next/server";
import { sb, fetchThreads, classifyAndStore } from "@/lib/email-intel";

/**
 * Email intel — the heart of the smart inbox.
 *
 * GET                                — list intel rows joined to current Gmail threads
 * GET ?classification=action         — filter
 * POST { refresh?: boolean }         — fetch fresh threads from Gmail and re-classify
 *                                      (rules first, then Claude for the rest)
 */

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const cls = url.searchParams.get("classification");
    const includeArchived = url.searchParams.get("archived") === "1";
    const includeSnoozed  = url.searchParams.get("snoozed")  === "1";

    const supabase = sb();
    let q = supabase.from("email_intel").select("*").order("last_message_at", { ascending: false });
    if (cls) q = q.eq("classification", cls);
    if (!includeArchived) q = q.eq("archived", false);
    /* Snooze filter: hide rows whose snooze_until is in the future, unless requested */
    if (!includeSnoozed) {
      const now = new Date().toISOString();
      q = q.or(`snooze_until.is.null,snooze_until.lte.${now}`);
    }

    const { data, error } = await q.limit(200);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ threads: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    let body: { maxResults?: number; query?: string } = {};
    try { body = await req.json(); } catch { /* empty ok */ }

    const threads = await fetchThreads({
      maxResults: body.maxResults ?? 60,
      query:      body.query ?? "in:inbox",
    });
    if (threads.length === 0) {
      return NextResponse.json({ error: "Gmail not connected or no threads" }, { status: 400 });
    }

    const results = await classifyAndStore(threads);
    const counts = results.reduce<Record<string, number>>((acc, r) => {
      acc[r.source] = (acc[r.source] ?? 0) + 1;
      return acc;
    }, {});
    return NextResponse.json({ processed: results.length, counts, results });
  } catch (err) {
    console.error("email/intel error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
