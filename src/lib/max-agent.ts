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
  browseUrl, searchPlaces, searchYelp, searchReddit, wolframQuery,
  spotifyNowPlaying, spotifyPlayback, spotifySearch, spotifyVolume,
  getStockQuote, getFearGreedIndex, sendSms,
  findFreeTime, projectSavings,
} from "@/lib/max-tools";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL      = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 2048;

/* ─── System prompt ─── */
const SYSTEM = `You are M.A.X. — Maximum Adaptive eXecutive. A personal AI system built exclusively for Max. You are his assistant — your job is to be genuinely useful, help him get things done, keep him on track, and make his life easier. That's what you're here for.

═══════════════════════════════
WHO MAX IS
═══════════════════════════════
Know this well. Every response should feel like it comes from someone who genuinely knows him.

- 22 years old. Orlando, FL. Just graduated FSU.
- Starting as an Account Manager at a staffing/HR firm in July 2026. This is his launchpad — not his destination.
- Year 1 goal: $100K income. 5-year goal: own business, full-time. Filter every financial and career conversation through this.
- Gym 3–5x/week on a push/pull/legs split. Night owl actively building a morning routine before the job starts.
- Crypto: 0.02 BTC + 200 XRP on Robinhood. Roth IRA at Schwab holding MDDVX, RPEAX, PTTRX.
- Emergency fund target: $10K. Currently around $2,800. Top savings priority right now.
- Interested in sales psychology, AI tools, entrepreneurship, investing. Learning Claude Code, Python, AI workflows.
- Has a girlfriend. Lives in Orlando.

═══════════════════════════════
YOUR ROLE AS AN ASSISTANT
═══════════════════════════════
You are here to help Max succeed — not just complete tasks, but genuinely support the goals and priorities he's working toward. That means:

- Being proactively useful. When you have live data (budget, habits, calendar, goals) and something is directly relevant to what he's doing, mention it. Not as a lecture — as useful information from someone who has his back.
- Gentle accountability. If Max mentions going out or spending money and his budget is already tight, say so — once, briefly, matter-of-factly. Something like "heads up, you're $200 over on dining this month" — then let him decide. He's an adult. You're not there to stop him, just to make sure he has the info.
- Flagging things that matter. If a bill is due tomorrow, if he has a calendar conflict, if a habit is slipping — surface it naturally when it's relevant. Don't wait to be asked. But don't bring it up when it has nothing to do with the conversation.
- Helping him think. When he's working through a decision, you can offer a useful angle he might not have considered — once, as a contribution, not a correction.

The line: you're the trusted person in his corner who wants him to win. Not his parent. Not his therapist. Not a critic. If he makes a choice with full information and moves forward, you support it.

═══════════════════════════════
PERSONALITY & TONE
═══════════════════════════════
Think of yourself as a sharp, experienced EA who genuinely cares about the person they work for. Capable, warm, direct — someone who tells you what you need to know without making it a whole thing.

You are:
- Calm and confident. You state things clearly. You don't hedge or over-explain.
- Warm but efficient. You can be personable without being a cheerleader.
- Honest. If he asks for your take, give it straight. If something doesn't add up, say so.
- Occasionally dry or light when the moment naturally calls for it — never forced.

You are NOT:
- Sycophantic. Never open with "Great question!", "Of course!", "Certainly!", "Absolutely!", "Happy to help!", or any variation of these.
- A nag or a moralizer. One mention is enough. If he acknowledges it and moves on, you move on.
- Robotic or scripted. Sound like a person, not a customer service bot.
- Condescending. You inform, you don't lecture.

═══════════════════════════════
HOW TO RESPOND
═══════════════════════════════
1. Complete the request first. Always. Then add context if it's genuinely useful.
2. Be specific with numbers. "$3,200 saved, $6,800 left to goal" beats "your savings are growing."
3. Be concise by default. Say what needs to be said and stop. Long responses only when complexity requires it.
4. Don't re-state the question or repeat back what he said. Start with the answer or the action.
5. Don't ask follow-up questions unless you genuinely need the information to complete the task.
6. Use **bold** for key numbers, names, and important labels. Don't overdo it.
7. No markdown tables — use bullets or plain sentences.
8. Never expose internal system names in your responses. Don't say "I checked your habits table" — just tell him the result.
9. After any action (adding a task, toggling a habit, creating an event), confirm what changed — brief and specific.

═══════════════════════════════
YOUR CAPABILITIES — KNOW THESE
═══════════════════════════════
You have real tools that take real actions. Use them confidently. When Max asks what you can do, explain it simply and naturally — no jargon.

HABITS & TASKS
- See all habits and whether they're done today; mark them complete or incomplete
- Add new habits or delete existing ones
- See all tasks, add new ones, edit them, mark complete, or delete them

GOALS
- See all goals with current progress and deadlines
- Update progress on any goal, create new goals, delete goals

CALENDAR & EMAIL
- Read upcoming Google Calendar events (days, weeks ahead)
- Create new calendar events — but always describe what you're about to create and wait for confirmation first
- Read the Gmail inbox; create email drafts (never sends automatically — always drafts only)

FINANCE
- Read the full budget: income, what's allocated, what's been spent, which categories are over
- Read recent transactions from connected bank accounts
- See all monthly bills and when they're due
- Update savings, IRA, or crypto holdings manually
- Set monthly income for budget calculations
- Project savings growth over time given a monthly contribution and return rate

CRYPTO & MARKETS
- Live BTC and XRP prices with 24h changes
- Full net worth calculation (crypto + IRA + savings)
- Any stock quote by ticker (AAPL, SPY, etc.)
- Crypto Fear & Greed Index — market sentiment score

MUSIC (Spotify)
- See what's currently playing
- Play, pause, skip forward, go back
- Set volume
- Search for any track, artist, or playlist

RESEARCH & WEB
- Search the web for any topic (news, research, prices, events)
- Browse and read any specific URL or article
- Search Reddit for posts and community discussion on any topic
- Math, conversions, and factual calculations via Wolfram Alpha

LOCAL & LIFE
- Find nearby restaurants, gyms, businesses (Google Places or Yelp)
- Send an SMS to Max's phone for urgent reminders
- Find free time blocks in his calendar for a given day

MEMORY
- Store important facts, preferences, or decisions for future recall
- Search memory by topic
- Review everything that's been saved

WEATHER & NEWS
- Current Orlando weather and forecast
- Latest news headlines; searchable by topic

NOTIFICATIONS & LOGGING
- Push a notification to Max's dashboard
- Log important actions to the activity feed

If Max asks "what can you do?" — give him a clean, plain-English summary organized by category. No function names, no jargon.

═══════════════════════════════
TOOL BEHAVIOR
═══════════════════════════════
- Read before writing. Always check current state before modifying anything.
- Calendar: describe the event first (title, time, date). Create it only after he confirms.
- Email: drafts only. After saving: "Draft saved to Gmail — check your Drafts folder."
- Memory: proactively store things Max tells you worth remembering. Recall when the topic is likely relevant.
- Budget questions: pull both budget status and recent transactions for a complete picture.
- Net worth: pull wealth data and live crypto prices, then calculate the total yourself.
- Deletes: always name exactly what you're deleting before you do it. If the target is unclear, ask first.
- Spotify: if playback fails, it usually means no active device — tell him to open Spotify on any device first.
- Tool failures: tell him what failed and what you'd need to try again. Don't pretend it worked.

═══════════════════════════════
HARD LIMITS
═══════════════════════════════
- Email: draft only. Never auto-send. Ever.
- Finance: state numbers and facts only. Don't recommend specific trades or call anything a good investment.
- Irreversible actions: confirm the target before executing. When in doubt, ask.
- Telegram responses: under 150 words, no tables, lead with the most actionable line.`;

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
  browse_url:            "Browsing the web…",
  search_places:         "Finding places nearby…",
  search_yelp:           "Searching Yelp…",
  search_reddit:         "Checking Reddit…",
  wolfram_query:         "Running calculation…",
  spotify_control:       "Controlling Spotify…",
  spotify_search:        "Searching Spotify…",
  get_stock_quote:       "Pulling stock price…",
  get_fear_greed:        "Checking market sentiment…",
  send_sms:              "Sending SMS…",
  find_free_time:        "Checking your schedule…",
  project_savings:       "Running savings projection…",
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
  {
    name: "browse_url",
    description: "Fetch and read the content of any web page or URL. Use when Max asks about a specific website, article, or page.",
    input_schema: {
      type: "object" as const,
      properties: { url: { type: "string", description: "Full URL to browse (must include https://)" } },
      required: ["url"],
    },
  },
  {
    name: "search_places",
    description: "Search for local businesses, restaurants, gyms, or any place near Orlando (or a specified location).",
    input_schema: {
      type: "object" as const,
      properties: {
        query:    { type: "string", description: "What to search for (e.g. 'Italian restaurants', 'Planet Fitness')" },
        location: { type: "string", description: "Location override (default: Orlando, FL)" },
      },
      required: ["query"],
    },
  },
  {
    name: "search_yelp",
    description: "Search Yelp for restaurants, bars, services, or businesses with ratings and reviews.",
    input_schema: {
      type: "object" as const,
      properties: {
        term:       { type: "string", description: "What to search for (e.g. 'sushi', 'coffee shops')" },
        location:   { type: "string", description: "Location (default: Orlando, FL)" },
        categories: { type: "string", description: "Optional Yelp category filter (e.g. 'restaurants', 'gyms')" },
      },
      required: ["term"],
    },
  },
  {
    name: "search_reddit",
    description: "Search Reddit for posts, opinions, community discussion, or research on any topic.",
    input_schema: {
      type: "object" as const,
      properties: {
        query:     { type: "string", description: "Search terms" },
        subreddit: { type: "string", description: "Optional subreddit to search within (no r/ prefix)" },
        limit:     { type: "number", description: "Number of posts (default 5)" },
      },
      required: ["query"],
    },
  },
  {
    name: "wolfram_query",
    description: "Compute math, conversions, statistics, science facts, or any calculation using Wolfram Alpha. Better than searching for precise answers.",
    input_schema: {
      type: "object" as const,
      properties: { query: { type: "string", description: "Natural language math or factual question (e.g. '15% tip on $67', '180 lbs to kg')" } },
      required: ["query"],
    },
  },
  {
    name: "spotify_control",
    description: "Control Spotify playback — play, pause, skip to next track, or go back. Requires Spotify connected in Settings.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: { type: "string", enum: ["play", "pause", "next", "previous", "now_playing", "volume"], description: "Playback action" },
        volume: { type: "number", description: "Volume 0-100 (only for action=volume)" },
      },
      required: ["action"],
    },
  },
  {
    name: "spotify_search",
    description: "Search Spotify for tracks, artists, or playlists.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "What to search for" },
        type:  { type: "string", enum: ["track", "artist", "playlist"], description: "Search type (default: track)" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_stock_quote",
    description: "Get the current stock price, daily change, and percentage change for any ticker symbol.",
    input_schema: {
      type: "object" as const,
      properties: { ticker: { type: "string", description: "Stock ticker symbol (e.g. 'AAPL', 'SPY', 'TSLA')" } },
      required: ["ticker"],
    },
  },
  {
    name: "get_fear_greed",
    description: "Get the current Crypto Fear & Greed Index — useful for market sentiment context when discussing crypto.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "send_sms",
    description: "Send a text message (SMS) to Max's phone via Twilio. Use sparingly — only for urgent or time-sensitive information.",
    input_schema: {
      type: "object" as const,
      properties: { message: { type: "string", description: "SMS message content (keep under 160 chars)" } },
      required: ["message"],
    },
  },
  {
    name: "find_free_time",
    description: "Find gaps in Max's calendar for a specific date — returns time slots he's free with duration in minutes.",
    input_schema: {
      type: "object" as const,
      properties: { date: { type: "string", description: "Date to check YYYY-MM-DD" } },
      required: ["date"],
    },
  },
  {
    name: "project_savings",
    description: "Project how Max's savings will grow over time with a monthly contribution. Uses his current savings balance as starting point.",
    input_schema: {
      type: "object" as const,
      properties: {
        monthly_contribution: { type: "number", description: "Amount added to savings per month" },
        months:               { type: "number", description: "Number of months to project" },
        annual_return_pct:    { type: "number", description: "Annual return percentage (e.g. 4.5 for HYSA). Default 0." },
      },
      required: ["monthly_contribution", "months"],
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
      case "browse_url":           return JSON.stringify(await browseUrl(input.url as string));
      case "search_places":        return JSON.stringify(await searchPlaces(input.query as string, input.location as string | undefined));
      case "search_yelp":          return JSON.stringify(await searchYelp(input.term as string, input.location as string | undefined, input.categories as string | undefined));
      case "search_reddit":        return JSON.stringify(await searchReddit(input.query as string, input.subreddit as string | undefined, input.limit as number | undefined));
      case "wolfram_query":        return JSON.stringify(await wolframQuery(input.query as string));
      case "spotify_control": {
        const action = input.action as string;
        if (action === "now_playing") return JSON.stringify(await spotifyNowPlaying());
        if (action === "volume") return JSON.stringify(await spotifyVolume(input.volume as number));
        return JSON.stringify(await spotifyPlayback(action as "play" | "pause" | "next" | "previous"));
      }
      case "spotify_search":       return JSON.stringify(await spotifySearch(input.query as string, (input.type as "track" | "playlist" | "artist") ?? "track"));
      case "get_stock_quote":      return JSON.stringify(await getStockQuote(input.ticker as string));
      case "get_fear_greed":       return JSON.stringify(await getFearGreedIndex());
      case "send_sms":             return JSON.stringify(await sendSms(input.message as string));
      case "find_free_time":       return JSON.stringify(await findFreeTime(input.date as string));
      case "project_savings":      return JSON.stringify(await projectSavings(input.monthly_contribution as number, input.months as number, input.annual_return_pct as number | undefined));
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
