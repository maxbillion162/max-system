import { NextResponse } from "next/server";
import { runAgent } from "@/lib/max-agent";

/**
 * Conversational Finance Bar endpoint.
 *
 * Pipes a natural-language question to M.A.X. with the standard finance
 * context already injected by buildContextHeader() inside runAgent. The
 * answer comes back short — finance bar is for quick lookups, not essays.
 */
export async function POST(req: Request) {
  try {
    const { query } = await req.json() as { query?: string };
    if (!query || !query.trim()) {
      return NextResponse.json({ error: "query required" }, { status: 400 });
    }

    const prompt = [
      `[FINANCE QUERY BAR — Max is asking about his money on the Finance page.]`,
      ``,
      query.trim(),
      ``,
      `Answer in 1-3 sentences. Lead with the number. Plain text — no markdown headers, no bullet lists. Pull live data via tools (transactions, budget, wealth, bills) before answering — don't guess.`,
    ].join("\n");

    const answer = await runAgent(
      [{ role: "user" as const, content: prompt }],
      true,
    );

    return NextResponse.json({ answer });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
