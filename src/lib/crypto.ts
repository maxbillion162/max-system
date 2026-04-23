export interface CryptoAsset {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  change7d: number;
  marketCap: number;
  sparkline?: number[];
}

export async function fetchCryptoPrices(): Promise<CryptoAsset[]> {
  const cmcKey = process.env.CMC_API_KEY;

  // Primary: CoinMarketCap for accurate prices + changes
  const cmcRes = await fetch(
    "https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=BTC,XRP&convert=USD",
    {
      headers: { "X-CMC_PRO_API_KEY": cmcKey ?? "", Accept: "application/json" },
      cache: "no-store",
    }
  );

  if (!cmcRes.ok) throw new Error(`CoinMarketCap error: ${cmcRes.status}`);
  const cmcData = await cmcRes.json();

  // Secondary: CoinGecko sparklines (free, no key required)
  const sparklines: Record<string, number[]> = {};
  try {
    const cgRes = await fetch(
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ripple&sparkline=true",
      { cache: "no-store" }
    );
    if (cgRes.ok) {
      const cgData = await cgRes.json();
      for (const c of cgData) {
        sparklines[(c.symbol as string).toUpperCase()] = (c.sparkline_in_7d as { price: number[] })?.price ?? [];
      }
    }
  } catch {}

  return ["BTC", "XRP"].map(sym => {
    const d = cmcData.data?.[sym];
    if (!d) return { id: sym.toLowerCase(), symbol: sym, name: sym, price: 0, change24h: 0, change7d: 0, marketCap: 0, sparkline: [] };
    const q = d.quote.USD;
    return {
      id: sym.toLowerCase(),
      symbol: sym,
      name: d.name as string,
      price: q.price as number,
      change24h: (q.percent_change_24h as number) ?? 0,
      change7d: (q.percent_change_7d as number) ?? 0,
      marketCap: (q.market_cap as number) ?? 0,
      sparkline: sparklines[sym] ?? [],
    };
  });
}
