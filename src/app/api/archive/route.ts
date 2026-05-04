import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const [chatRes, tgRes] = await Promise.all([
    supabase.from("chat_messages").select("*").order("created_at", { ascending: false }).limit(400),
    supabase.from("telegram_history").select("*").order("created_at", { ascending: false }).limit(200),
  ]);
  return NextResponse.json({
    chat: chatRes.data ?? [],
    telegram: tgRes.data ?? [],
  });
}
