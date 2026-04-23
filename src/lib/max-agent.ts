import Anthropic from "@anthropic-ai/sdk";
import {
  readHabits, toggleHabit, addHabit, deleteHabit,
  readTasks, addTask, completeTask, deleteTask, updateTask,
  readGoals, updateGoal, createGoal, deleteGoal,
  readCalendar, createCalendarEvent,
  readGmail, draftEmail,
  readCrypto, readWeather, readNews,
  storeMemory, recallMemory, readAllMemories,
  updateWealth, readWealth, webSearch,
  createNotification, logActivity,
  getBudgetStatus, getRecentTransactions,
  readBills, setIncome,
} from "@/lib/max-tools";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL      = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 2048;

/* ─── System prompt ─── */
const SYSTEM = `You are M.A.X. — Maximum Adaptive eXecutive. Max's personal AI operating system, built to help him execute on his goals, stay on track, and handle tasks without hand-holding.

WHO MAX IS (use this — make every response personal, not generic):
- 22, Orlando FL, just graduated FSU. Starting as Account Manager at a staffing/HR firm in July 2026.
- Year 1 target: $100K income. 5-year plan: own business full-time. Filter every suggestion through this lens.
- Gym 3-5x/week (push/pull/legs split). Night owl building a morning routine for the new job.
- Crypto: 0.02 BTC + 200 XRP on Robinhood. Roth IRA at Schwab (MDDVX, RPEAX, PTTRX).
- Emergency fund: $10K goal — currently ~$2,800. Top financial priority after income.
- Learning: Claude Code, Python, AI workflows, sales techniques — investing in the entrepreneur path.
- Lives in Orlando. Has a girlfriend.

HOW TO COMMUNICATE:
- Jarvis capability, TARS personality. Direct, dry, efficient. Never sycophantic.
- Never open with: "Certainly!", "Of course!", "Great question!", "Happy to help!", "Absolutely!"
- Talk like a sharp colleague who knows his situation cold — not an assistant trying to please him.
- Short by default. Go detailed only when stakes or complexity warrant it.
- Reference actual numbers: not "your savings are growing" — "$2,847 saved, $7,153 to the $10K goal."
- If he's off track (habits sliding, budget blown, tasks stacking) — say so directly. Don't soften it.
- Connect dots proactively. If he mentions gym plans and has a calendar conflict, flag it before he asks.
- When the injected context shows something notable, lead with it — don't wait to be asked.
- Suggest next actions. Don't just report state — point toward what matters next.

TOOL USAGE:
- Read before writing: check habits/tasks/goals before toggling/completing/updating.
- Calendar events: always preview title/time/date in your response FIRST. If Max confirms, create it.
- Email: ONLY drafts. Never sends automatically. Confirm after: "Draft saved to Gmail — check Drafts folder."
- Memory: proactively store facts Max tells you — preferences, decisions, plans, key people. Always tag.
- Recall memories proactively when the topic might match something stored.
- Budget questions: use get_budget_status AND get_transactions for a real answer.
- After any write action, confirm exactly what changed — brief and specific.
- For daily briefs: chain read_habits + read_tasks + read_crypto + read_calendar together.
- For net worth questions: use read_wealth then read_crypto to calculate live total.
- Irreversible deletes (habit, goal): confirm what you're deleting in the response before executing.

FORMATTING (follow exactly):
- No markdown tables — use bullets or short sentences.
- **Bold** for key numbers, names, and important labels.
- Never expose tool/function names (read_habits, toggle_habit, etc.) in responses.
- No filler: no "As your AI assistant...", no restating the question, no unnecessary preamble.
- Web chat: can use structure and detail when the topic warrants it.
- Telegram: stay under 150 words, minimal formatting, lead with the most actionable line.

HARD RULES:
- Email: draft only. Never claim to have sent.
- Finance: informational only — not investment advice. State numbers, don't recommend trades.
- Deletes: for irreversible actions, confirm what's being deleted. If the target is ambiguous, ask first.
- Tool failures: tell Max what failed and what info you'd need to try again.`;

/* ─── Tool labels ─── */
const TOOL_LABELS: Record<string, string> = {
  read_habits:           "Checking your habits…",
  toggle_habit:          "Updating habit…",
  add_habit:             "Adding habit…",
  delete_habit:          "Deleting habit…",
  read_tasks:            "Loading your tasks…",
  add_task:              "Adding task…",
  complete_task:         "Completing task…",
  delete_task:           "Deleting task…",
  update_task:           "Updating task…",
  read_goals:            "Reading your goals…",
  update_goal:           "Updating goal progress…",
  create_goal:           "Creating goal…",
  delete_goal:           "Deleting goal…",
  read_calendar:         "Checking your calendar…",
  create_calendar_event: "Creating calendar event…",
  read_gmail:            "Checking your email…",
  draft_email:           "Drafting email…",
  read_crypto:           "Checking crypto prices…",
  read_weather:          "Checking Orlando weather…",
  read_news:             "Scanning latest news…",
  store_memory:          "Storing to memory…",
  recall_memory:         "Searching memory…",
  read_all_memories:     "Loading memories…",
  update_wealth:         "Updating financial data…",
  read_wealth:           "Reading portfolio…",
  web_search:            "Searching the web…",
  create_notification:   "Sending notification…",
  log_activity:          "Logging activity…",
  get_budget_status:     "Checking your budget…",
  get_transactions:      "Loading transactions…",
  read_bills:            "Checking upcoming bills…",
  set_income:            "Updating income…",
};

/* ─── Tool definitions ─── */
const TOOLS: Anthropic.Tool[] = [
  {
    name: "read_habits",
    description: "Get all of Max's habits with today's completion status and streak counts.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "toggle_habit",
    description: "Mark a habit as completed or incomplete for today.",
    input_schema: {
      type: "object" as const,
      properties: {
        id:        { type: "string",  description: "Habit ID from read_habits" },
        completed: { type: "boolean", description: "true = done, false = not done" },
      },
      required: ["id", "completed"],
    },
  },
  {
    name: "add_habit",
    description: "Create a new habit for Max to track daily.",
    input_schema: {
      type: "object" as const,
      properties: {
        name:  { type: "string", description: "Habit name (e.g. 'Meditate', 'Read 30 min')" },
        cat:   { type: "string", description: "Category: health, productivity, mindset, finance, social, learning" },
        color: { type: "string", description: "Hex color (optional, e.g. '#4589FF')" },
      },
      required: ["name", "cat"],
    },
  },
  {
    name: "delete_habit",
    description: "Delete a habit permanently. Confirm the habit name in your response before calling this.",
    input_schema: {
      type: "object" as const,
      properties: { id: { type: "string", description: "Habit ID from read_habits" } },
      required: ["id"],
    },
  },
  {
    name: "read_tasks",
    description: "Get all of Max's tasks — open and completed — with priority and due dates.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "add_task",
    description: "Add a new task to Max's task list.",
    input_schema: {
      type: "object" as const,
      properties: {
        text:     { type: "string", description: "Task description" },
        priority: { type: "string", enum: ["high", "medium", "low"], description: "Priority level" },
        due_date: { type: "string", description: "Due date YYYY-MM-DD (optional)" },
      },
      required: ["text"],
    },
  },
  {
    name: "complete_task",
    description: "Mark a task as completed.",
    input_schema: {
      type: "object" as const,
      properties: { id: { type: "string", description: "Task ID from read_tasks" } },
      required: ["id"],
    },
  },
  {
    name: "delete_task",
    description: "Delete a task permanently.",
    input_schema: {
      type: "object" as const,
      properties: { id: { type: "string", description: "Task ID from read_tasks" } },
      required: ["id"],
    },
  },
  {
    name: "update_task",
    description: "Edit a task's text, priority, due date, or completion status.",
    input_schema: {
      type: "object" as const,
      properties: {
        id:        { type: "string",  description: "Task ID from read_tasks" },
        text:      { type: "string",  description: "Updated task text (optional)" },
        priority:  { type: "string",  enum: ["high", "medium", "low"], description: "Updated priority (optional)" },
        due_date:  { type: "string",  description: "Updated due date YYYY-MM-DD, or null to clear (optional)" },
        completed: { type: "boolean", description: "Updated completion status (optional)" },
      },
      required: ["id"],
    },
  },
  {
    name: "read_goals",
    description: "Get all of Max's goals with current progress, targets, and deadlines.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "update_goal",
    description: "Update the current progress value on a goal. Use read_goals first to get the ID.",
    input_schema: {
      type: "object" as const,
      properties: {
        id:      { type: "string", description: "Goal ID from read_goals" },
        current: { type: "number", description: "New current progress value" },
      },
      required: ["id", "current"],
    },
  },
  {
    name: "create_goal",
    description: "Create a new goal for Max and save it.",
    input_schema: {
      type: "object" as const,
      properties: {
        label:       { type: "string",  description: "Short goal name" },
        target:      { type: "number",  description: "Numeric target" },
        unit:        { type: "string",  description: "Unit (e.g. '$', 'lbs', 'books', 'workouts')" },
        category:    { type: "string",  description: "Finance, Health, Career, Personal, Learning, or Relationships" },
        description: { type: "string",  description: "Optional longer description" },
        deadline:    { type: "string",  description: "Optional target date YYYY-MM-DD" },
        current:     { type: "number",  description: "Current progress (default 0)" },
      },
      required: ["label", "target", "unit", "category"],
    },
  },
  {
    name: "delete_goal",
    description: "Delete a goal permanently. Confirm goal name in your response before calling.",
    input_schema: {
      type: "object" as const,
      properties: { id: { type: "string", description: "Goal ID from read_goals" } },
      required: ["id"],
    },
  },
  {
    name: "read_calendar",
    description: "Get upcoming Google Calendar events.",
    input_schema: {
      type: "object" as const,
      properties: { days: { type: "number", description: "How many days ahead to look (default 7)" } },
      required: [],
    },
  },
  {
    name: "create_calendar_event",
    description: "Create a Google Calendar event. Always preview title/time in your response first and confirm with Max.",
    input_schema: {
      type: "object" as const,
      properties: {
        title:       { type: "string", description: "Event title" },
        start:       { type: "string", description: "Start ISO 8601 (e.g. 2026-04-22T09:00:00)" },
        end:         { type: "string", description: "End ISO 8601" },
        description: { type: "string", description: "Optional description" },
        location:    { type: "string", description: "Optional location" },
      },
      required: ["title", "start", "end"],
    },
  },
  {
    name: "read_gmail",
    description: "Get recent Gmail inbox messages.",
    input_schema: {
      type: "object" as const,
      properties: { max_results: { type: "number", description: "Number of emails to fetch (default 10)" } },
      required: [],
    },
  },
  {
    name: "draft_email",
    description: "Create a draft email in Gmail. Always confirms after: never auto-sends.",
    input_schema: {
      type: "object" as const,
      properties: {
        to:      { type: "string", description: "Recipient email" },
        subject: { type: "string", description: "Email subject" },
        body:    { type: "string", description: "Email body" },
      },
      required: ["to", "subject", "body"],
    },
  },
  {
    name: "read_crypto",
    description: "Get live BTC and XRP prices with 24h and 7d changes.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "read_wealth",
    description: "Get Max's current financial holdings: IRA value, savings balance, BTC amount, XRP amount.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "update_wealth",
    description: "Update Max's financial holdings or savings. Only include the fields that are changing.",
    input_schema: {
      type: "object" as const,
      properties: {
        ira:        { type: "number", description: "Roth IRA total value in dollars" },
        savings:    { type: "number", description: "Savings/emergency fund balance in dollars" },
        btc_amount: { type: "number", description: "BTC amount held (e.g. 0.02)" },
        xrp_amount: { type: "number", description: "XRP amount held (e.g. 200)" },
      },
      required: [],
    },
  },
  {
    name: "read_weather",
    description: "Get current weather in Orlando.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "read_news",
    description: "Get the latest news headlines from the Intel Feed.",
    input_schema: {
      type: "object" as const,
      properties: { count: { type: "number", description: "Number of headlines (default 10)" } },
      required: [],
    },
  },
  {
    name: "store_memory",
    description: "Save something important to long-term memory — preferences, decisions, facts about Max, things to remember.",
    input_schema: {
      type: "object" as const,
      properties: {
        content: { type: "string", description: "What to remember" },
        tags:    { type: "array", items: { type: "string" }, description: "Category tags (e.g. ['preference', 'goal', 'finance'])" },
      },
      required: ["content"],
    },
  },
  {
    name: "recall_memory",
    description: "Search long-term memory for relevant stored information.",
    input_schema: {
      type: "object" as const,
      properties: { query: { type: "string", description: "Topic or keyword to search for" } },
      required: ["query"],
    },
  },
  {
    name: "read_all_memories",
    description: "Get all recent stored memories. Use when Max asks what M.A.X. remembers or to review memory.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "web_search",
    description: "Search the web for live information — news, prices, events, research.",
    input_schema: {
      type: "object" as const,
      properties: { query: { type: "string", description: "Search query" } },
      required: ["query"],
    },
  },
  {
    name: "get_budget_status",
    description: "Get Max's zero-based budget for the current month — income, total budgeted, total spent, per-category breakdown.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "get_transactions",
    description: "Get Max's recent transactions from connected bank accounts.",
    input_schema: {
      type: "object" as const,
      properties: { limit: { type: "number", description: "Number of transactions (default 20)" } },
      required: [],
    },
  },
  {
    name: "read_bills",
    description: "Get Max's monthly bills list with amounts and due days.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "set_income",
    description: "Update Max's monthly income setting used for budget calculations.",
    input_schema: {
      type: "object" as const,
      properties: { amount: { type: "number", description: "Monthly income in dollars" } },
      required: ["amount"],
    },
  },
  {
    name: "create_notification",
    description: "Push a notification to Max's dashboard bell. Use for important alerts or completed actions.",
    input_schema: {
      type: "object" as const,
      properties: {
        type:       { type: "string", enum: ["general", "crypto_alert", "habit_reminder", "bill_due", "calendar_reminder", "max_action", "budget_alert", "goal_milestone"], description: "Notification type" },
        title:      { type: "string", description: "Short notification title" },
        body:       { type: "string", description: "Notification body — one or two sentences" },
        action_url: { type: "string", description: "Optional URL to navigate to on click" },
      },
      required: ["type", "title", "body"],
    },
  },
  {
    name: "log_activity",
    description: "Log an action M.A.X. took to the activity feed. Call after completing significant actions.",
    input_schema: {
      type: "object" as const,
      properties: {
        type:        { type: "string", description: "Action type (e.g. 'task_created', 'goal_updated', 'email_drafted')" },
        description: { type: "string", description: "Human-readable description of what was done" },
      },
      required: ["type", "description"],
    },
  },
];

/* ─── Tool executor ─── */
async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  try {
    switch (name) {
      case "read_habits":          return JSON.stringify(await readHabits());
      case "toggle_habit":         return JSON.stringify(await toggleHabit(input.id as string, input.completed as boolean));
      case "add_habit":            return JSON.stringify(await addHabit(input.name as string, input.cat as string, input.color as string | undefined));
      case "delete_habit":         return JSON.stringify(await deleteHabit(input.id as string));
      case "read_tasks":           return JSON.stringify(await readTasks());
      case "add_task":             return JSON.stringify(await addTask(input.text as string, (input.priority as "high"|"medium"|"low") ?? "medium", input.due_date as string | undefined));
      case "complete_task":        return JSON.stringify(await completeTask(input.id as string));
      case "delete_task":          return JSON.stringify(await deleteTask(input.id as string));
      case "update_task":          return JSON.stringify(await updateTask(input.id as string, input as Parameters<typeof updateTask>[1]));
      case "read_goals":           return JSON.stringify(await readGoals());
      case "update_goal":          return JSON.stringify(await updateGoal(input.id as string, input.current as number));
      case "create_goal":          return JSON.stringify(await createGoal(input.label as string, input.target as number, input.unit as string, input.category as string, input.description as string | undefined, input.deadline as string | undefined, (input.current as number) ?? 0));
      case "delete_goal":          return JSON.stringify(await deleteGoal(input.id as string));
      case "read_calendar":        return JSON.stringify(await readCalendar((input.days as number) ?? 7));
      case "create_calendar_event":return JSON.stringify(await createCalendarEvent(input.title as string, input.start as string, input.end as string, (input.description as string) ?? "", (input.location as string) ?? ""));
      case "read_gmail":           return JSON.stringify(await readGmail((input.max_results as number) ?? 10));
      case "draft_email":          return JSON.stringify(await draftEmail(input.to as string, input.subject as string, input.body as string));
      case "read_crypto":          return JSON.stringify(await readCrypto());
      case "read_wealth":          return JSON.stringify(await readWealth());
      case "update_wealth":        return JSON.stringify(await updateWealth(input as Parameters<typeof updateWealth>[0]));
      case "read_weather":         return JSON.stringify(await readWeather());
      case "read_news":            return JSON.stringify(await readNews((input.count as number) ?? 10));
      case "store_memory":         return JSON.stringify(await storeMemory(input.content as string, (input.tags as string[]) ?? []));
      case "recall_memory":        return JSON.stringify(await recallMemory(input.query as string));
      case "read_all_memories":    return JSON.stringify(await readAllMemories());
      case "web_search":           return JSON.stringify(await webSearch(input.query as string));
      case "get_budget_status":    return JSON.stringify(await getBudgetStatus());
      case "get_transactions":     return JSON.stringify(await getRecentTransactions((input.limit as number) ?? 20));
      case "read_bills":           return JSON.stringify(await readBills());
      case "set_income":           return JSON.stringify(await setIncome(input.amount as number));
      case "create_notification":  return JSON.stringify(await createNotification(input.type as string, input.title as string, input.body as string, input.action_url as string | undefined));
      case "log_activity":         return JSON.stringify(await logActivity(input.type as string, input.description as string));
      default:                     return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (err) {
    return JSON.stringify({ error: String(err) });
  }
}

/* ─── Supabase (server-side only) ─── */
import { createClient as _createClient } from "@supabase/supabase-js";
const _sb = () => _createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/* ─── Context injection ─── */
export async function buildContextHeader(): Promise<string> {
  const now = new Date().toLocaleString("en-US", {
    timeZone: "America/New_York", weekday: "long", year: "numeric",
    month: "long", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
  });

  const sb = _sb();
  const today = new Date().toISOString().slice(0, 10);
  const periodStart = today.slice(0, 7) + "-01";

  const [
    habitsRes, tasksRes, cryptoRes, weatherRes,
    goalsRes, wealthRes, memoriesRes, billsRes,
    txRes, budgetAllocRes, styleRes,
  ] = await Promise.allSettled([
    readHabits(),
    readTasks(),
    readCrypto(),
    readWeather(),
    sb.from("goals").select("label,current,target,unit,deadline").order("deadline").limit(5),
    readWealth(),
    sb.from("memories").select("content").order("created_at", { ascending: false }).limit(3),
    sb.from("bills").select("name,amt,due_day").order("due_day"),
    sb.from("transactions").select("amount,budget_category,pending").gte("date", periodStart).gt("amount", 0),
    sb.from("budget_allocations").select("category,budgeted").eq("period_start", periodStart),
    sb.from("writing_style").select("*").limit(1),
  ]);

  let ctx = `[CURRENT TIME: ${now} ET]\n`;

  // Habits
  if (habitsRes.status === "fulfilled" && habitsRes.value.length > 0) {
    const done  = habitsRes.value.filter((h: { completed: boolean }) => h.completed).length;
    const total = habitsRes.value.length;
    const names = habitsRes.value
      .filter((h: { completed: boolean }) => !h.completed)
      .map((h: { name: string }) => h.name)
      .slice(0, 3);
    ctx += `[HABITS: ${done}/${total} done today${names.length > 0 ? ` — still open: ${names.join(", ")}` : " — all complete ✓"}]\n`;
  }

  // Tasks
  if (tasksRes.status === "fulfilled") {
    const open = tasksRes.value.filter((t: { completed: boolean }) => !t.completed);
    const high = open.filter((t: { priority: string }) => t.priority === "high");
    const overdue = open.filter((t: { due_date?: string }) => t.due_date && t.due_date < today);
    ctx += `[TASKS: ${open.length} open${high.length > 0 ? `, ${high.length} high-priority` : ""}${overdue.length > 0 ? `, ${overdue.length} overdue` : ""}]\n`;
  }

  // Crypto + net worth
  const crypto = cryptoRes.status === "fulfilled" ? cryptoRes.value : [];
  const wealth = wealthRes.status === "fulfilled" ? wealthRes.value : null;
  const btc = crypto.find((c: { symbol: string }) => c.symbol === "BTC");
  const xrp = crypto.find((c: { symbol: string }) => c.symbol === "XRP");

  if (btc) ctx += `[BTC: $${Math.round(btc.price).toLocaleString()} (${btc.change24h >= 0 ? "+" : ""}${btc.change24h.toFixed(2)}% 24h)]\n`;
  if (xrp) ctx += `[XRP: $${xrp.price.toFixed(4)} (${xrp.change24h >= 0 ? "+" : ""}${xrp.change24h.toFixed(2)}% 24h)]\n`;

  if (wealth && (btc || xrp)) {
    const btcVal  = btc ? btc.price * (wealth.btc_amount ?? 0) : 0;
    const xrpVal  = xrp ? xrp.price * (wealth.xrp_amount ?? 0) : 0;
    const netWorth = btcVal + xrpVal + (wealth.ira ?? 0) + (wealth.savings ?? 0);
    ctx += `[NET WORTH: $${netWorth.toLocaleString("en-US", { maximumFractionDigits: 0 })} | Savings: $${(wealth.savings ?? 0).toLocaleString()} | IRA: $${(wealth.ira ?? 0).toLocaleString()}]\n`;
  }

  // Weather
  if (weatherRes.status === "fulfilled" && weatherRes.value) {
    const w = weatherRes.value;
    ctx += `[WEATHER: ${w.tempF}°F, ${w.condition}, ${w.precipChance}% rain in Orlando]\n`;
  }

  // Goals (top 3 by deadline)
  if (goalsRes.status === "fulfilled" && goalsRes.value.data?.length) {
    const goals = (goalsRes.value.data as { label: string; current: number; target: number; unit: string; deadline: string | null }[])
      .filter(g => g.target > 0)
      .slice(0, 3);
    const parts = goals.map(g => {
      const pct = Math.round((g.current / g.target) * 100);
      return `${g.label} ${pct}%${g.deadline ? ` (due ${g.deadline})` : ""}`;
    });
    if (parts.length > 0) ctx += `[GOALS: ${parts.join(" | ")}]\n`;
  }

  // Budget — real spend vs allocation
  if (txRes.status === "fulfilled" && budgetAllocRes.status === "fulfilled") {
    const txs   = txRes.value.data ?? [];
    const allocs = budgetAllocRes.value.data ?? [];
    const spend: Record<string, number> = {};
    for (const tx of txs as { amount: number; budget_category: string | null; pending: boolean }[]) {
      if (tx.pending) continue;
      const cat = tx.budget_category ?? "Misc";
      spend[cat] = (spend[cat] ?? 0) + tx.amount;
    }
    const totalSpent    = Object.values(spend).reduce((s, v) => s + v, 0);
    const totalBudgeted = (allocs as { budgeted: number }[]).reduce((s, a) => s + a.budgeted, 0);
    const overCats      = (allocs as { category: string; budgeted: number }[])
      .filter(a => (spend[a.category] ?? 0) > a.budgeted)
      .map(a => a.category);
    if (totalBudgeted > 0) {
      ctx += `[BUDGET: $${Math.round(totalSpent).toLocaleString()} spent of $${Math.round(totalBudgeted).toLocaleString()} this month${overCats.length > 0 ? ` | OVER in: ${overCats.join(", ")}` : " | all on track"}]\n`;
    }
  }

  // Upcoming bills (due within 7 days)
  if (billsRes.status === "fulfilled" && (billsRes.value.data?.length ?? 0) > 0) {
    const dayOfMonth = new Date().getDate();
    const upcoming = ((billsRes.value.data ?? []) as { name: string; amt: number; due_day: number }[])
      .map(b => ({ ...b, daysUntil: b.due_day >= dayOfMonth ? b.due_day - dayOfMonth : 31 - dayOfMonth + b.due_day }))
      .filter(b => b.daysUntil <= 7)
      .sort((a, b) => a.daysUntil - b.daysUntil);
    if (upcoming.length > 0) {
      const parts = upcoming.map(b => `${b.name} $${b.amt} in ${b.daysUntil}d`);
      ctx += `[BILLS DUE SOON: ${parts.join(" | ")}]\n`;
    }
  }

  // Recent memories
  if (memoriesRes.status === "fulfilled" && memoriesRes.value.data?.length) {
    const mems = (memoriesRes.value.data as { content: string }[]).map(m => m.content.slice(0, 80));
    ctx += `[RECENT MEMORY: ${mems.join(" | ")}]\n`;
  }

  // Writing style
  if (styleRes.status === "fulfilled" && styleRes.value.data?.[0]) {
    const row  = styleRes.value.data[0] as Record<string, unknown>;
    const tone = row.tone ?? row.summary ?? null;
    if (tone) ctx += `[MAX'S WRITING STYLE: ${String(tone).slice(0, 120)}]\n`;
  }

  return ctx;
}

/* ─── Agent event type ─── */
export type AgentEvent =
  | { t: "tool";  label: string }
  | { t: "chunk"; text: string }
  | { t: "done";  full: string; tools: string[] };

/* ─── Streaming agentic loop ─── */
export async function runAgentStream(
  messages: AgentMessage[],
  injectContext: boolean,
  onEvent: (event: AgentEvent) => void,
): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    onEvent({ t: "chunk", text: "M.A.X. offline — API key missing." });
    onEvent({ t: "done", full: "M.A.X. offline — API key missing.", tools: [] });
    return;
  }

  const apiMessages: Anthropic.MessageParam[] = messages.slice(-16).map(m => ({
    role: m.role,
    content: m.content,
  }));

  // Inject context into the LAST user message (the current request)
  if (injectContext) {
    const lastUserIdx = apiMessages.reduce((found, m, i) => m.role === "user" ? i : found, -1);
    if (lastUserIdx >= 0) {
      const ctx = await buildContextHeader();
      apiMessages[lastUserIdx] = {
        role: "user",
        content: `${ctx}\n${apiMessages[lastUserIdx].content}`,
      };
    }
  }

  const MAX_ITERATIONS = 8;
  let iterations = 0;
  let fullText   = "";
  const allTools: string[] = [];

  while (true) {
    const stream = client.messages.stream({
      model: MODEL, max_tokens: MAX_TOKENS, system: SYSTEM, tools: TOOLS, messages: apiMessages,
    });

    let localText = "";

    for await (const event of stream) {
      if (event.type === "content_block_start" && event.content_block.type === "tool_use") {
        const label = TOOL_LABELS[event.content_block.name] ?? `Running ${event.content_block.name}…`;
        allTools.push(label);
        onEvent({ t: "tool", label });
      }
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        onEvent({ t: "chunk", text: event.delta.text });
        localText += event.delta.text;
      }
    }

    const finalMsg = await stream.finalMessage();

    if (finalMsg.stop_reason !== "tool_use" || iterations >= MAX_ITERATIONS) {
      fullText = localText;
      break;
    }

    iterations++;

    const toolUseBlocks = finalMsg.content.filter(b => b.type === "tool_use") as Anthropic.ToolUseBlock[];
    const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
      toolUseBlocks.map(async (block) => ({
        type: "tool_result" as const,
        tool_use_id: block.id,
        content: await executeTool(block.name, block.input as Record<string, unknown>),
      }))
    );

    apiMessages.push({ role: "assistant", content: finalMsg.content });
    apiMessages.push({ role: "user",      content: toolResults });
  }

  onEvent({ t: "done", full: fullText, tools: allTools });
}

/* ─── Non-streaming loop (Telegram + internal) ─── */
export interface AgentMessage {
  role: "user" | "assistant";
  content: string;
}

export async function runAgent(messages: AgentMessage[], injectContext = true): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) return "M.A.X. offline — API key missing.";

  const apiMessages: Anthropic.MessageParam[] = messages.slice(-16).map(m => ({
    role: m.role,
    content: m.content,
  }));

  // Inject context into the last user message
  if (injectContext) {
    const lastUserIdx = apiMessages.reduce((found, m, i) => m.role === "user" ? i : found, -1);
    if (lastUserIdx >= 0) {
      const ctx = await buildContextHeader();
      apiMessages[lastUserIdx] = {
        role: "user",
        content: `${ctx}\n${apiMessages[lastUserIdx].content}`,
      };
    }
  }

  let response = await client.messages.create({
    model: MODEL, max_tokens: MAX_TOKENS, system: SYSTEM, tools: TOOLS, messages: apiMessages,
  });

  const MAX_ITERATIONS = 8;
  let iterations = 0;

  while (response.stop_reason === "tool_use" && iterations < MAX_ITERATIONS) {
    iterations++;

    const toolUseBlocks = response.content.filter(b => b.type === "tool_use") as Anthropic.ToolUseBlock[];
    const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
      toolUseBlocks.map(async (block) => ({
        type: "tool_result" as const,
        tool_use_id: block.id,
        content: await executeTool(block.name, block.input as Record<string, unknown>),
      }))
    );

    apiMessages.push({ role: "assistant", content: response.content });
    apiMessages.push({ role: "user",      content: toolResults });

    response = await client.messages.create({
      model: MODEL, max_tokens: MAX_TOKENS, system: SYSTEM, tools: TOOLS, messages: apiMessages,
    });
  }

  const textBlock = response.content.find(b => b.type === "text") as Anthropic.TextBlock | undefined;
  return textBlock?.text ?? "No response.";
}

/* ─── Proactive brief (chat load) ─── */
export async function generateBrief(): Promise<string> {
  const h = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" })).getHours();
  const timeOfDay = h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";

  return runAgent([{
    role: "user",
    content: `Give me a tight ${timeOfDay} brief. Pull habits, tasks, and crypto together. 4–6 bullets max, one sentence each. Lead with whatever's most urgent or notable right now. No filler.`,
  }], true);
}
