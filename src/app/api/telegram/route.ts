import { NextResponse } from "next/server";
import { runAgent, buildContextHeader } from "@/lib/max-agent";
import {
  readTasks, addTask, completeTask,
  readHabits, toggleHabit,
  readGoals, readCrypto, readWeather,
  readCalendar, readBills,
  getBudgetStatus,
  storeMemory, recallMemory,
  saveTelegramMessage, loadTelegramHistory,
} from "@/lib/max-tools";
import { resolvePendingAction, answerCallbackQuery } from "@/lib/pending-actions";
import { createClient } from "@supabase/supabase-js";
import { requireTelegram } from "@/lib/auth-guards";

const BOT_TOKEN       = process.env.TELEGRAM_BOT_TOKEN;
const ALLOWED_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function send(chatId: string, text: string, options: Record<string, unknown> = {}) {
  if (!BOT_TOKEN) return;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown", ...options }),
  }).catch(() => {});
}

async function sendTyping(chatId: string) {
  if (!BOT_TOKEN) return;
  fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendChatAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, action: "typing" }),
  }).catch(() => {});
}

export async function sendNotification(text: string) {
  if (!BOT_TOKEN || !ALLOWED_CHAT_ID) return;
  await send(ALLOWED_CHAT_ID, text);
}

/* ─── Command handlers ─── */
async function handleCommand(cmd: string, args: string): Promise<string | null> {
  const c = cmd.toLowerCase().trim();

  /* /start /help */
  if (c === "/start" || c === "/help") {
    return [
      "*M.A.X. online.*",
      "",
      "*Quick commands:*",
      "/status — today's snapshot",
      "/brief — full daily briefing",
      "/tasks — open task list",
      "/add [task] — add a task",
      "/done [task name] — complete a task",
      "/habit [name] — toggle a habit",
      "/goals — goal progress",
      "/budget — this month's budget",
      "/bills — upcoming bills",
      "/crypto — live BTC + XRP",
      "/weather — Orlando weather",
      "/calendar — next 7 days",
      "/note [text] — save to memory",
      "/week — this week's schedule",
      "/memory [query] — search stored memories",
      "",
      "Or just talk to me — I have full access to your data.",
    ].join("\n");
  }

  /* /status */
  if (c === "/status") {
    const [habits, tasks, crypto, budget] = await Promise.allSettled([
      readHabits(), readTasks(), readCrypto(), getBudgetStatus(),
    ]);
    const lines: string[] = ["*M.A.X. Status*", ""];

    if (habits.status === "fulfilled" && habits.value.length > 0) {
      const done  = habits.value.filter((h: { completed: boolean }) => h.completed).length;
      const total = habits.value.length;
      const open  = habits.value.filter((h: { completed: boolean }) => !h.completed).map((h: { name: string }) => h.name);
      lines.push(`*Habits* ${done}/${total}`);
      habits.value.forEach((h: { completed: boolean; name: string; streak: number }) => {
        lines.push(`${h.completed ? "✅" : "⬜"} ${h.name}${h.streak > 1 ? ` 🔥${h.streak}` : ""}`);
      });
      if (open.length > 0) lines.push(`_Still open: ${open.join(", ")}_`);
      lines.push("");
    }

    if (tasks.status === "fulfilled") {
      const open = tasks.value.filter((t: { completed: boolean }) => !t.completed);
      const high = open.filter((t: { priority: string }) => t.priority === "high");
      lines.push(`*Tasks* ${open.length} open${high.length > 0 ? `, ${high.length} 🔴 high` : ""}`);
      open.slice(0, 4).forEach((t: { priority: string; text: string; due_date?: string }) => {
        const icon = t.priority === "high" ? "🔴" : t.priority === "medium" ? "🟡" : "🔵";
        lines.push(`${icon} ${t.text}${t.due_date ? ` _(${t.due_date})_` : ""}`);
      });
      if (open.length > 4) lines.push(`_+${open.length - 4} more_`);
      lines.push("");
    }

    if (crypto.status === "fulfilled") {
      const btc = crypto.value.find((c: { symbol: string }) => c.symbol === "BTC");
      const xrp = crypto.value.find((c: { symbol: string }) => c.symbol === "XRP");
      const fmt = (n: number) => (n >= 0 ? `+${n.toFixed(2)}` : n.toFixed(2));
      if (btc) lines.push(`*BTC* $${Math.round(btc.price).toLocaleString()} (${fmt(btc.change24h)}%)`);
      if (xrp) lines.push(`*XRP* $${xrp.price.toFixed(4)} (${fmt(xrp.change24h)}%)`);
      lines.push("");
    }

    if (budget.status === "fulfilled" && budget.value.totalBudgeted > 0) {
      const b   = budget.value;
      const pct = Math.round((b.totalSpent / b.totalBudgeted) * 100);
      lines.push(`*Budget* $${Math.round(b.totalSpent).toLocaleString()} / $${Math.round(b.totalBudgeted).toLocaleString()} (${pct}%)`);
      if (b.categories.some((c: { spent: number; budgeted: number }) => c.spent > c.budgeted)) {
        const over = b.categories.filter((c: { spent: number; budgeted: number; category: string }) => c.spent > c.budgeted);
        lines.push(`_Over budget: ${over.map((c: { category: string; spent: number; budgeted: number }) => `${c.category} +$${Math.round(c.spent - c.budgeted)}`).join(", ")}_`);
      }
    }

    return lines.join("\n");
  }

  /* /brief — falls through to agent */
  if (c === "/brief") return null;

  /* /tasks */
  if (c === "/tasks") {
    const tasks = await readTasks();
    const open  = tasks.filter((t: { completed: boolean }) => !t.completed);
    if (open.length === 0) return "✅ No open tasks.";
    const lines = ["*Open Tasks*", ""];
    open.forEach((t: { priority: string; text: string; due_date?: string }, i: number) => {
      const icon = t.priority === "high" ? "🔴" : t.priority === "medium" ? "🟡" : "🔵";
      lines.push(`${i + 1}. ${icon} ${t.text}${t.due_date ? ` _(${t.due_date})_` : ""}`);
    });
    return lines.join("\n");
  }

  /* /add [task] */
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

  /* /habit [name] — toggle by fuzzy name match */
  if (c === "/habit") {
    const habits = await readHabits();
    if (!args.trim()) {
      // Show all habits with status
      const lines = ["*Today's Habits*", ""];
      habits.forEach((h: { completed: boolean; name: string; streak: number }) => {
        lines.push(`${h.completed ? "✅" : "⬜"} ${h.name}${h.streak > 1 ? ` 🔥${h.streak}` : ""}`);
      });
      lines.push("", "_/habit [name] to toggle_");
      return lines.join("\n");
    }
    const query = args.trim().toLowerCase();
    const match = habits.find((h: { name: string }) => h.name.toLowerCase().includes(query));
    if (!match) return `No habit matching "_${args.trim()}_"\nSend /habit to see all habits.`;
    const newCompleted = !match.completed;
    await toggleHabit(match.id, newCompleted);
    return `${newCompleted ? "✅" : "↩️"} *${match.name}* marked ${newCompleted ? "complete" : "incomplete"}${match.streak > 0 ? ` 🔥${match.streak} streak` : ""}`;
  }

  /* /goals */
  if (c === "/goals") {
    const goals = await readGoals();
    if (goals.length === 0) return "No goals tracked yet.";
    const lines = ["*Goals*", ""];
    goals.slice(0, 6).forEach((g: { label?: string; id: string; current: number; target: number; unit?: string; deadline?: string | null }) => {
      const pct = g.target > 0 ? Math.round((g.current / g.target) * 100) : 0;
      const filled = Math.round(pct / 10);
      const bar = "█".repeat(filled) + "░".repeat(10 - filled);
      const label = g.label ?? g.id;
      const unit = g.unit === "$" ? `$${g.current?.toLocaleString()} / $${g.target?.toLocaleString()}` : `${g.current} / ${g.target} ${g.unit ?? ""}`;
      lines.push(`*${label}* — ${pct}%`);
      lines.push(`${bar} ${unit}${g.deadline ? ` _(${g.deadline})_` : ""}`);
      lines.push("");
    });
    return lines.join("\n");
  }

  /* /budget */
  if (c === "/budget") {
    const b = await getBudgetStatus();
    if (b.totalBudgeted === 0) return "No budget set up yet. Visit Finance → Budget on the dashboard.";
    const lines = ["*Monthly Budget*", ""];
    const pct = Math.round((b.totalSpent / b.totalBudgeted) * 100);
    lines.push(`Spent: *$${Math.round(b.totalSpent).toLocaleString()}* of *$${Math.round(b.totalBudgeted).toLocaleString()}* (${pct}%)`);
    lines.push(`Ready to assign: $${Math.round(b.readyToAssign ?? 0).toLocaleString()}`);
    lines.push("");

    const sorted = [...(b.categories ?? [])].sort((a: { spent: number }, b: { spent: number }) => b.spent - a.spent);
    sorted.slice(0, 6).forEach((cat: { category: string; spent: number; budgeted: number; remaining: number }) => {
      const over = cat.spent > cat.budgeted;
      const catPct = cat.budgeted > 0 ? Math.round((cat.spent / cat.budgeted) * 100) : 0;
      lines.push(`${over ? "🔴" : "🟢"} *${cat.category}* $${Math.round(cat.spent)} / $${Math.round(cat.budgeted)} (${catPct}%)`);
    });
    return lines.join("\n");
  }

  /* /bills */
  if (c === "/bills") {
    const bills = await readBills();
    if (bills.length === 0) return "No bills tracked. Add them on the Finance page.";
    const today = new Date().getDate();
    const lines = ["*Monthly Bills*", ""];
    let totalAmt = 0;
    (bills as { name: string; amt: number; due_day: number }[]).forEach(b => {
      totalAmt += b.amt;
      const daysUntil = b.due_day >= today ? b.due_day - today : 31 - today + b.due_day;
      const icon = daysUntil <= 3 ? "🔴" : daysUntil <= 7 ? "🟡" : "🟢";
      lines.push(`${icon} *${b.name}* $${b.amt} — due day ${b.due_day}${daysUntil <= 7 ? ` _(in ${daysUntil}d)_` : ""}`);
    });
    lines.push("", `_Total monthly: $${totalAmt.toLocaleString()}_`);
    return lines.join("\n");
  }

  /* /crypto */
  if (c === "/crypto") {
    const prices = await readCrypto();
    const btc    = prices.find((p: { symbol: string }) => p.symbol === "BTC");
    const xrp    = prices.find((p: { symbol: string }) => p.symbol === "XRP");
    const fmt    = (n: number) => (n >= 0 ? `+${n.toFixed(2)}` : n.toFixed(2));
    const lines  = ["*Crypto — Live*", ""];
    if (btc) {
      lines.push(`*BTC* $${Math.round(btc.price).toLocaleString()}`);
      lines.push(`24h: ${fmt(btc.change24h)}% | 7d: ${fmt(btc.change7d ?? 0)}%`);
      lines.push("");
    }
    if (xrp) {
      lines.push(`*XRP* $${xrp.price.toFixed(4)}`);
      lines.push(`24h: ${fmt(xrp.change24h)}% | 7d: ${fmt(xrp.change7d ?? 0)}%`);
    }
    return lines.join("\n") || "Crypto data unavailable.";
  }

  /* /weather — falls through to agent */
  if (c === "/weather") return null;

  /* /calendar */
  if (c === "/calendar") {
    const result = await readCalendar(7);
    if (!result.connected) return "Google Calendar not connected. Visit the dashboard to connect.";
    if (result.events.length === 0) return "No events in the next 7 days.";
    const lines = ["*Next 7 Days*", ""];
    result.events.slice(0, 8).forEach((e: { title: string; start: string; allDay: boolean; location: string }) => {
      const d = new Date(e.start);
      const dateStr = e.allDay
        ? d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
        : d.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
      lines.push(`📅 *${e.title}*\n_${dateStr}${e.location ? ` · ${e.location}` : ""}_`);
    });
    return lines.join("\n");
  }

  /* /week — this week's schedule */
  if (c === "/week") {
    const result = await readCalendar(7);
    if (!result.connected) return "Google Calendar not connected.";
    const today    = new Date(); today.setHours(0,0,0,0);
    const weekEnd  = new Date(today); weekEnd.setDate(today.getDate() + 7);
    const events   = result.events.filter((e: { start: string }) => new Date(e.start) < weekEnd);
    if (events.length === 0) return "Nothing on the calendar this week.";

    const byDay: Record<string, { title: string; start: string; allDay: boolean }[]> = {};
    events.forEach((e: { title: string; start: string; allDay: boolean }) => {
      const day = new Date(e.allDay ? e.start + "T00:00:00" : e.start)
        .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(e);
    });

    const lines = ["*This Week*", ""];
    Object.entries(byDay).forEach(([day, evs]) => {
      lines.push(`*${day}*`);
      evs.forEach(e => {
        const time = e.allDay ? "All day" : new Date(e.start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
        lines.push(`  ${time} — ${e.title}`);
      });
      lines.push("");
    });
    return lines.join("\n");
  }

  /* /note [text] — save to memory */
  if (c === "/note") {
    if (!args.trim()) return "Usage: /note [what to remember]";
    await storeMemory(args.trim(), ["telegram", "note"]);
    return `💾 Saved to memory: _${args.trim()}_`;
  }

  /* /memory [query] — falls through to agent */
  if (c === "/memory") return null;

  return null;
}

export async function POST(request: Request) {
  const guard = requireTelegram(request);
  if (guard) return guard;
  try {
    const body = await request.json();

    /* ─── Handle inline-button approvals (Tier-3 confirmation flow) ─── */
    const cb = body?.callback_query;
    if (cb) {
      const fromId = cb.from?.id?.toString();
      const data   = (cb.data ?? "") as string;
      if (ALLOWED_CHAT_ID && fromId !== ALLOWED_CHAT_ID) {
        await answerCallbackQuery(cb.id, "Unauthorized");
        return NextResponse.json({ ok: true });
      }
      const m = data.match(/^pa:(approve|reject):(.+)$/);
      if (m) {
        const decision = m[1] as "approve" | "reject";
        const id       = m[2];
        await answerCallbackQuery(cb.id, decision === "approve" ? "Executing…" : "Rejected");
        await resolvePendingAction(id, decision);
        return NextResponse.json({ ok: true });
      }

      /* F4 anomaly review — `an:legit:<id>` (confirm legit) | `an:flag:<id>` (flag for dispute) */
      const am = data.match(/^an:(legit|flag):(.+)$/);
      if (am) {
        const verdict = am[1] as "legit" | "flag";
        const anId    = am[2];
        const newStatus = verdict === "legit" ? "confirmed" : "flagged";
        await answerCallbackQuery(cb.id, verdict === "legit" ? "Confirmed legit" : "Flagged for dispute");

        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
        );
        await supabase.from("anomaly_log").update({
          status:       newStatus,
          resolved_via: "telegram_approval",
          resolved_at:  new Date().toISOString(),
        }).eq("id", anId);

        /* Edit the original card so Max sees the resolution */
        try {
          if (cb.message?.message_id && cb.message?.chat?.id) {
            const symbol = verdict === "legit" ? "✅" : "🚩";
            const headerWord = verdict === "legit" ? "Confirmed Legit" : "Flagged for Dispute";
            const originalText = cb.message.text ?? "";
            const stripped = originalText.replace(/^[^\n]*\n*/, "");
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
              method:  "POST",
              headers: { "Content-Type": "application/json" },
              body:    JSON.stringify({
                chat_id:    cb.message.chat.id,
                message_id: cb.message.message_id,
                text:       `${symbol} *${headerWord}*\n${stripped}`,
                parse_mode: "Markdown",
                reply_markup: { inline_keyboard: [] },
              }),
            });
          }
        } catch { /* non-fatal */ }
        return NextResponse.json({ ok: true });
      }

      await answerCallbackQuery(cb.id);
      return NextResponse.json({ ok: true });
    }

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

    // Send typing indicator immediately — fire and forget
    sendTyping(chatId);

    let reply: string | null = null;

    if (text.startsWith("/")) {
      const [cmd, ...rest] = text.split(" ");
      const args = rest.join(" ");
      reply = await handleCommand(cmd, args);
    }

    // Fall through to agent for unhandled commands and all free-form messages
    if (reply === null) {
      const [ctx, history] = await Promise.all([buildContextHeader(), loadTelegramHistory(20)]);

      const isCommand = text.startsWith("/");
      const userContent = isCommand
        ? `${ctx}\nUser sent Telegram command: ${text}\nRespond concisely in plain text. No long blocks or markdown headers.`
        : `${ctx}\n${text}\n\n[TELEGRAM — keep response under 150 words. Plain text, no headers. Lead with the most actionable line.]`;

      const agentMessages: { role: "user" | "assistant"; content: string }[] = [
        ...history,
        { role: "user", content: userContent },
      ];

      reply = await runAgent(agentMessages, false);
    }

    // Persist conversation
    await Promise.allSettled([
      saveTelegramMessage("user", text),
      reply ? saveTelegramMessage("assistant", reply) : Promise.resolve(),
    ]);

    if (reply) await send(chatId, reply);
    return NextResponse.json({ ok: true });

  } catch (err) {
    console.error("Telegram webhook error:", err);
    return NextResponse.json({ ok: true });
  }
}
