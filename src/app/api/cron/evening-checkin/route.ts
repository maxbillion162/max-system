import { NextResponse } from "next/server";
import { runAgent } from "@/lib/max-agent";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: Request) {
  if (req.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // OPT-IN: skip unless explicitly enabled in Settings
  const { data: prefRow } = await supabase.from("settings").select("value").eq("key", "notification_prefs").single();
  const prefs = (prefRow?.value ?? {}) as { evening_checkin?: boolean };
  if (prefs.evening_checkin !== true) return NextResponse.json({ sent: false, reason: "not opted in" });

  try {
    const message = await runAgent([{
      role: "user",
      content: `It's evening check-in time. Give Max a personalized nightly wrap-up via Telegram. Pull today's habits completion, any open high-priority tasks, crypto performance today, and how budget spending is tracking. Then give 1-2 forward-looking action items for tomorrow morning. Keep it tight — under 200 words, no fluff. Format for Telegram (no markdown tables). Send it via Telegram after generating.`,
    }], true);

    const BOT = process.env.TELEGRAM_BOT_TOKEN;
    const CID = process.env.TELEGRAM_CHAT_ID;
    if (BOT && CID) {
      await fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: CID, text: message, parse_mode: "Markdown" }),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
