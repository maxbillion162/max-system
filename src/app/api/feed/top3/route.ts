import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: Request) {
  try {
    const { articles } = await request.json() as {
      articles: { title: string; source: string; tag: string; snippet?: string }[];
    };
    if (!articles?.length) return NextResponse.json({ picks: [] });

    const list = articles.slice(0, 25)
      .map((a, i) => `${i + 1}. [${a.tag}] ${a.title}${a.snippet ? " — " + a.snippet.slice(0, 80) : ""}`)
      .join("\n");

    const res = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{
        role: "user",
        content: `You are M.A.X., personal AI for Max — 22yo in Orlando, holds BTC + XRP, starting Account Manager job July 2026, learning AI/coding, building toward entrepreneurship.

Articles:
${list}

Pick the 3 most important/relevant articles for Max specifically. Return ONLY valid JSON array:
[{"idx":1,"reason":"one sentence why this matters to Max personally"}]

idx = article number (1-based). Be specific and direct. No fluff.`,
      }],
    });

    const text = (res.content.find(b => b.type === "text") as Anthropic.TextBlock | undefined)?.text ?? "[]";
    const match = text.match(/\[[\s\S]*?\]/);
    const picks = match ? JSON.parse(match[0]) : [];
    return NextResponse.json({ picks });
  } catch {
    return NextResponse.json({ picks: [] });
  }
}
