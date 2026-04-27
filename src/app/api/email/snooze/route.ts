import { NextResponse } from "next/server";
import { sb } from "@/lib/email-intel";

/**
 * Email snooze. Setting snooze_until on email_intel hides the row from
 * default queries (the GET /api/email/intel route filters by snooze_until).
 *
 * POST   { thread_id, snooze_until }   — ISO string in the future
 * DELETE ?thread_id=…                  — clear (un-snooze)
 */

export async function POST(req: Request) {
  try {
    const body = await req.json() as { thread_id?: string; snooze_until?: string };
    if (!body.thread_id || !body.snooze_until) {
      return NextResponse.json({ error: "thread_id + snooze_until required" }, { status: 400 });
    }
    const supabase = sb();
    const { error } = await supabase
      .from("email_intel")
      .update({ snooze_until: body.snooze_until })
      .eq("thread_id", body.thread_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const tid = new URL(req.url).searchParams.get("thread_id");
  if (!tid) return NextResponse.json({ error: "thread_id required" }, { status: 400 });
  const supabase = sb();
  const { error } = await supabase
    .from("email_intel")
    .update({ snooze_until: null })
    .eq("thread_id", tid);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
