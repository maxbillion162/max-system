import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getAuthenticatedClient } from "@/lib/google";

export async function GET(req: NextRequest) {
  const auth = await getAuthenticatedClient();
  if (!auth) return NextResponse.json({ connected: false, events: [] });

  const { searchParams } = req.nextUrl;
  const timeMin = searchParams.get("timeMin") ?? new Date(Date.now() - 7 * 86400000).toISOString();
  const timeMax = searchParams.get("timeMax") ?? new Date(Date.now() + 30 * 86400000).toISOString();

  try {
    const calendar = google.calendar({ version: "v3", auth });
    const res = await calendar.events.list({
      calendarId: "primary",
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 250,
    });

    const events = (res.data.items ?? []).map((e) => ({
      id: e.id,
      title: e.summary ?? "(No title)",
      description: e.description ?? "",
      location: e.location ?? "",
      start: e.start?.dateTime ?? e.start?.date ?? "",
      end: e.end?.dateTime ?? e.end?.date ?? "",
      allDay: !e.start?.dateTime,
      color: e.colorId ?? null,
      htmlLink: e.htmlLink ?? "",
      status: e.status ?? "confirmed",
    }));

    return NextResponse.json({ connected: true, events });
  } catch (e) {
    console.error("Calendar fetch error:", e);
    return NextResponse.json({ connected: false, events: [], error: String(e) });
  }
}

export async function POST(req: NextRequest) {
  const auth = await getAuthenticatedClient();
  if (!auth) return NextResponse.json({ error: "Not connected" }, { status: 401 });

  const body = await req.json();
  try {
    const calendar = google.calendar({ version: "v3", auth });
    const res = await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: body.title,
        description: body.description ?? "",
        location: body.location ?? "",
        start: body.allDay
          ? { date: body.start }
          : { dateTime: body.start, timeZone: body.timeZone ?? "America/New_York" },
        end: body.allDay
          ? { date: body.end ?? body.start }
          : { dateTime: body.end, timeZone: body.timeZone ?? "America/New_York" },
      },
    });
    return NextResponse.json({ success: true, event: res.data });
  } catch (e) {
    console.error("Calendar create error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await getAuthenticatedClient();
  if (!auth) return NextResponse.json({ error: "Not connected" }, { status: 401 });

  const { eventId, title, start, end, description, location } = await req.json();
  if (!eventId) return NextResponse.json({ error: "eventId required" }, { status: 400 });

  // Build a sparse patch body — only fields the caller actually sent.
  const requestBody: Record<string, unknown> = {};
  if (typeof title       === "string") requestBody.summary     = title;
  if (typeof description === "string") requestBody.description = description;
  if (typeof location    === "string") requestBody.location    = location;
  if (typeof start       === "string") requestBody.start       = { dateTime: start, timeZone: "America/New_York" };
  if (typeof end         === "string") requestBody.end         = { dateTime: end,   timeZone: "America/New_York" };

  try {
    const calendar = google.calendar({ version: "v3", auth });
    const res = await calendar.events.patch({ calendarId: "primary", eventId, requestBody });
    return NextResponse.json({ success: true, event: res.data });
  } catch (e) {
    console.error("Calendar update error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await getAuthenticatedClient();
  if (!auth) return NextResponse.json({ error: "Not connected" }, { status: 401 });

  const { eventId } = await req.json();
  try {
    const calendar = google.calendar({ version: "v3", auth });
    await calendar.events.delete({ calendarId: "primary", eventId });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
