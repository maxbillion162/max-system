import { createClient } from "@supabase/supabase-js";
import { fetchCryptoPrices } from "@/lib/crypto";
import { getAuthenticatedClient } from "@/lib/google";
import { google } from "googleapis";
import { browseUrl as _browseUrl } from "@/lib/firecrawl";
import { searchPlaces as _searchPlaces } from "@/lib/places";
import { searchYelp as _searchYelp } from "@/lib/yelp";
import { searchReddit as _searchReddit } from "@/lib/reddit";
import { wolframQuery as _wolframQuery } from "@/lib/wolfram";
import { getCurrentTrack, playback, searchSpotify, setVolume } from "@/lib/spotify";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/* ────────────────────────────────── HABITS ── */
export async function readHabits() {
  const today = new Date().toISOString().slice(0, 10);
  const [habitsRes, logsRes] = await Promise.allSettled([
    supabase.from("habits").select("*").order("created_at"),
    supabase.from("habit_logs").select("habit_id").eq("date", today).eq("completed", true),
  ]);
  const habits = habitsRes.status === "fulfilled" ? (habitsRes.value.data ?? []) : [];
  const logs   = logsRes.status   === "fulfilled" ? (logsRes.value.data   ?? []) : [];
  const doneIds = new Set(logs.map((l: { habit_id: string }) => l.habit_id));
  return habits.map((h: Record<string, unknown>) => ({ ...h, completed: doneIds.has(String(h.id)) })) as (Record<string, unknown> & { id: string; name: string; cat: string; streak: number; completed: boolean })[];
}

export async function toggleHabit(id: string, completed: boolean) {
  const today = new Date().toISOString().slice(0, 10);
  if (completed) {
    await supabase.from("habit_logs").upsert({ habit_id: id, date: today, completed: true }, { onConflict: "habit_id,date" });
  } else {
    await supabase.from("habit_logs").delete().eq("habit_id", id).eq("date", today);
  }
  await supabase.from("habits").update({ completed }).eq("id", id);
  const { data } = await supabase.from("habits").select("id,name,cat,streak,color,completed").eq("id", id).single();
  return { ...data, completed };
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

export async function addHabit(name: string, cat: string, color = "#4589FF") {
  const { data, error } = await supabase.from("habits").insert({ name, cat, color, streak: 0, completed: false }).select().single();
  if (error) return { error: error.message };
  return { success: true, habit: data };
}

export async function deleteHabit(id: string) {
  await supabase.from("habit_logs").delete().eq("habit_id", id);
  await supabase.from("habits").delete().eq("id", id);
  return { deleted: true, id };
}

/* ────────────────────────────────── TASKS ── */
export async function updateTask(id: string, fields: Partial<{ text: string; priority: string; due_date: string | null; completed: boolean }>) {
  const { data, error } = await supabase.from("tasks").update(fields).eq("id", id).select().single();
  if (error) return { error: error.message };
  return { success: true, task: data };
}

export async function deleteGoal(id: string) {
  await supabase.from("goal_notes").delete().eq("goal_id", id);
  await supabase.from("goals").delete().eq("id", id);
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

/**
 * Real send via Gmail API. Always Tier-3 — never auto-send. The agent
 * can only invoke this through pending_actions (Telegram ✓ approval),
 * and the UI Compose modal calls it directly only on an explicit click.
 */
export async function sendEmail(opts: {
  to:           string;
  subject:      string;
  body:         string;
  threadId?:    string;
  inReplyTo?:   string;        // Message-ID of the email being replied to
  cc?:          string;
  bcc?:         string;
}) {
  const auth = await getAuthenticatedClient();
  if (!auth) return { error: "Gmail not connected" };
  const gmail = google.gmail({ version: "v1", auth });

  const headers: string[] = [
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    "Content-Type: text/plain; charset=utf-8",
  ];
  if (opts.cc)        headers.push(`Cc: ${opts.cc}`);
  if (opts.bcc)       headers.push(`Bcc: ${opts.bcc}`);
  if (opts.inReplyTo) {
    headers.push(`In-Reply-To: ${opts.inReplyTo}`);
    headers.push(`References: ${opts.inReplyTo}`);
  }

  const raw = Buffer.from([...headers, "", opts.body].join("\r\n"))
    .toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw, threadId: opts.threadId },
  });
  return { success: true, messageId: res.data.id, threadId: res.data.threadId };
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

/* ────────────────────────────────── GOALS ── */
export async function updateGoal(id: string, current: number) {
  const { data, error } = await supabase.from("goals").update({ current }).eq("id", id).select().single();
  if (error) return { error: error.message };
  return { success: true, goal: data };
}

const GOAL_COLORS = ["#4589FF","#5FB07D","#C85A5A","#a78bfa","#7DB8E8","#9B8AFB","#C85A5A"];

export async function createGoal(
  label: string,
  target: number,
  unit: string,
  category: string,
  description?: string,
  deadline?: string,
  current = 0,
) {
  const color = GOAL_COLORS[Math.floor(Math.random() * GOAL_COLORS.length)];
  const { data, error } = await supabase.from("goals").insert({
    label, description: description ?? "", current, target, unit,
    deadline: deadline ?? null, color, category,
    milestones: [], subgoals: [],
  }).select().single();
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
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query, max_results: 5, search_depth: "basic" }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return { error: `Search failed: ${res.status} — ${errText.slice(0, 200)}` };
  }
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

/* ────────────────────────────────── BUDGET ── */
export async function getBudgetStatus() {
  const now   = new Date();
  const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const end   = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().split("T")[0];

  const [allocRes, txRes, incomeRes] = await Promise.allSettled([
    supabase.from("budget_allocations").select("*").eq("period_start", start),
    supabase.from("transactions").select("amount,budget_category,category,pending").gte("date", start).lt("date", end),
    supabase.from("settings").select("value").eq("key", "monthly_income").single(),
  ]);

  const allocations = allocRes.status === "fulfilled" ? allocRes.value.data ?? [] : [];
  const transactions = txRes.status === "fulfilled" ? txRes.value.data ?? [] : [];
  const income = incomeRes.status === "fulfilled" ? Number(incomeRes.value.data?.value ?? 0) : 0;

  const spendByCategory: Record<string, number> = {};
  for (const tx of transactions) {
    if ((tx as { pending: boolean }).pending || (tx as { amount: number }).amount <= 0) continue;
    const cat = (tx as { budget_category: string | null; category: string }).budget_category ?? (tx as { category: string }).category ?? "Misc";
    spendByCategory[cat] = (spendByCategory[cat] ?? 0) + (tx as { amount: number }).amount;
  }

  const categories = allocations.map((a: { category: string; budgeted: number }) => ({
    category: a.category,
    budgeted: a.budgeted,
    spent: spendByCategory[a.category] ?? 0,
    remaining: a.budgeted - (spendByCategory[a.category] ?? 0),
  }));

  const totalBudgeted = allocations.reduce((s: number, a: { budgeted: number }) => s + a.budgeted, 0);
  const totalSpent    = Object.values(spendByCategory).reduce((s, v) => s + v, 0);

  return { income, totalBudgeted, totalSpent, readyToAssign: income - totalBudgeted, categories };
}

export async function getRecentTransactions(limit = 20) {
  const { data } = await supabase
    .from("transactions")
    .select("date,amount,merchant,budget_category,category,pending")
    .order("date", { ascending: false })
    .limit(limit);
  return data ?? [];
}

/* ────────────────────────────────── NOTIFICATIONS ── */
export async function createNotification(
  type: string,
  title: string,
  body: string,
  action_url?: string
) {
  const { data, error } = await supabase
    .from("notifications")
    .insert({ type, title, body, action_url: action_url ?? null, read: false })
    .select()
    .single();
  if (error) return { error: error.message };
  return { success: true, notification: data };
}

export async function getNotifications(limit = 20) {
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function markNotificationRead(id: string) {
  const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id);
  if (error) return { error: error.message };
  return { success: true };
}

/* ────────────────────────────────── ACTIVITY LOG ── */
export async function logActivity(
  type: string,
  description: string,
  detail?: Record<string, unknown>
) {
  const { data, error } = await supabase
    .from("activity_log")
    .insert({ type, description, detail: detail ?? null })
    .select()
    .single();
  if (error) return { error: error.message };
  return { success: true, entry: data };
}

/* ────────────────────────────────── BILLS ── */
export async function readBills() {
  const { data } = await supabase.from("bills").select("*").order("due_day");
  return data ?? [];
}

/* ────────────────────────────────── SETTINGS ── */
export async function setIncome(amount: number) {
  const { error } = await supabase.from("settings").upsert({ key: "monthly_income", value: amount }, { onConflict: "key" });
  if (error) return { error: error.message };
  return { success: true, income: amount };
}

/* ────────────────────────────────── TELEGRAM SEND ── */
export async function sendTelegramMessage(text: string): Promise<{ sent: boolean; error?: string }> {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID   = process.env.TELEGRAM_CHAT_ID;
  if (!BOT_TOKEN || !CHAT_ID) return { sent: false, error: "Telegram not configured" };
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: "Markdown" }),
    });
    return { sent: true };
  } catch (err) {
    return { sent: false, error: String(err) };
  }
}

/* ────────────────────────────────── WEB BROWSING ── */
export async function browseUrl(url: string) {
  return _browseUrl(url);
}

/* ────────────────────────────────── LOCAL SEARCH ── */
export async function searchPlaces(query: string, location?: string) {
  return _searchPlaces(query, location);
}

export async function searchYelp(term: string, location?: string, categories?: string) {
  return _searchYelp(term, location, categories);
}

/* ────────────────────────────────── REDDIT ── */
export async function searchReddit(query: string, subreddit?: string, limit?: number) {
  return _searchReddit(query, subreddit, limit);
}

/* ────────────────────────────────── WOLFRAM ── */
export async function wolframQuery(query: string) {
  return _wolframQuery(query);
}

/* ────────────────────────────────── SPOTIFY ── */
export async function spotifyNowPlaying() {
  return getCurrentTrack();
}

export async function spotifyPlayback(action: "play" | "pause" | "next" | "previous") {
  return playback(action);
}

export async function spotifySearch(query: string, type: "track" | "playlist" | "artist" = "track") {
  return searchSpotify(query, type);
}

export async function spotifyVolume(percent: number) {
  return setVolume(percent);
}

/* ────────────────────────────────── STOCK QUOTE ── */
export async function getStockQuote(ticker: string): Promise<{ symbol: string; price: number; change: number; changePercent: string; error?: string }> {
  const apiKey = process.env.ALPHA_VANTAGE_KEY;
  if (!apiKey) return { symbol: ticker, price: 0, change: 0, changePercent: "0%", error: "Alpha Vantage not configured" };

  try {
    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${ticker.toUpperCase()}&apikey=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();
    const q = data["Global Quote"];
    if (!q || !q["05. price"]) return { symbol: ticker, price: 0, change: 0, changePercent: "0%", error: "Symbol not found" };
    return {
      symbol: q["01. symbol"],
      price: parseFloat(q["05. price"]),
      change: parseFloat(q["09. change"]),
      changePercent: q["10. change percent"],
    };
  } catch (err) {
    return { symbol: ticker, price: 0, change: 0, changePercent: "0%", error: String(err) };
  }
}

/* ────────────────────────────────── CRYPTO FEAR & GREED ── */
export async function getFearGreedIndex(): Promise<{ value: number; label: string; timestamp: string; error?: string }> {
  try {
    const res = await fetch("https://api.alternative.me/fng/?limit=1");
    const data = await res.json();
    const item = data.data?.[0];
    if (!item) return { value: 0, label: "Unknown", timestamp: "", error: "No data" };
    return {
      value: parseInt(item.value),
      label: item.value_classification,
      timestamp: new Date(parseInt(item.timestamp) * 1000).toLocaleDateString(),
    };
  } catch (err) {
    return { value: 0, label: "Unknown", timestamp: "", error: String(err) };
  }
}

/* ────────────────────────────────── SMS ── */
export async function sendSms(message: string, to?: string): Promise<{ sent: boolean; error?: string }> {
  const SID   = process.env.TWILIO_ACCOUNT_SID;
  const TOKEN = process.env.TWILIO_AUTH_TOKEN;
  const FROM  = process.env.TWILIO_PHONE_NUMBER;
  const TO    = to ?? process.env.MAX_PHONE_NUMBER;

  if (!SID || !TOKEN || !FROM || !TO) {
    return { sent: false, error: "Twilio not configured — add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, MAX_PHONE_NUMBER" };
  }

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`, {
      method: "POST",
      headers: {
        "Authorization": "Basic " + Buffer.from(`${SID}:${TOKEN}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ From: FROM, To: TO, Body: message }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      return { sent: false, error: `Twilio ${res.status}: ${err.slice(0, 200)}` };
    }
    return { sent: true };
  } catch (err) {
    return { sent: false, error: String(err) };
  }
}

/* ────────────────────────────────── FIND FREE TIME ── */
export async function findFreeTime(date: string): Promise<{ slots: { start: string; end: string; duration: number }[]; error?: string }> {
  const result = await readCalendar(7);
  if (!result.connected) return { slots: [], error: "Google Calendar not connected" };

  const dayEvents = (result.events as { start: string; end: string; allDay: boolean }[])
    .filter(e => !e.allDay && e.start.startsWith(date))
    .sort((a, b) => a.start.localeCompare(b.start));

  const workStart = new Date(`${date}T08:00:00`);
  const workEnd   = new Date(`${date}T22:00:00`);

  const slots: { start: string; end: string; duration: number }[] = [];
  let cursor = workStart;

  for (const event of dayEvents) {
    const evStart = new Date(event.start);
    const evEnd   = new Date(event.end);
    if (evStart > cursor) {
      const gapMinutes = (evStart.getTime() - cursor.getTime()) / 60000;
      if (gapMinutes >= 30) {
        slots.push({ start: cursor.toTimeString().slice(0, 5), end: evStart.toTimeString().slice(0, 5), duration: gapMinutes });
      }
    }
    if (evEnd > cursor) cursor = evEnd;
  }

  if (cursor < workEnd) {
    const gapMinutes = (workEnd.getTime() - cursor.getTime()) / 60000;
    if (gapMinutes >= 30) {
      slots.push({ start: cursor.toTimeString().slice(0, 5), end: workEnd.toTimeString().slice(0, 5), duration: gapMinutes });
    }
  }

  return { slots };
}

/* ────────────────────────────────── PROJECT SAVINGS ── */
export async function projectSavings(
  monthlyContribution: number,
  months: number,
  annualReturnPct = 0,
): Promise<{ finalBalance: number; totalContributed: number; interestEarned: number; monthlyBreakdown: { month: number; balance: number }[] }> {
  const wealth = await readWealth();
  const startingBalance = (wealth as { savings?: number }).savings ?? 0;
  const monthlyRate = annualReturnPct / 100 / 12;

  let balance = startingBalance;
  const monthlyBreakdown: { month: number; balance: number }[] = [];

  for (let m = 1; m <= months; m++) {
    balance = balance * (1 + monthlyRate) + monthlyContribution;
    if (m <= 12 || m % 3 === 0 || m === months) {
      monthlyBreakdown.push({ month: m, balance: Math.round(balance) });
    }
  }

  const totalContributed = monthlyContribution * months;
  const finalBalance = Math.round(balance);
  return {
    finalBalance,
    totalContributed,
    interestEarned: finalBalance - startingBalance - totalContributed,
    monthlyBreakdown: monthlyBreakdown.slice(-6),
  };
}

/* ────────────────────────────────── TELEGRAM HISTORY ──
   Dual-write model: every Telegram message also lands in chat_messages
   so the bubble, web chat, and Telegram share one unified conversation.
   telegram_history is kept for backwards compatibility with the Archive
   page until that page migrates to read from chat_messages directly. */
export async function saveTelegramMessage(role: "user" | "assistant", content: string) {
  await Promise.all([
    supabase.from("telegram_history").insert({ role, content }).then(() => {}, () => {}),
    supabase.from("chat_messages").insert({ role, content }).then(() => {}, () => {}),
  ]);
}

export async function loadTelegramHistory(limit = 12) {
  // Read from the unified chat_messages table so Telegram picks up web + bubble context too
  const { data } = await supabase
    .from("chat_messages")
    .select("role, content")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (!data || data.length === 0) return [];
  return data.reverse() as { role: "user" | "assistant"; content: string }[];
}
