import { NextResponse } from "next/server";
import { runAgent } from "@/lib/max-agent";
import { isOptedIn, notify } from "@/lib/notify";

export async function GET(req: Request) {
  if (req.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Skip expensive agent run if user isn't opted in
  if (!(await isOptedIn("evening_checkin"))) return NextResponse.json({ sent: false, reason: "not opted in" });

  try {
    const message = await runAgent([{
      role: "user",
      content: `It's evening check-in time. Give Max a personalized nightly wrap-up via Telegram. Pull today's habits completion, any open high-priority tasks, crypto performance today, and how budget spending is tracking. Then give 1-2 forward-looking action items for tomorrow morning. Keep it tight — under 200 words, no fluff. Format for Telegram (no markdown tables). Send it via Telegram after generating.`,
    }], true);

    await notify({
      category: "evening_checkin",
      title:    "Evening Check-in",
      body:     message.length > 240 ? message.slice(0, 237) + "…" : message,
      telegramText: message,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
