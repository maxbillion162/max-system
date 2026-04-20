export interface CryptoAsset {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  change7d: number;
  marketCap: number;
}

const COIN_IDS = "bitcoin,ripple";

export async function fetchCryptoPrices(): Promise<CryptoAsset[]> {
  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${COIN_IDS}&order=market_cap_desc&sparkline=true&price_change_percentage=24h,7d`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 60 }, // cache 60 seconds
  });

  if (!res.ok) throw new Error(`CoinGecko error: ${res.status}`);

  const data = await res.json();

  return data.map((c: Record<string, unknown>) => ({
    id: c.id as string,
    symbol: (c.symbol as string).toUpperCase(),
    name: c.name as string,
    price: c.current_price as number,
    change24h: c.price_change_percentage_24h as number ?? 0,
    change7d: c.price_change_percentage_7d_in_currency as number ?? 0,
    marketCap: c.market_cap as number,
    sparkline: (c.sparkline_in_7d as { price: number[] })?.price ?? [],
  }));
}
