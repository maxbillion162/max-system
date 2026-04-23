import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { text, now } = await req.json();

  const prompt = `Parse this natural language event into JSON. Current date/time: ${now} (America/New_York timezone).

Input: "${text}"

Return ONLY valid JSON, no markdown:
{"title":"string","start":"ISO8601 datetime with -05:00 or -04:00 offset","end":"ISO8601 datetime","location":null,"description":null}

Rules:
- If no date → use tomorrow
- If no time → 9:00 AM
- If no duration → end = start + 1 hour
- Convert day names (Monday, Friday, etc.) to actual dates relative to now
- Meetings/calls → 30 min; dinner/lunch → 1.5 hours; gym → 1 hour; everything else → 1 hour`;

  try {
    const response = await ai.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = (response.content[0] as { text: string }).text.trim();
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("no JSON");
    return NextResponse.json(JSON.parse(match[0]));
  } catch {
    return NextResponse.json({ error: "Could not parse event" }, { status: 400 });
  }
}
