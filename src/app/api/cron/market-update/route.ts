import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const AV_KEY = process.env.ALPHA_VANTAGE_KEY;

async function avQuote(symbol: string): Promise<{ price: number; change: number; changePct: number } | null> {
  try {
    const res = await fetch(
      `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${AV_KEY}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const q = data["Global Quote"];
    if (!q || !q["05. price"]) return null;
    return {
      price: parseFloat(q["05. price"]),
      change: parseFloat(q["09. change"]),
      changePct: parseFloat(q["10. change percent"]?.replace("%", "") ?? "0"),
    };
  } catch {
    return null;
  }
}

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID   = process.env.TELEGRAM_CHAT_ID;

export async function GET() {
  // Check notification prefs
  const { data: prefRow } = await supabase.from("settings").select("value").eq("key", "notification_prefs").single();
  const prefs = (prefRow?.value ?? {}) as { market_update?: boolean };

  // Fetch market indices (ETF proxies) + crypto
  const [spy, qqq, dia] = await Promise.all([avQuote("SPY"), avQuote("QQQ"), avQuote("DIA")]);

  const snapshot = {
    SPY: spy ? { symbol: "SPY", name: "S&P 500", ...spy } : null,
    QQQ: qqq ? { symbol: "QQQ", name: "NASDAQ",  ...qqq } : null,
    DIA: dia ? { symbol: "DIA", name: "Dow Jones",...dia } : null,
    updated: new Date().toISOString(),
  };

  await supabase.from("settings").upsert({ key: "market_snapshot", value: snapshot });

  // Fetch IRA fund NAVs
  const { data: iraFunds } = await supabase.from("ira_funds").select("*");
  if (iraFunds) {
    for (const fund of iraFunds) {
      const quote = await avQuote(fund.symbol);
      if (!quote) continue;
      const newValue = quote.price * fund.shares;
      await supabase.from("ira_funds").update({ nav: quote.price, chg: quote.changePct, value: parseFloat(newValue.toFixed(2)) }).eq("symbol", fund.symbol);
    }
  }

  // Send Telegram update (if enabled)
  if (prefs.market_update !== false && BOT_TOKEN && CHAT_ID) {
    const fmt = (n: number) => (n >= 0 ? `+${n.toFixed(2)}%` : `${n.toFixed(2)}%`);
    const lines = [
      `📈 *2PM Market Update*`,
      ``,
      spy ? `S&P 500 (SPY): $${spy.price.toFixed(2)} ${fmt(spy.changePct)}` : null,
      qqq ? `NASDAQ (QQQ): $${qqq.price.toFixed(2)} ${fmt(qqq.changePct)}` : null,
      dia ? `Dow (DIA): $${dia.price.toFixed(2)} ${fmt(dia.changePct)}` : null,
    ].filter(Boolean).join("\n");

    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CHAT_ID, text: lines, parse_mode: "Markdown" }),
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, indices: { SPY: !!spy, QQQ: !!qqq, DIA: !!dia }, updated: new Date().toISOString() });
}
