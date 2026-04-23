import { NextResponse } from "next/server";

export async function POST() {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID   = process.env.TELEGRAM_CHAT_ID;
  if (!BOT_TOKEN || !CHAT_ID) return NextResponse.json({ ok: false, error: "Telegram not configured" }, { status: 400 });

  const msg = `✅ *M.A.X. Test Message*\n\nTelegram notifications are working correctly.\n\n_Sent from Settings_`;
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHAT_ID, text: msg, parse_mode: "Markdown" }),
  });
  const json = await res.json();
  return NextResponse.json({ ok: json.ok });
}
