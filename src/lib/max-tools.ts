import { createClient } from "@supabase/supabase-js";
import { fetchCryptoPrices } from "@/lib/crypto";
import { getAuthenticatedClient } from "@/lib/google";
import { google } from "googleapis";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/* ────────────────────────────────── HABITS ── */
export async function readHabits() {
  const { data } = await supabase.from("habits").select("*").order("created_at");
  return data ?? [];
}

export async function toggleHabit(id: string, completed: boolean) {
  const { data } = await supabase.from("habits").update({ completed }).eq("id", id).select().single();
  return data;
}

/* ────────────────────────────────── TASKS ── */
export async function readTasks() {
  const { data } = await supabase.from("tasks").select("*").order("created_at");
  return data ?? [];
}

export async function addTask(text: string, priority: "high" | "medium" | "low" = "medium", due_date?: string) {
  const { data } = await supabase.from("tasks").insert({ text, priority, due_date, completed: false }).select().single();
  return data;
}

export async function completeTask(id: string) {
  const { data } = await supabase.from("tasks").update({ completed: true }).eq("id", id).select().single();
  return data;
}

export async function deleteTask(id: string) {
  await supabase.from("tasks").delete().eq("id", id);
  return { deleted: true, id };
}

/* ────────────────────────────────── GOALS ── */
export async function readGoals() {
  const { data } = await supabase.from("goals").select("*").order("created_at");
  return data ?? [];
}

/* ────────────────────────────────── CALENDAR ── */
export async function readCalendar(days = 7) {
  const auth = await getAuthenticatedClient();
  if (!auth) return { connected: false, events: [] };
  const calendar = google.calendar({ version: "v3", auth });
  const timeMin  = new Date().toISOString();
  const timeMax  = new Date(Date.now() + days * 86400000).toISOString();
  const res = await calendar.events.list({ calendarId: "primary", timeMin, timeMax, singleEvents: true, orderBy: "startTime", maxResults: 20 });
  const events = (res.data.items ?? []).map(e => ({
    id: e.id,
    title: e.summary ?? "(No title)",
    start: e.start?.dateTime ?? e.start?.date ?? "",
    end: e.end?.dateTime ?? e.end?.date ?? "",
    allDay: !e.start?.dateTime,
    location: e.location ?? "",
    description: e.description ?? "",
  }));
  return { connected: true, events };
}

export async function createCalendarEvent(title: string, start: string, end: string, description = "", location = "") {
  const auth = await getAuthenticatedClient();
  if (!auth) return { error: "Google Calendar not connected" };
  const calendar = google.calendar({ version: "v3", auth });
  const res = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: title,
      description,
      location,
      start: { dateTime: start, timeZone: "America/New_York" },
      end:   { dateTime: end,   timeZone: "America/New_York" },
    },
  });
  return { success: true, eventId: res.data.id, link: res.data.htmlLink };
}

/* ────────────────────────────────── GMAIL ── */
export async function readGmail(maxResults = 10) {
  const auth = await getAuthenticatedClient();
  if (!auth) return { connected: false, emails: [] };
  const gmail = google.gmail({ version: "v1", auth });
  const list  = await gmail.users.messages.list({ userId: "me", maxResults, q: "is:inbox" });
  const msgs  = list.data.messages ?? [];
  const emails = await Promise.all(msgs.slice(0, maxResults).map(async m => {
    const d = await gmail.users.messages.get({ userId: "me", id: m.id!, format: "metadata", metadataHeaders: ["Subject", "From", "Date"] });
    const h = d.data.payload?.headers ?? [];
    const get = (name: string) => h.find(x => x.name?.toLowerCase() === name)?.value ?? "";
    return { id: m.id, subject: get("subject"), from: get("from"), date: get("date"), snippet: d.data.snippet ?? "", unread: (d.data.labelIds ?? []).includes("UNREAD") };
  }));
  return { connected: true, emails };
}

export async function draftEmail(to: string, subject: string, body: string, threadId?: string) {
  const auth = await getAuthenticatedClient();
  if (!auth) return { error: "Gmail not connected" };
  const gmail = google.gmail({ version: "v1", auth });
  const raw = Buffer.from([`To: ${to}`, `Subject: ${subject}`, "Content-Type: text/plain; charset=utf-8", "", body].join("\n")).toString("base64").replace(/\+/g, "-").replace(/\//g, "_");
  const res = await gmail.users.drafts.create({ userId: "me", requestBody: { message: { raw, threadId } } });
  return { success: true, draftId: res.data.id };
}

/* ────────────────────────────────── CRYPTO ── */
export async function readCrypto() {
  const prices = await fetchCryptoPrices();
  return prices;
}

/* ────────────────────────────────── WEATHER ── */
export async function readWeather(location = "orlando") {
  const base = process.env.APP_URL ?? process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";
  const res  = await fetch(`${base}/api/weather?location=${location}`).then(r => r.json()).catch(() => null);
  return res?.data ?? null;
}

/* ────────────────────────────────── NEWS ── */
export async function readNews(count = 10) {
  const base = process.env.APP_URL ?? process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";
  const res = await fetch(`${base}/api/news?count=${count}`).then(r => r.json()).catch(() => null);
  return res?.data ?? [];
}

/* ────────────────────────────────── MEMORY ── */
export async function storeMemory(content: string, tags: string[] = []) {
  const { data } = await supabase.from("memories").insert({ content, tags }).select().single();
  return data;
}

export async function recallMemory(query: string) {
  const { data } = await supabase.from("memories").select("*").ilike("content", `%${query}%`).order("created_at", { ascending: false }).limit(10);
  return data ?? [];
}

export async function readAllMemories() {
  const { data } = await supabase.from("memories").select("*").order("created_at", { ascending: false }).limit(30);
  return data ?? [];
}

/* ────────────────────────────────── GOALS UPDATE ── */
export async function updateGoal(id: string, current: number) {
  const { data, error } = await supabase.from("goals").update({ current }).eq("id", id).select().single();
  if (error) return { error: error.message };
  return { success: true, goal: data };
}

/* ────────────────────────────────── WEALTH ── */
export async function readWealth() {
  const { data } = await supabase.from("wealth").select("*").eq("id", "max").single();
  return data ?? { ira: 2720, savings: 2800, btc_amount: 0.02, xrp_amount: 200 };
}

export async function updateWealth(updates: Partial<{ ira: number; savings: number; btc_amount: number; xrp_amount: number }>) {
  const { error } = await supabase.from("wealth").upsert({ id: "max", ...updates });
  if (error) return { error: error.message };
  return { success: true, updated: updates };
}

/* ────────────────────────────────── WEB SEARCH ── */
export async function webSearch(query: string) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return { error: "Web search not available — add TAVILY_API_KEY to env" };

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey, query, max_results: 5, search_depth: "basic" }),
  });

  if (!res.ok) return { error: `Search failed: ${res.status}` };
  const data = await res.json();
  return {
    answer: data.answer ?? null,
    results: (data.results ?? []).map((r: { title: string; url: string; content: string }) => ({
      title: r.title,
      url: r.url,
      snippet: (r.content ?? "").slice(0, 400),
    })),
  };
}

/* ────────────────────────────────── TELEGRAM HISTORY ── */
export async function saveTelegramMessage(role: "user" | "assistant", content: string) {
  await supabase.from("telegram_history").insert({ role, content });
}

export async function loadTelegramHistory(limit = 12) {
  const { data } = await supabase
    .from("telegram_history")
    .select("role, content")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (!data || data.length === 0) return [];
  return data.reverse() as { role: "user" | "assistant"; content: string }[];
}
