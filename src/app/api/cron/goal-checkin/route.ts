import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  // OPT-IN: skip unless explicitly enabled in Settings
  const { data: prefRow } = await supabase.from("settings").select("value").eq("key", "notification_prefs").single();
  const prefs = (prefRow?.value ?? {}) as { goal_checkin?: boolean };
  if (prefs.goal_checkin !== true) return NextResponse.json({ sent: false, reason: "not opted in" });

  const { data: goals } = await supabase
    .from("goals")
    .select("id,label,current,target,unit,deadline,category");

  if (!goals?.length) return NextResponse.json({ sent: false, reason: "no goals" });

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID   = process.env.TELEGRAM_CHAT_ID;
  if (!BOT_TOKEN || !CHAT_ID) return NextResponse.json({ sent: false, reason: "no telegram config" });

  const now = new Date();
  const quarter = Math.floor(now.getMonth() / 3) + 1;

  const lines = goals.map(g => {
    const pct = Math.min(100, Math.round((Number(g.current) / Number(g.target)) * 100));
    const val = g.unit === "$"
      ? `$${Number(g.current).toLocaleString()} / $${Number(g.target).toLocaleString()}`
      : `${g.current}/${g.target} ${g.unit}`;
    const icon = pct >= 75 ? "🟢" : pct >= 40 ? "🟡" : "🔴";
    return `${icon} *${g.label}* — ${pct}% (${val})`;
  }).join("\n");

  const onTrack = goals.filter(g => Math.min(100, (Number(g.current) / Number(g.target)) * 100) >= 50).length;

  const msg = `📊 *Quarterly Check-in — Q${quarter} ${now.getFullYear()}*\n\n${lines}\n\n${onTrack}/${goals.length} goals at or above 50%.\n\n${onTrack === goals.length ? "All goals on track. Keep the momentum." : "Time to close the gaps. What's the move?"}`;

  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHAT_ID, text: msg, parse_mode: "Markdown" }),
  });

  return NextResponse.json({ sent: true, goals: goals.length, quarter });
}
