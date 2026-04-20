import { NextResponse } from "next/server";
import { fetchCryptoPrices } from "@/lib/crypto";

export async function GET() {
  try {
    const data = await fetchCryptoPrices();
    return NextResponse.json({ data });
  } catch (err) {
    console.error("Crypto fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch crypto prices" }, { status: 500 });
  }
}
