import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getAuthenticatedClient } from "@/lib/google";
import { extractBody } from "@/lib/email-intel";

/**
 * Email thread — fetches one Gmail thread with all messages + bodies.
 *
 * GET /api/email/thread/<thread_id>
 *   → { messages: [{ id, message_id, from, to, subject, date, body, snippet }] }
 *
 * Used by the EmailDetail panel to render the full conversation.
 */

interface Params { params: Promise<{ id: string }> }

function getHeader(headers: Array<{ name?: string | null; value?: string | null }>, name: string) {
  return headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

export async function GET(_req: Request, ctx: Params) {
  try {
    const { id } = await ctx.params;
    const auth = await getAuthenticatedClient();
    if (!auth) return NextResponse.json({ error: "Gmail not connected" }, { status: 400 });

    const gmail = google.gmail({ version: "v1", auth });
    const thread = await gmail.users.threads.get({ userId: "me", id, format: "full" });
    const messages = thread.data.messages ?? [];

    const out = messages.map(m => {
      const headers = m.payload?.headers ?? [];
      return {
        id:         m.id,
        message_id: getHeader(headers, "Message-Id") || getHeader(headers, "Message-ID"),
        from:       getHeader(headers, "From"),
        to:         getHeader(headers, "To"),
        cc:         getHeader(headers, "Cc"),
        subject:    getHeader(headers, "Subject"),
        date:       getHeader(headers, "Date"),
        snippet:    m.snippet ?? "",
        body:       extractBody(m.payload as Parameters<typeof extractBody>[0]),
        labels:     m.labelIds ?? [],
      };
    });

    /* If thread is unread, mark as read in Gmail too */
    const hasUnread = out.some(m => m.labels.includes("UNREAD"));
    if (hasUnread) {
      try {
        await gmail.users.threads.modify({
          userId: "me",
          id,
          requestBody: { removeLabelIds: ["UNREAD"] },
        });
      } catch { /* non-fatal */ }
    }

    return NextResponse.json({ messages: out });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
