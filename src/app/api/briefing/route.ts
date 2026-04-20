import { NextResponse } from "next/server";
import { Resend } from "resend";
import { fetchWeather } from "@/lib/weather";
import { fetchCryptoPrices } from "@/lib/crypto";
import { fetchNews } from "@/lib/news";
import { buildBriefingEmail } from "@/lib/briefing";

export async function POST() {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });
  }

  try {
    const [weather, crypto, news] = await Promise.all([
      fetchWeather("orlando"),
      fetchCryptoPrices(),
      fetchNews(8),
    ]);

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
      console.error("Resend error:", error);
      return NextResponse.json({ error: "Email send failed", detail: error }, { status: 500 });
    }

    return NextResponse.json({ success: true, emailId: data?.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Briefing error:", msg);
    return NextResponse.json({ error: "Briefing generation failed", detail: msg }, { status: 500 });
  }
}
