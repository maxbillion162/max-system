import { NextResponse } from "next/server";
import { sb } from "@/lib/email-intel";

/**
 * Intel actions — small mutations on email_intel rows from the UI.
 *
 * PATCH { thread_id, archived?, starred?, unread? }   — toggle flags
 *
 * Used by archive button, star button, "mark as read" on click-through, etc.
 */

export async function PATCH(req: Request) {
  try {
    const body = await req.json() as {
      thread_id?: string;
      archived?:  boolean;
      starred?:   boolean;
      unread?:    boolean;
    };
    if (!body.thread_id) return NextResponse.json({ error: "thread_id required" }, { status: 400 });

    const patch: Record<string, unknown> = {};
    if (typeof body.archived === "boolean") patch.archived = body.archived;
    if (typeof body.starred  === "boolean") patch.starred  = body.starred;
    if (typeof body.unread   === "boolean") patch.unread   = body.unread;
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: "no updates" }, { status: 400 });

    const supabase = sb();
    const { error } = await supabase
      .from("email_intel")
      .update(patch)
      .eq("thread_id", body.thread_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
