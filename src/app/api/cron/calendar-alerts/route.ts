import { NextResponse } from "next/server";
import { readCalendar } from "@/lib/max-tools";
import { isOptedIn, notify } from "@/lib/notify";
import { requireCron } from "@/lib/auth-guards";

export async function GET(req: Request) {
  const guard = requireCron(req); if (guard) return guard;
  if (!(await isOptedIn("calendar_alerts"))) return NextResponse.json({ sent: 0, reason: "not opted in" });

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
      await notify({
        category: "calendar_alerts",
        title:    `${e.title} in 30 min`,
        body:     `${timeStr}${e.location ? ` · ${e.location}` : ""}`,
        telegramText: [
          `⏰ *Upcoming in 30 min*`,
          ``,
          `*${e.title}*`,
          `🕐 ${timeStr}`,
          e.location ? `📍 ${e.location}` : "",
        ].filter(Boolean).join("\n"),
        actionUrl: "/dashboard/calendar",
      });
    }

    return NextResponse.json({ ok: true, sent: upcoming.length });
  } catch (err) {
    console.error("Calendar alerts error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
