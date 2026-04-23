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

export async function GET() {
  // Fetch market indices (ETF proxies)
  const [spy, qqq, dia] = await Promise.all([
    avQuote("SPY"),
    avQuote("QQQ"),
    avQuote("DIA"),
  ]);

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

  return NextResponse.json({ ok: true, indices: { SPY: !!spy, QQQ: !!qqq, DIA: !!dia }, updated: new Date().toISOString() });
}
