import { NextResponse } from "next/server";
import { runAgent } from "@/lib/max-agent";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const messages   = body.messages ?? [];
    const session_id = body.session_id as string | undefined;

    if (messages.length === 0) {
      return NextResponse.json({ error: "No messages provided" }, { status: 400 });
    }

    // Normalize roles — frontend sends "model", agent expects "assistant"
    const normalized = messages.map((m: { role: string; content: string }) => ({
      role: m.role === "model" ? "assistant" : m.role,
      content: m.content,
    }));

    const reply = await runAgent(normalized, true);

    // Persist the latest exchange to chat_history
    if (session_id && normalized.length > 0) {
      const last = normalized[normalized.length - 1];
      if (last.role === "user") {
        await supabase.from("chat_history").insert([
          { session_id, role: "user",      content: last.content },
          { session_id, role: "assistant", content: reply        },
        ]);
      }
    }

    return NextResponse.json({ reply });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Chat error:", msg);
    return NextResponse.json({ error: "Chat failed", detail: msg }, { status: 500 });
  }
}
