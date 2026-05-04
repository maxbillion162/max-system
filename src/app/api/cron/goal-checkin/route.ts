import { NextResponse } from "next/server";
import { isOptedIn, notify } from "@/lib/notify";
import { requireCron } from "@/lib/auth-guards";
import { supabase } from "@/lib/supabase";

export async function GET(req: Request) {
  const guard = requireCron(req); if (guard) return guard;
  if (!(await isOptedIn("goal_checkin"))) return NextResponse.json({ sent: false, reason: "not opted in" });

  const { data: goals } = await supabase
    .from("goals")
    .select("id,label,current,target,unit,deadline,category");

  if (!goals?.length) return NextResponse.json({ sent: false, reason: "no goals" });

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

  await notify({
    category: "goal_checkin",
    title:    `Quarterly Check-in — Q${quarter} ${now.getFullYear()}`,
    body:     `${onTrack}/${goals.length} goals at 50%+.`,
    telegramText: `📊 *Quarterly Check-in — Q${quarter} ${now.getFullYear()}*\n\n${lines}\n\n${onTrack}/${goals.length} goals at or above 50%.\n\n${onTrack === goals.length ? "All goals on track. Keep the momentum." : "Time to close the gaps. What's the move?"}`,
    actionUrl: "/dashboard/goals",
  });

  return NextResponse.json({ sent: true, goals: goals.length, quarter });
}
