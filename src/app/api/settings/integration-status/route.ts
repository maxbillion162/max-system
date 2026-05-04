import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  try {
    const [{ data: tokens }, { count }] = await Promise.all([
      supabase.from("google_tokens").select("id").limit(1),
      supabase.from("accounts").select("id", { count: "exact", head: true }),
    ]);
    return NextResponse.json({
      google: !!(tokens && tokens.length > 0),
      plaid: count ?? 0,
    });
  } catch {
    return NextResponse.json({ google: false, plaid: 0 });
  }
}
