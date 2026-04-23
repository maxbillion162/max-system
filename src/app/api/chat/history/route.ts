import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("role,content,created_at")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) return NextResponse.json({ messages: [] });

  const messages = (data ?? []).reverse().map(r => ({
    role:    r.role === "assistant" ? "max" : "user",
    content: r.content,
    time:    new Date(r.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
  }));

  return NextResponse.json({ messages });
}
