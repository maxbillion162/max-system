import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { decrypt } from "@/lib/encryption";

export async function GET() {
  const [chatRes, tgRes] = await Promise.all([
    supabase.from("chat_messages").select("*").order("created_at", { ascending: false }).limit(400),
    supabase.from("telegram_history").select("*").order("created_at", { ascending: false }).limit(200),
  ]);
  const chat = (chatRes.data ?? []).map(r => ({ ...r, content: decrypt(r.content) ?? "" }));
  const telegram = (tgRes.data ?? []).map(r => ({ ...r, content: decrypt(r.content) ?? "" }));
  return NextResponse.json({ chat, telegram });
}
