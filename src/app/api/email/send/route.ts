import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/max-tools";

/**
 * Real Gmail send. Called only by explicit user action — never by the agent
 * directly. The agent must route through pending_actions (Tier-3 Telegram
 * confirmation), which then calls sendEmail() under the hood.
 *
 * POST { to, subject, body, threadId?, inReplyTo?, cc?, bcc? }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      to?: string; subject?: string; body?: string;
      threadId?: string; inReplyTo?: string;
      cc?: string; bcc?: string;
    };

    if (!body.to?.trim() || !body.subject?.trim() || !body.body?.trim()) {
      return NextResponse.json({ error: "to + subject + body required" }, { status: 400 });
    }

    const r = await sendEmail({
      to:        body.to.trim(),
      subject:   body.subject.trim(),
      body:      body.body,
      threadId:  body.threadId,
      inReplyTo: body.inReplyTo,
      cc:        body.cc?.trim(),
      bcc:       body.bcc?.trim(),
    });

    if ((r as { error?: string }).error) {
      return NextResponse.json({ error: (r as { error: string }).error }, { status: 500 });
    }
    return NextResponse.json(r);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
