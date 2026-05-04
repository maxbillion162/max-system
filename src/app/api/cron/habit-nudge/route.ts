import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isOptedIn, notify } from "@/lib/notify";
import { requireCron } from "@/lib/auth-guards";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: Request) {
  const guard = requireCron(req); if (guard) return guard;
  if (!(await isOptedIn("habit_nudge"))) return NextResponse.json({ sent: false, reason: "not opted in" });

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

  const list = incomplete.map(h => `• ${h.name}`).join("\n");

  await notify({
    category: "habit_nudge",
    title:    `${incomplete.length} habit${incomplete.length !== 1 ? "s" : ""} still open`,
    body:     `${incomplete.length} habit${incomplete.length !== 1 ? "s" : ""} not done yet today.`,
    telegramText: `⏰ *9PM Check-in* — ${incomplete.length} habit${incomplete.length !== 1 ? "s" : ""} still open today:\n\n${list}\n\nYou've still got time. Lock it in.`,
    actionUrl: "/dashboard/habits",
  });

  return NextResponse.json({ sent: true, incomplete: incomplete.length });
}
