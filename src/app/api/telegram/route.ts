import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { fetchCryptoPrices } from "@/lib/crypto";
import { chatWithMax } from "@/lib/gemini";

const BOT_TOKEN       = process.env.TELEGRAM_BOT_TOKEN;
const ALLOWED_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function send(chatId: string, text: string) {
  if (!BOT_TOKEN) return;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  });
}

/* ── Exported helper so other routes (briefing, etc.) can push notifications ── */
export async function sendNotification(text: string) {
  if (!BOT_TOKEN || !ALLOWED_CHAT_ID) return;
  await send(ALLOWED_CHAT_ID, text);
}

async function handleCommand(cmd: string): Promise<string> {
  const c = cmd.toLowerCase().trim();

  /* /start or /help */
  if (c === "/start" || c === "/help") {
    return [
      "*M.A.X. online.* Available commands:",
      "",
      "/status — today's habit summary",
      "/crypto — live BTC + XRP prices",
      "/goals  — active goals overview",
      "/help   — this menu",
    ].join("\n");
  }

  /* /status — habits */
  if (c === "/status" || c === "/habits") {
    const { data } = await supabase.from("habits").select("name,completed,streak");
    if (!data || data.length === 0) return "No habits tracked yet.";
    const done  = data.filter(h => h.completed).length;
    const total = data.length;
    const pct   = Math.round((done / total) * 100);
    const lines = data.map(h => `${h.completed ? "✅" : "⬜"} ${h.name}${h.streak > 1 ? ` 🔥${h.streak}` : ""}`);
    return [`*Habits — Today* (${done}/${total} · ${pct}%)`, "", ...lines].join("\n");
  }

  /* /crypto */
  if (c === "/crypto" || c === "/btc" || c === "/xrp") {
    try {
      const prices = await fetchCryptoPrices();
      const btc = prices.find(p => p.symbol === "BTC");
      const xrp = prices.find(p => p.symbol === "XRP");
      const fmt = (n: number) => (n >= 0 ? `+${n.toFixed(2)}` : n.toFixed(2));
      return [
        "*Crypto — Live*",
        btc ? `BTC  $${Math.round(btc.price).toLocaleString()}  (${fmt(btc.change24h)}% 24h)` : "",
        xrp ? `XRP  $${xrp.price.toFixed(4)}  (${fmt(xrp.change24h)}% 24h)` : "",
      ].filter(Boolean).join("\n");
    } catch {
      return "Crypto data temporarily unavailable.";
    }
  }

  /* /goals */
  if (c === "/goals") {
    const { data } = await supabase.from("goals").select("*");
    if (!data || data.length === 0) return "No goals tracked yet.";
    const lines = data.slice(0, 5).map(g => {
      const pct = g.target > 0 ? Math.round((g.current / g.target) * 100) : 0;
      return `• ${g.label ?? g.id}: ${pct}%`;
    });
    return ["*Active Goals*", "", ...lines].join("\n");
  }

  return null as unknown as string;
}

export async function POST(request: Request) {
  try {
    const body    = await request.json();
    const message = body?.message;
    if (!message) return NextResponse.json({ ok: true });

    const chatId = message.chat?.id?.toString();
    const fromId = message.from?.id?.toString();
    const text   = (message.text ?? "").trim();

    if (ALLOWED_CHAT_ID && fromId !== ALLOWED_CHAT_ID) {
      await send(chatId, "Unauthorized.");
      return NextResponse.json({ ok: true });
    }

    /* Handle built-in commands */
    if (text.startsWith("/")) {
      const reply = await handleCommand(text);
      await send(chatId, reply || "Unknown command. Try /help");
      return NextResponse.json({ ok: true });
    }

    /* AI chat */
    try {
      const reply = await chatWithMax([{ role: "user", content: text }]);
      await send(chatId, reply);
    } catch (err) {
      console.error("Telegram AI error:", err);
      await send(chatId, "M.A.X. encountered an error. Try again.");
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Telegram webhook error:", err);
    return NextResponse.json({ ok: true }); // always 200 to Telegram
  }
}
