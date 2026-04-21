import { NextResponse } from "next/server";
import { runAgent } from "@/lib/max-agent";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const messages = body.messages ?? [];

    if (messages.length === 0) {
      return NextResponse.json({ error: "No messages provided" }, { status: 400 });
    }

    // Normalize roles — frontend sends "model", agent expects "assistant"
    const normalized = messages.map((m: { role: string; content: string }) => ({
      role: m.role === "model" ? "assistant" : m.role,
      content: m.content,
    }));

    const reply = await runAgent(normalized, true);
    return NextResponse.json({ reply });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Chat error:", msg);
    return NextResponse.json({ error: "Chat failed", detail: msg }, { status: 500 });
  }
}
