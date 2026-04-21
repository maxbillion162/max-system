import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getAuthenticatedClient } from "@/lib/google";

function decodeBase64(str: string) {
  return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

function extractBody(payload: {
  mimeType?: string;
  body?: { data?: string };
  parts?: Array<{ mimeType?: string; body?: { data?: string }; parts?: unknown[] }>;
}): string {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64(payload.body.data);
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractBody(part as Parameters<typeof extractBody>[0]);
      if (text) return text;
    }
  }
  return "";
}

function getHeader(headers: Array<{ name?: string | null; value?: string | null }>, name: string) {
  return headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

export async function GET(req: NextRequest) {
  const auth = await getAuthenticatedClient();
  if (!auth) return NextResponse.json({ connected: false, emails: [] });

  const { searchParams } = req.nextUrl;
  const maxResults = parseInt(searchParams.get("maxResults") ?? "50");
  const query = searchParams.get("q") ?? "";

  try {
    const gmail = google.gmail({ version: "v1", auth });

    const listRes = await gmail.users.messages.list({
      userId: "me",
      maxResults,
      q: query || undefined,
    });

    const messages = listRes.data.messages ?? [];

    const emails = await Promise.all(
      messages.map(async (msg) => {
        const detail = await gmail.users.messages.get({
          userId: "me",
          id: msg.id!,
          format: "full",
        });

        const headers = detail.data.payload?.headers ?? [];
        const body = extractBody(detail.data.payload as Parameters<typeof extractBody>[0]);
        const snippet = detail.data.snippet ?? "";

        return {
          id: msg.id,
          threadId: detail.data.threadId,
          subject: getHeader(headers, "Subject") || "(No subject)",
          from: getHeader(headers, "From"),
          to: getHeader(headers, "To"),
          date: getHeader(headers, "Date"),
          snippet,
          body: body.slice(0, 2000),
          unread: (detail.data.labelIds ?? []).includes("UNREAD"),
          labels: detail.data.labelIds ?? [],
          internalDate: detail.data.internalDate,
        };
      })
    );

    return NextResponse.json({ connected: true, emails });
  } catch (e) {
    console.error("Gmail fetch error:", e);
    return NextResponse.json({ connected: false, emails: [], error: String(e) });
  }
}

export async function POST(req: NextRequest) {
  const auth = await getAuthenticatedClient();
  if (!auth) return NextResponse.json({ error: "Not connected" }, { status: 401 });

  const { to, subject, body, threadId } = await req.json();

  try {
    const gmail = google.gmail({ version: "v1", auth });

    const message = [
      `To: ${to}`,
      `Subject: ${subject}`,
      "Content-Type: text/plain; charset=utf-8",
      "",
      body,
    ].join("\n");

    const encoded = Buffer.from(message).toString("base64").replace(/\+/g, "-").replace(/\//g, "_");

    const res = await gmail.users.drafts.create({
      userId: "me",
      requestBody: {
        message: {
          raw: encoded,
          threadId: threadId ?? undefined,
        },
      },
    });

    return NextResponse.json({ success: true, draft: res.data });
  } catch (e) {
    console.error("Gmail draft error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
