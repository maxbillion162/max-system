/**
 * Unified feedback endpoint.
 *
 * Any AI-generated output in the product can ship with a FeedbackControl
 * that POSTs here. The rollup cron reads from this table and writes
 * learned preferences to the memories table so M.A.X. improves over time.
 *
 * Silently no-ops if the feedback table doesn't exist yet (pre-migration).
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

interface FeedbackPayload {
  surface?:      string;   // e.g. 'web', 'bubble', 'telegram' (optional)
  artifact_type: string;   // e.g. 'email_summary' | 'feed_top3' | 'dashboard_insight'
  artifact_id?:  string;
  rating:        1 | -1;
  note?:         string;
  metadata?:     Record<string, unknown>;
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as FeedbackPayload;
    if (body.rating !== 1 && body.rating !== -1) {
      return NextResponse.json({ ok: false, error: "rating must be 1 or -1" }, { status: 400 });
    }
    if (!body.artifact_type || typeof body.artifact_type !== "string") {
      return NextResponse.json({ ok: false, error: "artifact_type required" }, { status: 400 });
    }
    const { error } = await supabase.from("feedback").insert({
      surface:       body.surface ?? "web",
      artifact_type: body.artifact_type,
      artifact_id:   body.artifact_id ?? null,
      rating:        body.rating,
      note:          body.note ?? null,
      metadata:      body.metadata ?? {},
    });
    if (error) {
      // Migration hasn't been applied yet — don't break the UI, just log it
      console.warn("feedback insert failed:", error.message);
      return NextResponse.json({ ok: false, error: error.message }, { status: 200 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
