import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
export const dynamic = "force-dynamic";

export async function GET() {
  const [snapshotRes, iraRes] = await Promise.allSettled([
    supabase.from("settings").select("value").eq("key", "market_snapshot").single(),
    supabase.from("ira_funds").select("*"),
  ]);

  const snapshot = snapshotRes.status === "fulfilled" ? snapshotRes.value.data?.value ?? null : null;
  const ira = iraRes.status === "fulfilled" ? iraRes.value.data ?? [] : [];

  return NextResponse.json({ snapshot, ira });
}
