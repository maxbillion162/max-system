import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: Request) {
  try {
    const { from, subject, body } = await request.json() as {
      from: string; subject: string; body: string;
    };

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{
        role: "user",
        content: `Write a concise, professional email reply on behalf of Max (22-year-old Account Manager).

Email from: ${from}
Subject: ${subject}
Email content:
${body}

Write a direct, professional reply. No fluff. Keep it under 100 words unless a detailed response is genuinely needed. Don't include a subject line or "Dear" opener — just the body. Sign off as "Max".`,
      }],
    });

    const text = response.content[0]?.type === "text" ? response.content[0].text : "";
    return NextResponse.json({ reply: text });
  } catch (err) {
    return NextResponse.json({ reply: "" }, { status: 500 });
  }
}
