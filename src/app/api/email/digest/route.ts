import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: Request) {
  try {
    const { emails } = await request.json() as {
      emails: { from: string; subject: string; snippet: string; category: string }[];
    };

    if (!emails || emails.length === 0) {
      return NextResponse.json({ digest: "No emails to summarize.", actions: {} });
    }

    const actionEmails = emails.filter(e => e.category === "action").slice(0, 10);
    const fyiEmails    = emails.filter(e => e.category === "fyi").slice(0, 5);

    const emailList = [
      ...actionEmails.map(e => `[ACTION] From: ${e.from} | Subject: ${e.subject} | Preview: ${e.snippet?.slice(0, 150)}`),
      ...fyiEmails.map(e => `[FYI] From: ${e.from} | Subject: ${e.subject}`),
    ].join("\n");

    const res = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{
        role: "user",
        content: `You are M.A.X., a personal AI for Max. Analyze his inbox and respond with JSON only.

INBOX:
${emailList}

Return this exact JSON structure (no markdown, no explanation):
{
  "digest": "1-2 sentence plain-English summary of what Max needs to handle today from his inbox",
  "actions": {
    "email subject here": "one-line action Max needs to take"
  }
}

For "actions", only include [ACTION] emails. Be direct and specific. Max's tone: no fluff.`,
      }],
    });

    const text = res.content.find(b => b.type === "text")?.text ?? "{}";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("Email digest error:", err);
    return NextResponse.json({ digest: "Inbox digest unavailable.", actions: {} });
  }
}
