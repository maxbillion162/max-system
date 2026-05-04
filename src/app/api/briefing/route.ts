import { NextResponse } from "next/server";
import { Resend } from "resend";
import { fetchWeather } from "@/lib/weather";
import { fetchCryptoPrices } from "@/lib/crypto";
import { fetchNews } from "@/lib/news";
import { buildBriefingEmail } from "@/lib/briefing";
import { createClient } from "@supabase/supabase-js";
import { readCalendar } from "@/lib/max-tools";
import type { WeatherData } from "@/lib/weather";
import { requireCron } from "@/lib/auth-guards";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const WEATHER_FALLBACK: WeatherData = {
  location: "Orlando", tempF: 82, feelsLikeF: 88, condition: "Partly cloudy",
  conditionCode: 2, precipChance: 20, windMph: 10, humidity: 65,
  forecast: [
    { day: "Today", high: 84, low: 72, precipChance: 20, code: 2 },
    { day: "Tue",   high: 83, low: 71, precipChance: 15, code: 0 },
    { day: "Wed",   high: 86, low: 73, precipChance: 30, code: 3 },
    { day: "Thu",   high: 80, low: 70, precipChance: 40, code: 61 },
    { day: "Fri",   high: 82, low: 71, precipChance: 25, code: 2 },
  ],
};

async function runBriefing() {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) throw new Error("RESEND_API_KEY not configured");

  const today = new Date();
  const todayStr = today.toLocaleDateString("en-CA", { timeZone: "America/New_York" });

  const [weatherResult, cryptoResult, newsResult, habitsResult, tasksResult, calResult] = await Promise.allSettled([
    fetchWeather("orlando"),
    fetchCryptoPrices(),
    fetchNews(8),
    supabase.from("habits").select("name,completed,streak").order("created_at"),
    supabase.from("tasks").select("text,priority,due_date,completed").eq("completed", false).order("created_at"),
    readCalendar(1),
  ]);

  const weather = weatherResult.status === "fulfilled" ? weatherResult.value : WEATHER_FALLBACK;
  const crypto  = cryptoResult.status  === "fulfilled" ? cryptoResult.value  : [];
  const news    = newsResult.status    === "fulfilled" ? newsResult.value    : [];
  const habits  = habitsResult.status  === "fulfilled" ? (habitsResult.value.data ?? []) : [];
  const tasks   = tasksResult.status   === "fulfilled" ? (tasksResult.value.data ?? [])  : [];

  // Filter to today's calendar events
  const calendarEvents = calResult.status === "fulfilled" && calResult.value.connected
    ? calResult.value.events.filter((e: { start: string; allDay: boolean }) => {
        const start = new Date(e.allDay ? e.start + "T00:00:00" : e.start);
        return start.toLocaleDateString("en-CA", { timeZone: "America/New_York" }) === todayStr;
      })
    : [];

  const date = today.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York",
  });

  const html = buildBriefingEmail({ weather, crypto, news, date, habits, tasks, calendarEvents });

  const resend = new Resend(resendKey);
  const { data, error } = await resend.emails.send({
    from:    "M.A.X. <onboarding@resend.dev>",
    to:      ["maxbillion2003@gmail.com"],
    subject: `M.A.X. Daily Briefing — ${date}`,
    html,
  });

  if (error) throw new Error(`Email send failed: ${JSON.stringify(error)}`);
  return { success: true, emailId: data?.id };
}

// GET — called by Vercel cron at 7am ET daily
export async function GET(req: Request) {
  const guard = requireCron(req); if (guard) return guard;
  try {
    const result = await runBriefing();
    return NextResponse.json(result);
  } catch (err) {
    console.error("Briefing cron error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// POST — manual trigger from dashboard
export async function POST() {
  try {
    const result = await runBriefing();
    return NextResponse.json(result);
  } catch (err) {
    console.error("Briefing error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
