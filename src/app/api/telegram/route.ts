import { NextResponse } from "next/server";
import { chatWithMax } from "@/lib/gemini";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ALLOWED_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function sendTelegramMessage(chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const message = body?.message;

    if (!message) return NextResponse.json({ ok: true });

    const chatId  = message.chat?.id?.toString();
    const text    = message.text ?? "";
    const fromId  = message.from?.id?.toString();

    // Only respond to the authorized user
    if (ALLOWED_CHAT_ID && fromId !== ALLOWED_CHAT_ID) {
      await sendTelegramMessage(chatId, "Unauthorized.");
      return NextResponse.json({ ok: true });
    }

    if (!text || text === "/start") {
      await sendTelegramMessage(chatId, "M.A.X. online. What do you need?");
      return NextResponse.json({ ok: true });
    }

    // Get reply from Gemini
    const reply = await chatWithMax([{ role: "user", content: text }]);
    await sendTelegramMessage(chatId, reply);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Telegram webhook error:", err);
    return NextResponse.json({ ok: true }); // Always return 200 to Telegram
  }
}
