import { NextResponse } from "next/server";
import { fetchCryptoPrices } from "@/lib/crypto";
import { requireCron } from "@/lib/auth-guards";
import { supabase } from "@/lib/supabase";

export async function GET(req: Request) {
  const guard = requireCron(req); if (guard) return guard;
  const [wealthRes, iraRes, cryptoRes] = await Promise.allSettled([
    supabase.from("wealth").select("ira,savings,btc_amount,xrp_amount").eq("id", "max").single(),
    supabase.from("ira_funds").select("value"),
    fetchCryptoPrices(),
  ]);

  const wealth = wealthRes.status === "fulfilled" ? wealthRes.value.data : null;
  const ira    = iraRes.status   === "fulfilled" ? iraRes.value.data ?? [] : [];
  const crypto = cryptoRes.status === "fulfilled" ? cryptoRes.value : [];

  if (!wealth) return NextResponse.json({ error: "No wealth data" }, { status: 500 });

  const btcPrice = crypto.find(c => c.symbol === "BTC")?.price ?? 0;
  const xrpPrice = crypto.find(c => c.symbol === "XRP")?.price ?? 0;

  const cryptoTotal = (btcPrice * wealth.btc_amount) + (xrpPrice * wealth.xrp_amount);
  const iraTotal    = ira.reduce((s: number, f: { value: number }) => s + f.value, 0);
  const netWorth    = cryptoTotal + iraTotal + wealth.savings;

  await supabase.from("wealth_history").insert({
    recorded_at:  new Date().toISOString(),
    net_worth:    parseFloat(netWorth.toFixed(2)),
    crypto_total: parseFloat(cryptoTotal.toFixed(2)),
    ira_total:    parseFloat(iraTotal.toFixed(2)),
    savings:      wealth.savings,
  });

  return NextResponse.json({ ok: true, net_worth: netWorth });
}
