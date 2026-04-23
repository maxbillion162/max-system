import { NextResponse } from "next/server";
import { runAgent } from "@/lib/max-agent";

export async function GET(req: Request) {
  if (req.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
