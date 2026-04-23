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

const GOAL_COLORS = ["#4589FF","#22c55e","#f59e0b","#a78bfa","#06b6d4","#ec4899","#f97316"];

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
