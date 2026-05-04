import { NextResponse } from "next/server";
import { notify } from "@/lib/notify";
import { requireCron } from "@/lib/auth-guards";
import { supabase } from "@/lib/supabase";

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

export async function GET(req: Request) {
  const guard = requireCron(req); if (guard) return guard;
  // Note: we always fetch + snapshot market data (it powers dashboard tiles).
  // The notify() call below handles the opt-in gate for the Telegram push.

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

  // Notify (no-ops unless opted in via Settings)
  const fmt = (n: number) => (n >= 0 ? `+${n.toFixed(2)}%` : `${n.toFixed(2)}%`);
  const topMover = [spy, qqq, dia].filter(Boolean).sort((a, b) => Math.abs((b!.changePct) - (a!.changePct)))[0];
  await notify({
    category: "market_update",
    title:    "2PM Market Update",
    body:     topMover ? `Biggest move: ${fmt(topMover.changePct)}` : "Market update.",
    telegramText: [
      `📈 *2PM Market Update*`,
      ``,
      spy ? `S&P 500 (SPY): $${spy.price.toFixed(2)} ${fmt(spy.changePct)}` : null,
      qqq ? `NASDAQ (QQQ): $${qqq.price.toFixed(2)} ${fmt(qqq.changePct)}` : null,
      dia ? `Dow (DIA): $${dia.price.toFixed(2)} ${fmt(dia.changePct)}` : null,
    ].filter(Boolean).join("\n"),
    actionUrl: "/dashboard/finance",
  });

  return NextResponse.json({ ok: true, indices: { SPY: !!spy, QQQ: !!qqq, DIA: !!dia }, updated: new Date().toISOString() });
}
