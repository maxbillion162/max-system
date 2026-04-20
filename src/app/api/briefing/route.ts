import { NextResponse } from "next/server";
import { Resend } from "resend";
import { fetchWeather } from "@/lib/weather";
import { fetchCryptoPrices } from "@/lib/crypto";
import { fetchNews } from "@/lib/news";
import { buildBriefingEmail } from "@/lib/briefing";
import type { WeatherData } from "@/lib/weather";
import type { CryptoAsset } from "@/lib/crypto";
import type { NewsItem } from "@/lib/news";

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

export async function POST() {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });
  }

  // Fetch each source independently — failures use fallbacks
  const [weatherResult, cryptoResult, newsResult] = await Promise.allSettled([
    fetchWeather("orlando"),
    fetchCryptoPrices(),
    fetchNews(8),
  ]);

  const weather: WeatherData    = weatherResult.status === "fulfilled" ? weatherResult.value : WEATHER_FALLBACK;
  const crypto:  CryptoAsset[]  = cryptoResult.status  === "fulfilled" ? cryptoResult.value  : [];
  const news:    NewsItem[]     = newsResult.status    === "fulfilled" ? newsResult.value    : [];

  const errors = [
    weatherResult.status === "rejected" ? `weather: ${weatherResult.reason}` : null,
    cryptoResult.status  === "rejected" ? `crypto: ${cryptoResult.reason}`   : null,
    newsResult.status    === "rejected" ? `news: ${newsResult.reason}`       : null,
  ].filter(Boolean);

  try {
    const date = new Date().toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    });

    const html = buildBriefingEmail({ weather, crypto, news, date });

    const resend = new Resend(resendKey);
    const { data, error } = await resend.emails.send({
      from:    "M.A.X. <onboarding@resend.dev>",
      to:      ["maxbillion2003@gmail.com"],
      subject: `M.A.X. Daily Briefing — ${date}`,
      html,
    });

    if (error) {
      return NextResponse.json({ error: "Email send failed", detail: error }, { status: 500 });
    }

    return NextResponse.json({ success: true, emailId: data?.id, warnings: errors });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Briefing build error:", msg);
    return NextResponse.json({ error: "Briefing build failed", detail: msg }, { status: 500 });
  }
}
