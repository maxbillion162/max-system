import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

interface HealthPayload {
  steps?: number;
  activeCalories?: number;
  heartRateAvg?: number;
  sleepHours?: number;
  workoutMinutes?: number;
  date?: string;
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-health-secret");
  if (secret !== process.env.HEALTH_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: HealthPayload = await req.json();
    const date = body.date ?? new Date().toISOString().slice(0, 10);

    await sb.from("settings").upsert(
      { key: `health_${date}`, value: body },
      { onConflict: "key" },
    );

    if (body.steps && body.steps > 10000) {
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          text: `💪 10K steps hit today — ${body.steps.toLocaleString()} total. Let's go.`,
        }),
      });
    }

    return NextResponse.json({ ok: true, date });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function GET() {
  const { data } = await sb.from("settings")
    .select("key,value")
    .like("key", "health_%")
    .order("key", { ascending: false })
    .limit(7);
  return NextResponse.json({ data: data ?? [] });
}
