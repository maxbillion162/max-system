import { runAgentStream, AgentEvent, AgentMessage } from "@/lib/max-agent";
import { supabase } from "@/lib/supabase";
export async function POST(request: Request) {
  try {
    const body       = await request.json();
    const messages   = body.messages ?? [];
    const session_id = body.session_id as string | undefined;

    if (messages.length === 0) {
      return new Response(JSON.stringify({ error: "No messages provided" }), { status: 400 });
    }

    const normalized: AgentMessage[] = messages.map((m: { role: string; content: string }) => ({
      role: (m.role === "model" ? "assistant" : m.role) as "user" | "assistant",
      content: m.content,
    }));

    const encoder  = new TextEncoder();
    let   fullText = "";

    const stream = new ReadableStream({
      async start(controller) {
        function send(event: AgentEvent) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        }

        try {
          await runAgentStream(normalized, true, (event) => {
            send(event);
            if (event.t === "done") fullText = event.full;
          });

        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          send({ t: "chunk", text: `Error: ${msg}` });
          send({ t: "done", full: `Error: ${msg}`, tools: [] });
          fullText = `Error: ${msg}`;
        } finally {
          // Persist after streaming completes
          if (normalized.length > 0) {
            const last = normalized[normalized.length - 1];
            if (last.role === "user" && fullText) {
              await supabase.from("chat_messages").insert([
                { role: "user",      content: last.content },
                { role: "assistant", content: fullText     },
              ]).then(() => {}, () => {}); // non-fatal
            }
          }
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type":  "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection":    "keep-alive",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Chat error:", msg);
    return new Response(JSON.stringify({ error: "Chat failed", detail: msg }), { status: 500 });
  }
}
