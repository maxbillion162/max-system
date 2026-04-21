import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: Request) {
  try {
    const { articles } = await request.json() as {
      articles: { title: string; source: string; tag: string; snippet?: string; breaking?: boolean }[];
    };
    if (!articles?.length) return NextResponse.json({ summary: "" });

    // Prioritize: crypto, AI, finance, breaking — things that affect Max directly
    const prioritized = [
      ...articles.filter(a => a.tag === "Crypto" || a.title.toLowerCase().includes("btc") || a.title.toLowerCase().includes("xrp") || a.title.toLowerCase().includes("bitcoin")),
      ...articles.filter(a => a.tag === "AI" || a.tag === "Finance" || a.breaking),
      ...articles.filter(a => a.tag === "Markets" || a.tag === "Tech"),
    ]
      .filter((a, i, arr) => arr.findIndex(b => b.title === a.title) === i)
      .slice(0, 12);

    const list = prioritized.map(a => `[${a.tag}] ${a.title}${a.snippet ? " — " + a.snippet.slice(0, 100) : ""}`).join("\n");

    const res = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      messages: [{
        role: "user",
        content: `You are M.A.X., personal AI for Max — 22yo in Orlando, holds BTC + XRP, starting sales job July 2026, learning AI/entrepreneurship, $10K emergency fund goal.

News right now:
${list}

Write a 2-3 sentence briefing of what matters TO MAX specifically. Lead with anything crypto/market-moving. Skip generic politics or soft news. Be direct, no fluff. No headers. Just the paragraph.`,
      }],
    });

    const summary = (res.content.find(b => b.type === "text") as Anthropic.TextBlock | undefined)?.text ?? "";
    return NextResponse.json({ summary });
  } catch (err) {
    console.error("Feed summary error:", err);
    return NextResponse.json({ summary: "" });
  }
}
