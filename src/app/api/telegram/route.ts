import { NextResponse } from "next/server";
import { runAgent, buildContextHeader } from "@/lib/max-agent";
import { readTasks, addTask, completeTask, readHabits, readGoals, readCrypto, readCalendar, saveTelegramMessage, loadTelegramHistory } from "@/lib/max-tools";

const BOT_TOKEN       = process.env.TELEGRAM_BOT_TOKEN;
const ALLOWED_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function send(chatId: string, text: string) {
  if (!BOT_TOKEN) return;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  });
}

export async function sendNotification(text: string) {
  if (!BOT_TOKEN || !ALLOWED_CHAT_ID) return;
  await send(ALLOWED_CHAT_ID, text);
}

async function handleCommand(cmd: string, args: string): Promise<string | null> {
  const c = cmd.toLowerCase().trim();

  /* /start or /help */
  if (c === "/start" || c === "/help") {
    return [
      "*M.A.X. online.*",
      "",
      "Commands:",
      "/brief    — full daily briefing",
      "/status   — today's snapshot",
      "/tasks    — open task list",
      "/add [task] — add a task",
      "/done [task name] — complete a task",
      "/goals    — goals overview",
      "/crypto   — live BTC + XRP",
      "/weather  — Orlando weather",
      "/calendar — upcoming events",
      "/memory [query] — search memories",
      "",
      "Or just talk to me.",
    ].join("\n");
  }

  /* /brief — full morning briefing via agent */
  if (c === "/brief") {
    return null; // falls through to agent with injected context
  }

  /* /status — quick snapshot */
  if (c === "/status") {
    const [habits, tasks, crypto] = await Promise.allSettled([readHabits(), readTasks(), readCrypto()]);
    const lines: string[] = ["*M.A.X. Status*", ""];

    if (habits.status === "fulfilled" && habits.value.length > 0) {
      const done  = habits.value.filter((h: { completed: boolean }) => h.completed).length;
      const total = habits.value.length;
      const pct   = Math.round((done / total) * 100);
      lines.push(`*Habits* ${done}/${total} (${pct}%)`);
      habits.value.forEach((h: { completed: boolean; name: string; streak: number }) => {
        lines.push(`${h.completed ? "✅" : "⬜"} ${h.name}${h.streak > 1 ? ` 🔥${h.streak}` : ""}`);
      });
      lines.push("");
    }

    if (tasks.status === "fulfilled") {
      const open = tasks.value.filter((t: { completed: boolean }) => !t.completed);
      const high = open.filter((t: { priority: string }) => t.priority === "high");
      lines.push(`*Tasks* ${open.length} open${high.length > 0 ? `, ${high.length} high priority` : ""}`);
      open.slice(0, 5).forEach((t: { priority: string; text: string }) => {
        lines.push(`${t.priority === "high" ? "🔴" : t.priority === "medium" ? "🟡" : "🔵"} ${t.text}`);
      });
      if (open.length > 5) lines.push(`_+${open.length - 5} more_`);
      lines.push("");
    }

    if (crypto.status === "fulfilled") {
      const btc = crypto.value.find((c: { symbol: string }) => c.symbol === "BTC");
      const xrp = crypto.value.find((c: { symbol: string }) => c.symbol === "XRP");
      const fmt = (n: number) => (n >= 0 ? `+${n.toFixed(2)}` : n.toFixed(2));
      if (btc) lines.push(`*BTC* $${Math.round(btc.price).toLocaleString()} (${fmt(btc.change24h)}%)`);
      if (xrp) lines.push(`*XRP* $${xrp.price.toFixed(4)} (${fmt(xrp.change24h)}%)`);
    }

    return lines.join("\n");
  }

  /* /tasks */
  if (c === "/tasks") {
    const tasks = await readTasks();
    const open  = tasks.filter((t: { completed: boolean }) => !t.completed);
    if (open.length === 0) return "No open tasks.";
    const lines = ["*Open Tasks*", ""];
    open.forEach((t: { priority: string; text: string; due_date?: string }, i: number) => {
      const icon = t.priority === "high" ? "🔴" : t.priority === "medium" ? "🟡" : "🔵";
      lines.push(`${i + 1}. ${icon} ${t.text}${t.due_date ? ` _(${t.due_date})_` : ""}`);
    });
    return lines.join("\n");
  }

  /* /add [task text] */
  if (c === "/add") {
    if (!args.trim()) return "Usage: /add buy groceries";
    const task = await addTask(args.trim(), "medium");
    return task ? `✅ Added: _${args.trim()}_` : "Failed to add task.";
  }

  /* /done [task name] — fuzzy match */
  if (c === "/done") {
    if (!args.trim()) return "Usage: /done buy groceries";
    const tasks = await readTasks();
    const open  = tasks.filter((t: { completed: boolean }) => !t.completed);
    const query = args.trim().toLowerCase();
    const match = open.find((t: { text: string }) => t.text.toLowerCase().includes(query));
    if (!match) return `No open task matching "_${args.trim()}_"`;
    await completeTask(match.id);
    return `✅ Done: _${match.text}_`;
  }

  /* /goals */
  if (c === "/goals") {
    const goals = await readGoals();
    if (goals.length === 0) return "No goals tracked yet.";
    const lines = ["*Goals*", ""];
    goals.slice(0, 6).forEach((g: { label?: string; id: string; current: number; target: number; unit?: string }) => {
      const pct = g.target > 0 ? Math.round((g.current / g.target) * 100) : 0;
      const bar = "█".repeat(Math.round(pct / 10)) + "░".repeat(10 - Math.round(pct / 10));
      lines.push(`*${g.label ?? g.id}*`);
      lines.push(`${bar} ${pct}% ($${g.current?.toLocaleString()} / $${g.target?.toLocaleString()}${g.unit ? " " + g.unit : ""})`);
      lines.push("");
    });
    return lines.join("\n");
  }

  /* /crypto */
  if (c === "/crypto") {
    const prices = await readCrypto();
    const btc    = prices.find((p: { symbol: string }) => p.symbol === "BTC");
    const xrp    = prices.find((p: { symbol: string }) => p.symbol === "XRP");
    const fmt    = (n: number) => (n >= 0 ? `+${n.toFixed(2)}` : n.toFixed(2));
    const lines  = ["*Crypto — Live*", ""];
    if (btc) lines.push(`*BTC* $${Math.round(btc.price).toLocaleString()} (${fmt(btc.change24h)}% 24h, ${fmt(btc.change7d ?? 0)}% 7d)`);
    if (xrp) lines.push(`*XRP* $${xrp.price.toFixed(4)} (${fmt(xrp.change24h)}% 24h, ${fmt(xrp.change7d ?? 0)}% 7d)`);
    return lines.join("\n") || "Crypto data unavailable.";
  }

  /* /weather */
  if (c === "/weather") {
    return null; // let agent handle with tool
  }

  /* /calendar */
  if (c === "/calendar") {
    const result = await readCalendar(7);
    if (!result.connected) return "Google Calendar not connected. Visit the dashboard to connect.";
    if (result.events.length === 0) return "No events in the next 7 days.";
    const lines = ["*Upcoming Events*", ""];
    result.events.slice(0, 8).forEach((e: { title: string; start: string; allDay: boolean }) => {
      const d = new Date(e.start);
      const dateStr = e.allDay
        ? d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
        : d.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
      lines.push(`📅 *${e.title}*\n_${dateStr}_`);
    });
    return lines.join("\n");
  }

  /* /memory [query] */
  if (c === "/memory") {
    return null; // let agent handle with recall_memory tool
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const body    = await request.json();
    const message = body?.message;
    if (!message) return NextResponse.json({ ok: true });

    const chatId = message.chat?.id?.toString();
    const fromId = message.from?.id?.toString();
    const text   = (message.text ?? "").trim();

    if (ALLOWED_CHAT_ID && fromId !== ALLOWED_CHAT_ID) {
      await send(chatId, "Unauthorized.");
      return NextResponse.json({ ok: true });
    }

    if (!text) return NextResponse.json({ ok: true });

    let reply: string | null = null;

    if (text.startsWith("/")) {
      const [cmd, ...rest] = text.split(" ");
      const args = rest.join(" ");
      reply = await handleCommand(cmd, args);
    }

    // Fall through to agent for /brief, /weather, /memory, or any free-form message
    if (reply === null) {
      const [ctx, history] = await Promise.all([buildContextHeader(), loadTelegramHistory(10)]);

      const telegramNote = "[Note: This is a Telegram message. Keep response concise and plain — no long blocks.]";
      const userContent = text.startsWith("/")
        ? `${ctx}\nUser sent Telegram command: ${text}\nRespond concisely in plain text (no markdown headers).`
        : `${ctx}\n${text}\n\n${telegramNote}`;

      const messages: { role: "user" | "assistant"; content: string }[] = [
        ...history,
        { role: "user", content: userContent },
      ];

      reply = await runAgent(messages, false);
    }

    // Persist both sides of the conversation
    await Promise.all([
      saveTelegramMessage("user", text),
      reply ? saveTelegramMessage("assistant", reply) : Promise.resolve(),
    ]);

    await send(chatId, reply ?? "Error.");
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Telegram webhook error:", err);
    return NextResponse.json({ ok: true });
  }
}
