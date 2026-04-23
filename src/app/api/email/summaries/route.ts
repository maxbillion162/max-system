import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { emails } = await req.json();
  if (!emails?.length) return NextResponse.json({ summaries: {} });

  const list = (emails as { id: string; from: string; subject: string; preview: string }[])
    .slice(0, 25)
    .map((e, i) => `[${i}] ID:${e.id}\nFrom:${e.from}\nSubject:${e.subject}\nSnippet:${e.preview.slice(0, 100)}`)
    .join("\n\n");

  const prompt = `Summarize each email in ONE sentence under 12 words. Be specific — state the actual ask or info, not generic filler.

${list}

Return ONLY valid JSON mapping each ID to its summary: {"id1":"summary","id2":"summary"}`;

  try {
    const response = await ai.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = (response.content[0] as { text: string }).text.trim();
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return NextResponse.json({ summaries: {} });
    return NextResponse.json({ summaries: JSON.parse(match[0]) });
  } catch {
    return NextResponse.json({ summaries: {} });
  }
}
