import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  const today = new Date().toISOString().slice(0, 10);

  const { data: habits } = await supabase.from("habits").select("id, name");
  if (!habits?.length) return NextResponse.json({ sent: false, reason: "no habits" });

  const { data: logs } = await supabase
    .from("habit_logs")
    .select("habit_id")
    .eq("date", today)
    .eq("completed", true);

  const doneIds = new Set((logs ?? []).map((l: { habit_id: string }) => l.habit_id));
  const incomplete = habits.filter(h => !doneIds.has(h.id));

  if (!incomplete.length) return NextResponse.json({ sent: false, reason: "all done" });

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID   = process.env.TELEGRAM_CHAT_ID;
  if (!BOT_TOKEN || !CHAT_ID) return NextResponse.json({ sent: false, reason: "no telegram config" });

  const list = incomplete.map(h => `• ${h.name}`).join("\n");
  const msg  = `⏰ *9PM Check-in* — ${incomplete.length} habit${incomplete.length !== 1 ? "s" : ""} still open today:\n\n${list}\n\nYou've still got time. Lock it in.`;

  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHAT_ID, text: msg, parse_mode: "Markdown" }),
  });

  return NextResponse.json({ sent: true, incomplete: incomplete.length });
}
