import { NextResponse } from "next/server";
import { plaidClient, plaidConfigured } from "@/lib/plaid";
import { CountryCode, Products } from "plaid";

export async function POST() {
  if (!plaidConfigured()) {
    return NextResponse.json({ error: "Plaid not configured" }, { status: 503 });
  }

  try {
    const res = await plaidClient.linkTokenCreate({
      user: { client_user_id: "max" },
      client_name: "M.A.X.",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: "en",
    });
    return NextResponse.json({ link_token: res.data.link_token });
  } catch (err) {
    console.error("Plaid link token error:", err);
    return NextResponse.json({ error: "Failed to create link token" }, { status: 500 });
  }
}
