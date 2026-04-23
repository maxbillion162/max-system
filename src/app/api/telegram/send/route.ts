import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { text } = await request.json() as { text: string };
  if (!text?.trim()) return NextResponse.json({ ok: false, error: "No text" }, { status: 400 });

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID   = process.env.TELEGRAM_CHAT_ID;
  if (!BOT_TOKEN || !CHAT_ID) return NextResponse.json({ ok: false, error: "Not configured" }, { status: 400 });

  const msg = `📋 *Saved from M.A.X. Chat*\n\n${text.slice(0, 3000)}`;
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHAT_ID, text: msg, parse_mode: "Markdown" }),
  });
  const json = await res.json();
  return NextResponse.json({ ok: json.ok });
}
