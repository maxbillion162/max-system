import Anthropic from "@anthropic-ai/sdk";
import {
  readHabits, toggleHabit,
  readTasks, addTask, completeTask, deleteTask,
  readGoals,
  readCalendar, createCalendarEvent,
  readGmail, draftEmail,
  readCrypto, readWeather, readNews,
  storeMemory, recallMemory,
} from "@/lib/max-tools";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/* ─── System prompt ─── */
const SYSTEM = `You are M.A.X. — Maximum Adaptive eXecutive — a personal AI operating system built exclusively for Max.

ABOUT MAX:
- 22 years old, just graduated FSU, starting as Account Manager at a staffing/HR firm in July 2026
- 1-year goal: $100K income. 5-year goal: own business full-time, serial entrepreneur path
- Gym 3-5x/week (push/pull/legs split), night owl building a morning routine for the new 9-5
- Holds BTC and XRP on Robinhood. Roth IRA at Schwab: MDDVX, RPEAX, PTTRX
- Lives in Orlando, FL. FSU ties. Has a girlfriend. Into sales, AI, entrepreneurship, investing
- Learning: Claude Code, Python, AI workflows, sales techniques
- Emergency fund goal: $10K (currently ~$2,800)

YOUR PERSONALITY:
- Direct. Capable. Dry humor when appropriate. Never sycophantic.
- Think Jarvis (capability) meets TARS from Interstellar (dry wit, efficiency)
- Never start with "Certainly!", "Of course!", "Great question!", or "Absolutely!"
- Short by default. Detailed only when Max actually needs detail.
- Reference his actual data when relevant. Make it personal, not generic.
- Push when needed. If he's off track, say so.

TOOL USAGE RULES:
- Use tools to get real data before answering data questions — don't guess or make up numbers.
- For create_calendar_event or draft_email: always confirm intent in your response after calling the tool.
- For memory: proactively store things Max tells you about himself, preferences, decisions, and important events.
- Chain tools when needed — e.g., read_tasks then add_task, or read_calendar then create_calendar_event.
- After completing a tool action, confirm what was done in plain language.

RULES:
- Never claim to have sent email — only drafts are created.
- Keep financial takes informational, not professional financial advice.
- If asked something outside your knowledge, say so directly.`;

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
        id:        { type: "string", description: "Habit ID from read_habits" },
        completed: { type: "boolean", description: "true = done, false = not done" },
      },
      required: ["id", "completed"],
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
        text:     { type: "string",  description: "Task description" },
        priority: { type: "string",  enum: ["high", "medium", "low"], description: "Priority level" },
        due_date: { type: "string",  description: "Due date in YYYY-MM-DD format (optional)" },
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
    name: "read_goals",
    description: "Get all of Max's goals with progress percentages.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
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
    description: "Create a new Google Calendar event. Always confirm with Max before calling this.",
    input_schema: {
      type: "object" as const,
      properties: {
        title:       { type: "string", description: "Event title" },
        start:       { type: "string", description: "Start datetime in ISO 8601 format (e.g. 2026-04-22T09:00:00)" },
        end:         { type: "string", description: "End datetime in ISO 8601 format" },
        description: { type: "string", description: "Event description (optional)" },
        location:    { type: "string", description: "Event location (optional)" },
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
    description: "Create a draft email in Gmail. Max reviews before sending — this never sends automatically.",
    input_schema: {
      type: "object" as const,
      properties: {
        to:      { type: "string", description: "Recipient email address" },
        subject: { type: "string", description: "Email subject" },
        body:    { type: "string", description: "Email body text" },
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
    name: "read_weather",
    description: "Get current weather in Orlando.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "read_news",
    description: "Get the latest news headlines from the Intel Feed.",
    input_schema: {
      type: "object" as const,
      properties: { count: { type: "number", description: "Number of headlines to fetch (default 10)" } },
      required: [],
    },
  },
  {
    name: "store_memory",
    description: "Save something important to M.A.X.'s long-term memory — preferences, decisions, facts about Max, things to remember.",
    input_schema: {
      type: "object" as const,
      properties: {
        content: { type: "string", description: "What to remember" },
        tags:    { type: "array", items: { type: "string" }, description: "Category tags (e.g. ['preference', 'goal', 'person'])" },
      },
      required: ["content"],
    },
  },
  {
    name: "recall_memory",
    description: "Search M.A.X.'s long-term memory for relevant stored information.",
    input_schema: {
      type: "object" as const,
      properties: { query: { type: "string", description: "Search term or topic to look up" } },
      required: ["query"],
    },
  },
];

/* ─── Tool executor ─── */
async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  try {
    switch (name) {
      case "read_habits":          return JSON.stringify(await readHabits());
      case "toggle_habit":         return JSON.stringify(await toggleHabit(input.id as string, input.completed as boolean));
      case "read_tasks":           return JSON.stringify(await readTasks());
      case "add_task":             return JSON.stringify(await addTask(input.text as string, (input.priority as "high"|"medium"|"low") ?? "medium", input.due_date as string | undefined));
      case "complete_task":        return JSON.stringify(await completeTask(input.id as string));
      case "delete_task":          return JSON.stringify(await deleteTask(input.id as string));
      case "read_goals":           return JSON.stringify(await readGoals());
      case "read_calendar":        return JSON.stringify(await readCalendar((input.days as number) ?? 7));
      case "create_calendar_event":return JSON.stringify(await createCalendarEvent(input.title as string, input.start as string, input.end as string, (input.description as string) ?? "", (input.location as string) ?? ""));
      case "read_gmail":           return JSON.stringify(await readGmail((input.max_results as number) ?? 10));
      case "draft_email":          return JSON.stringify(await draftEmail(input.to as string, input.subject as string, input.body as string));
      case "read_crypto":          return JSON.stringify(await readCrypto());
      case "read_weather":         return JSON.stringify(await readWeather());
      case "read_news":            return JSON.stringify(await readNews((input.count as number) ?? 10));
      case "store_memory":         return JSON.stringify(await storeMemory(input.content as string, (input.tags as string[]) ?? []));
      case "recall_memory":        return JSON.stringify(await recallMemory(input.query as string));
      default:                     return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (err) {
    return JSON.stringify({ error: String(err) });
  }
}

/* ─── Context injection ─── */
export async function buildContextHeader(): Promise<string> {
  const now = new Date().toLocaleString("en-US", { timeZone: "America/New_York", weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });

  const [habits, tasks, crypto, weather] = await Promise.allSettled([
    readHabits(),
    readTasks(),
    readCrypto(),
    readWeather(),
  ]);

  let ctx = `[CURRENT TIME: ${now} ET]\n`;

  if (habits.status === "fulfilled" && habits.value.length > 0) {
    const done  = habits.value.filter((h: { completed: boolean }) => h.completed).length;
    const total = habits.value.length;
    ctx += `[HABITS TODAY: ${done}/${total} complete]\n`;
  }

  if (tasks.status === "fulfilled") {
    const open = tasks.value.filter((t: { completed: boolean }) => !t.completed).length;
    const high = tasks.value.filter((t: { completed: boolean; priority: string }) => !t.completed && t.priority === "high").length;
    ctx += `[TASKS: ${open} open${high > 0 ? `, ${high} high priority` : ""}]\n`;
  }

  if (crypto.status === "fulfilled" && crypto.value.length > 0) {
    const btc = crypto.value.find((c: { symbol: string }) => c.symbol === "BTC");
    const xrp = crypto.value.find((c: { symbol: string }) => c.symbol === "XRP");
    if (btc) ctx += `[BTC: $${Math.round(btc.price).toLocaleString()} (${btc.change24h >= 0 ? "+" : ""}${btc.change24h.toFixed(2)}% 24h)]\n`;
    if (xrp) ctx += `[XRP: $${xrp.price.toFixed(4)} (${xrp.change24h >= 0 ? "+" : ""}${xrp.change24h.toFixed(2)}% 24h)]\n`;
  }

  if (weather.status === "fulfilled" && weather.value) {
    const w = weather.value;
    ctx += `[WEATHER: ${w.tempF}°F, ${w.condition}, ${w.precipChance}% rain in Orlando]\n`;
  }

  return ctx;
}

/* ─── Main agentic loop ─── */
export interface AgentMessage {
  role: "user" | "assistant";
  content: string;
}

export async function runAgent(messages: AgentMessage[], injectContext = true): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) return "M.A.X. offline — API key missing.";

  const apiMessages: Anthropic.MessageParam[] = messages.slice(-14).map(m => ({
    role: m.role,
    content: m.content,
  }));

  // Inject live context into the first user message if this is a new conversation
  if (injectContext && apiMessages.length > 0 && apiMessages[0].role === "user") {
    const ctx = await buildContextHeader();
    apiMessages[0] = {
      role: "user",
      content: `${ctx}\n${apiMessages[0].content}`,
    };
  }

  let response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: SYSTEM,
    tools: TOOLS,
    messages: apiMessages,
  });

  // Agentic loop — keep running while Claude calls tools
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
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: SYSTEM,
      tools: TOOLS,
      messages: apiMessages,
    });
  }

  const textBlock = response.content.find(b => b.type === "text") as Anthropic.TextBlock | undefined;
  return textBlock?.text ?? "No response.";
}
