import { NextResponse } from "next/server";
import { readCalendar } from "@/lib/max-tools";
import { sendNotification } from "@/app/api/telegram/route";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  // OPT-IN: skip unless explicitly enabled in Settings
  const { data: prefRow } = await supabase.from("settings").select("value").eq("key", "notification_prefs").single();
  const prefs = (prefRow?.value ?? {}) as { calendar_alerts?: boolean };
  if (prefs.calendar_alerts !== true) return NextResponse.json({ sent: 0, reason: "not opted in" });

  try {
    const result = await readCalendar(1);
    if (!result.connected || result.events.length === 0) {
      return NextResponse.json({ ok: true, sent: 0 });
    }

    const now       = Date.now();
    const in30      = now + 30 * 60 * 1000;
    const in35      = now + 35 * 60 * 1000;

    const upcoming = result.events.filter((e: { allDay: boolean; start: string }) => {
      if (e.allDay) return false;
      const start = new Date(e.start).getTime();
      return start >= in30 && start <= in35;
    });

    if (upcoming.length === 0) {
      return NextResponse.json({ ok: true, sent: 0 });
    }

    for (const e of upcoming) {
      const start   = new Date(e.start);
      const timeStr = start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "America/New_York" });
      const msg     = [
        `⏰ *Upcoming in 30 min*`,
        ``,
        `*${e.title}*`,
        `🕐 ${timeStr}`,
        e.location ? `📍 ${e.location}` : "",
      ].filter(Boolean).join("\n");

      await sendNotification(msg);
    }

    return NextResponse.json({ ok: true, sent: upcoming.length });
  } catch (err) {
    console.error("Calendar alerts error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
