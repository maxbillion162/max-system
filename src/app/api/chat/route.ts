import { NextResponse } from "next/server";
import { chatWithMax } from "@/lib/gemini";
import type { ChatMessage } from "@/lib/gemini";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const messages: ChatMessage[] = body.messages;

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: "No messages provided" }, { status: 400 });
    }

    const reply = await chatWithMax(messages);
    return NextResponse.json({ reply });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Chat error:", msg);
    return NextResponse.json({ error: "Chat failed", detail: msg }, { status: 500 });
  }
}
