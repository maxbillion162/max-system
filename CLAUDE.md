# M.A.X. — Maximum Adaptive eXecutive
## Claude Code Context File

---

## ⚠️ MAINTENANCE RULE (READ THIS FIRST)

This file must stay accurate. When you make changes that affect what's documented here, update this file in the same session before finishing:

- **New page or API route added** → update Project Structure
- **New Supabase table created** → update Supabase Tables
- **Agent tools added or removed** → update The Agent System tools list
- **New API key / service integrated** → update Tech Stack
- **Coding or design rule changes** → update the relevant section

Do NOT document volatile implementation details (specific prop names, internal function signatures) — those go stale fast. Document stable architecture, patterns, and rules only. Read source files directly for low-level details.

---

## WHAT THIS PROJECT IS

M.A.X. is a fully autonomous personal AI agent built exclusively for Max. M.A.X. is best thought of as an entity — it doesn't live in one place, it exists across three equal surfaces:

- **Web dashboard** — master command center; all data visible in one place, manual controls, full chat interface
- **Floating chat bubble** — available on every dashboard page for quick queries without leaving context
- **Telegram** — mobile interface; equal in capability, primary for on-the-go use and proactive notifications

The agent is the product. All three surfaces are interfaces to the same underlying agent.

**Live URL:** max-system-dusky.vercel.app  
**Vision:** Jarvis-level autonomous assistant. M.A.X. should proactively plan, remind, warn, and complete tasks — not just answer questions. Think: you tell it "book me a dinner reservation Saturday" and it checks your calendar, finds a good time, searches the restaurant, books it, then sends a Telegram confirmation. No follow-up needed.

---

## WHO MAX IS (DO NOT ASK — THIS IS YOUR CONTEXT)

- 22 years old, Orlando FL, just graduated FSU
- Starting as Account Manager at a staffing/HR firm in **July 2026**
- Goals: $100K income yr 1, own business by year 5
- Gym 3-5x/week (push/pull/legs). Night owl building a morning routine
- Holds BTC + XRP on Robinhood. Roth IRA at Schwab: MDDVX, RPEAX, PTTRX
- Emergency fund goal: $10K (currently ~$2,800)
- Into sales, AI, entrepreneurship, investing
- Learning: Claude Code, Python, AI workflows, sales techniques
- Has a girlfriend

**Max is NOT a developer.** He can run terminal commands when given them, understands general concepts, but cannot write code himself. Keep explanations brief and plain — one or two sentences on what you're doing and why, not technical essays. Never assume he knows what a specific function, type, or framework concept means.

---

## RESUME / WHERE WE ARE

Read in this order:
1. `~/.claude/projects/-Users-max-Desktop-Claude-Code-Project-1/memory/MEMORY.md` — auto-loaded; top entry is `project_current_state.md`
2. `git log --oneline -25` — truth about what shipped
3. The plan files only if Max references a specific phase

Don't restate phase status here — it changes. State lives in memory + git.

---

## TECH STACK

| Layer | Technology |
|-------|-----------|
| Framework | Next.js (App Router, TypeScript) |
| AI | Anthropic SDK — Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) |
| Database | Supabase (Postgres) |
| Hosting | Vercel |
| Auth | Google OAuth 2.0 |
| Messaging | Telegram Bot API |
| Email send | Resend |
| Crypto prices | CoinMarketCap API |
| Market data | Alpha Vantage (IRA NAVs, stock quotes, indices) |
| Weather | Open-Meteo (free, no key) |
| Web search | Tavily API |
| Web browsing | Firecrawl API |
| Calculations | Wolfram Alpha Short Answers API |
| Music | Spotify Web API (OAuth connected — tokens in settings table) |
| SMS | Twilio (trial mode — upgrade when ready) |
| Reddit | Public JSON API (no key needed) |
| Bank data | Plaid (production — Diagnostics panel on Finance Overview is source of truth) |
| Fear & Greed | Alternative.me (free, no key) |
| Voice (planned) | Vapi.ai |

All API keys are in `.env.local`. All keys are configured and active unless noted.

**Deployment:** Hosted on Vercel (auto-deploys from the `main` branch). All changes must be pushed to GitHub — this is how they reach production. Always commit and push at the end of a build session.

---

## PROJECT STRUCTURE

```
src/
  app/
    page.tsx                    # Landing page
    layout.tsx                  # Root layout
    globals.css                 # Global styles + CSS variables (dark HUD theme)
    dashboard/
      page.tsx                  # Main dashboard (net worth, habits, tasks, crypto, weather, intel feed)
      layout.tsx                # Dashboard shell with sidebar
      chat/page.tsx             # M.A.X. chat interface
      discipline/page.tsx       # Habits + Goals merged daily-view (full CRUD, momentum, heatmap, milestone celebration, smart suggestions)
      calendar/page.tsx         # Google Calendar (day/week/month views) + tasks
      email/page.tsx            # M.A.X. Email (P4 rebuild): briefing strip + folder rail + list + detail. Smart folders (action/waiting/newsletter/fyi/noise), trainable rules engine, snooze, reclassify-with-rule, real send + voice-matched AI replies, full keyboard shortcuts. Backed by /api/email/* + email_intel table.
      feed/page.tsx             # News feed (breaking ticker, topic filters)
      finance/page.tsx          # Finance Hub — 4-tab layout: Overview, Budget, Investments, Transactions
      budget/page.tsx           # Redirect → /dashboard/finance
      habits/page.tsx           # LEGACY — kept for agent tool refs / bookmarks; sidebar now points to /discipline
      goals/page.tsx            # LEGACY — same. Don't enhance these; enhance /discipline.
      archive/page.tsx          # Chat history + action receipts
      settings/page.tsx         # Settings (Feed / Notifications / Integrations / Budget / Privacy / Preferences / M.A.X. Intelligence / Behind the Scenes / Data)
    api/
      chat/route.ts             # Main chat SSE endpoint (real token streaming)
      chat/brief/route.ts       # Proactive brief on chat load
      chat/history/route.ts     # Load last 30 messages from chat_messages
      briefing/route.ts         # Daily briefing email via Resend
      telegram/route.ts         # Telegram webhook handler
      telegram/send/route.ts    # Send message to Telegram from web
      telegram/test/route.ts    # Test Telegram connection from Settings
      auth/google/route.ts      # Google OAuth initiation
      auth/google/callback/route.ts  # Google OAuth callback + token storage
      auth/spotify/route.ts     # Spotify OAuth initiation
      auth/spotify/callback/route.ts # Spotify OAuth callback + token storage
      auth/login/route.ts
      google/calendar/route.ts  # Google Calendar proxy
      google/gmail/route.ts     # Gmail proxy
      calendar/nl/route.ts      # Natural language → calendar event (Claude parse)
      crypto/route.ts           # CoinMarketCap proxy (BTC, XRP, sparklines)
      weather/route.ts          # Open-Meteo proxy (Orlando)
      news/route.ts             # News aggregator (supports ?topic= param)
      market/route.ts           # Alpha Vantage market indices
      finance-news/route.ts     # Finance news via Tavily
      memory/route.ts           # Save message to memory from chat UI
      email/                           # P4 rebuild — see project_current_state.md "Email system" for architecture.
                                       # Routes: send, writing-style, intel, intel-actions, thread/[id],
                                       # rules, snooze, reclassify, briefing, reply-draft.
                                       # Plus legacy: digest, reply, summaries (superseded; safe to remove later).
      feed/summary/route.ts
      feed/top3/route.ts        # Claude picks top 3 articles for Max
      dashboard-brief/route.ts  # M.A.X. Brief for dashboard
      transactions/ai-categorize/route.ts
      plaid/create-link-token/route.ts
      plaid/exchange-token/route.ts
      plaid/sync/route.ts
      feedback/route.ts               # POST — write 👍/👎 + optional note for any AI artifact
      discipline/suggest-habits/route.ts   # POST — Claude suggests 2-3 habits for a goal using memories
      cron/weekly-recap/route.ts      # Sunday recap (Telegram + email)
      cron/plaid-sync/route.ts        # Daily bank sync
      cron/wealth-snapshot/route.ts   # 11pm net worth snapshot
      cron/market-update/route.ts     # 2pm market data refresh + optional Telegram
      cron/bill-alerts/route.ts       # Bill due alerts
      cron/habit-nudge/route.ts       # 9pm habit nudge → Telegram
      cron/habit-coach/route.ts       # Late-afternoon "Habit Coach" Telegram push when slipping
      cron/goal-checkin/route.ts      # Quarterly goal progress → Telegram
      cron/evening-checkin/route.ts   # 8pm nightly wrap-up → Telegram
      cron/calendar-alerts/route.ts   # 30-min-before-event Telegram alerts
      cron/trend-detection/route.ts   # Daily — produces max_insight notifications via deterministic rules
      cron/memory-extract/route.ts    # Daily — pulls durable facts from chat_messages → memories
      cron/feedback-rollup/route.ts   # Daily — feedback table → learned_preference memories
      cron/email-intel-refresh/route.ts # P4: every 30 min during waking hours — pulls Gmail, classifies new threads via rules→Claude
  lib/
    max-agent.ts    # CORE: agentic loop, tool executor, context injection, real streaming. SYSTEM prompt + HISTORY_WINDOW (40) live here.
    max-tools.ts    # All tool implementations (Supabase + Google + all APIs)
    notify.ts       # Unified notification pipeline — notify() writes bell + Telegram; isOptedIn() gates by category
    supabase.ts     # Supabase client
    google.ts       # Google OAuth client + token refresh
    spotify.ts      # Spotify OAuth + playback control
    firecrawl.ts    # Web page scraping → clean markdown
    places.ts       # Google Places search (requires billing — currently unused)
    yelp.ts         # Yelp business search (paid — currently unused)
    reddit.ts       # Reddit search (free, no key)
    wolfram.ts      # Wolfram Alpha short answers
    crypto.ts       # CoinMarketCap fetcher
    weather.ts      # Open-Meteo fetcher
    news.ts         # News aggregator
    briefing.ts     # Daily briefing email builder
    plaid.ts        # Plaid bank integration
    utils.ts        # Shared utilities
  components/
    layout/Sidebar.tsx          # Dashboard nav. Hosts NotificationBell inline in footer next to Settings (NOT floating top-right).
    ui/HudCard.tsx              # Primary card — gradient, 3px radius, hairline border
    ui/MaxChatBubble.tsx        # Floating chat. Streams SSE, loads history from /api/chat/history on mount.
    ui/Sparkline.tsx            # SVG sparkline chart component
    ui/NotificationBell.tsx     # Bell button + drawer + toast stack. Renders inline in Sidebar footer.
    ui/FeedbackControl.tsx      # Reusable 👍/👎 control with inline note. Mounts on any AI artifact.
    ui/PlaidLinkButton.tsx      # Plaid Link flow button
    ui/TransactionReview.tsx    # Tinder-style swipe UI for training AI categories
```

---

## SUPABASE TABLES

| Table | Purpose |
|-------|---------|
| `habits` | Daily habits (name, cat, color, streak, best, history) |
| `habit_logs` | Real date-anchored completions (habit_id, date, completed) — source of truth |
| `tasks` | Tasks (text, priority, due_date, completed, list_id, subtasks JSONB, show_in_calendar) |
| `task_lists` | Named task lists (name, color, position) |
| `goals` | Goals (label, description, target, current, unit, deadline, color, category, milestones, subgoals) |
| `goal_notes` | Goal journal entries (goal_id, text) |
| `google_tokens` | Google OAuth tokens (access_token, refresh_token, expiry) |
| `memories` | M.A.X. long-term memory (content, tags, created_at) |
| `wealth` | Financial holdings (id:'max', ira, savings, btc_amount, xrp_amount) |
| `wealth_history` | Net worth over time (recorded_at, net_worth, crypto_total, ira_total, savings) |
| `ira_funds` | IRA fund breakdown (symbol, name, nav, chg, value, shares) |
| `bills` | Monthly bills (name, amt, due_day) |
| `telegram_history` | Telegram conversation history (role, content, created_at) |
| `chat_messages` | Unified conversation log — web chat, floating bubble, AND Telegram all write here. Has `surface` column. |
| `notifications` | Real-time alerts (type, title, body, read, action_url). Written via `notify()` only — do not insert directly. |
| `feedback` | 👍/👎 ratings on AI artifacts (artifact_type, artifact_id, rating ±1, note, metadata). Rolled up daily into learned preferences. |
| `pending_actions` | Tier-3 agency: actions awaiting Telegram ✓/✗ approval. Executor + callback handler fully wired. |
| `activity_log` | M.A.X. action history (type, description, detail JSONB) |
| `transactions` | Plaid + manual transactions (date, amount, merchant, category, source) |
| `merchant_rules` | Learned merchant→category rules (merchant_pattern, category) |
| `budget_allocations` | Zero-based budget per category (category, budgeted, period_start) |
| `accounts` | Connected bank accounts (plaid_account_id, institution, balances) |
| `settings` | Key-value preference store (key, value JSONB) — stores prefs, spotify_tokens, notification_prefs, feed interests, `writing_style_profile`, `email_briefing_cache`, paycheck_history |
| `email_intel` | P4: per-thread Claude classification (action/waiting/newsletter/fyi/noise) + summary + why_important + action_required + importance_score + snooze_until + archived/starred. Source can be `rule` / `ai` / `manual`. |
| `email_rules` | P4: Max-editable rules engine. Trainable from 👎-feedback via `/api/email/reclassify` with `make_rule:true` — auto-creates a rule with `source='feedback'` so future matching threads skip Claude entirely. |
| Voice profile | Stored in `settings.value` under key `writing_style_profile`. Bootstrapped via `POST /api/email/writing-style`. (No dedicated `writing_style` table.) |

---

## THE AGENT SYSTEM (`src/lib/max-agent.ts`)

This is the core of M.A.X. Understand it before touching anything AI-related.

**Model:** Claude Haiku 4.5 — fast + cheap. Goal: run under $5/month total. Don't upgrade model without good reason.
**Max tokens:** 2048 per response
**Max tool iterations:** 8 per message
**History window:** `HISTORY_WINDOW = 40` (was 16; widened in Phase 2). One constant at top of file — adjust there.

**Streaming:** Real token streaming via `client.messages.stream()`. Tool labels emit as `{ t: "tool", label }` events inline during streaming, then collapse to ◎ badges above the final response.

**Context injection:** On every message, M.A.X. prepends a live data header into the last user message: current time (ET), habit completion, open tasks, BTC/XRP prices + net worth, weather, top goals with %, budget spend vs allocation, bills due soon, recent memories, writing style.

**Memory split in context:** Memories tagged `learned_preference` (written by the feedback-rollup cron) inject under their own `[LEARNED PREFERENCES (follow these): ...]` header — explicit rules. General memories inject under `[RECENT MEMORY: ...]` — background facts. Don't merge these back together.

**Agency tiers** (encoded in the SYSTEM prompt — agent self-enforces):
- **Tier 1** (autonomous): all reads, transaction categorization, save/recall memory, web search
- **Tier 2** (autonomous+): draft email, create tasks, set reminders, proactive Telegram insights
- **Tier 3** (Telegram ✓/✗ approval — fully wired): create/edit calendar, send SMS, send email, update wealth, delete anything, change goal target/deadline. The full executor flow is live in `pending-actions.ts`; agent calls Tier-3 tools and they route through `enqueuePendingAction()` → Telegram card → `resolvePendingAction()` on tap.
- **Tier 4** (gated — do not execute): reschedule existing events, phone bookings, financial transactions

**Tools (36 total):**
- Habits: `read_habits`, `toggle_habit`, `add_habit`, `delete_habit`
- Tasks: `read_tasks`, `add_task`, `complete_task`, `delete_task`, `update_task`
- Goals: `read_goals`, `update_goal`, `create_goal`, `delete_goal`
- Calendar: `read_calendar`, `create_calendar_event`
- Gmail: `read_gmail`, `draft_email`, `send_email` (Tier-3)
- Finance: `read_wealth`, `update_wealth`, `get_budget_status`, `get_transactions`, `read_bills`, `set_income`
- Data: `read_crypto`, `read_weather`, `read_news`
- Memory: `store_memory`, `recall_memory`, `read_all_memories`
- Search: `web_search` (Tavily), `browse_url` (Firecrawl), `search_reddit`
- Local: `search_places` (Google Places — needs billing), `search_yelp` (paid — unused)
- Calculations: `wolfram_query`
- Music: `spotify_control`, `spotify_search`
- Market: `get_stock_quote` (Alpha Vantage), `get_fear_greed` (Alternative.me)
- Comms: `send_sms` (Twilio)
- Scheduling: `find_free_time`, `project_savings`
- System: `create_notification`, `log_activity`

**System prompt** lives at the top of `max-agent.ts` (`const SYSTEM`). Structured around: Who Max Is · Operating Principles · Voice · Response Formatting · Surface Awareness (web/bubble/Telegram) · Agency Tiers · Proactive Intelligence triggers · Memory Protocol · Tool Use Defaults · Hard Limits. Updated when Max's life or product rules change — keep it surgical, don't bloat.

---

## DESIGN SYSTEM

Locked aesthetic: **Bloomberg-density + Quant-HQ sharp**. Pure black `#000000` background, ice-blue accent `#7DB8E8`. Read [`project_design_system.md`](~/.claude/projects/-Users-max-Desktop-Claude-Code-Project-1/memory/project_design_system.md) and [`feedback_design_bar.md`](~/.claude/projects/-Users-max-Desktop-Claude-Code-Project-1/memory/feedback_design_bar.md) for full palette/type/shape rules. Live values are in `src/app/globals.css`.

Patterns:
- Newer surfaces (Finance, Email): `linear-gradient(160deg, #0f141d 0%, #080b11 100%)` cards, 3px radius, `rgba(125,184,232,0.10)` borders, monospace `0.32em` letterspaced labels, underline-active tabs.
- Legacy `<HudCard>` is still used on dashboard / discipline; do NOT introduce HudCard in new finance/email code.
- All inline styles, no Tailwind for visual styling. Single ice-blue accent — no cyan, teal, or rainbow colors.

**Bar is HIGH.** If it looks like a prototype, it doesn't ship. Hover states, transitions, loading states all required. No placeholder UI.

---

## CODING STANDARDS

- **TypeScript everywhere.** No `any` types unless absolutely unavoidable — use proper interfaces.
- **File structure matters.** Logic goes in `src/lib/`. API endpoints in `src/app/api/`. Page components stay in `src/app/dashboard/`. Shared UI in `src/components/ui/`.
- **No inline business logic in page components.** Pages render data; `src/lib/` does the work.
- **Error handling at boundaries.** API routes handle errors gracefully. Agent tools return `{ error: string }` on failure — never throw to the user.
- **Comments only when non-obvious.** Don't narrate code with comments. Good names are enough.
- **No backwards-compatibility shims.** If something changes, update all the callsites.

---

## KEY RULES & CONSTRAINTS

1. **Never auto-send email.** The `send_email` tool exists (P4 foundation) but is registered Tier-3 in `pending-actions.ts` — every invocation fires a Telegram ✓/✗ confirmation card and only executes when Max taps ✓. The agent must NEVER bypass this by calling `sendEmail()` directly. `draft_email` remains Tier-1 (autonomous, no confirmation).
2. **Notifications are opt-in default-OFF.** Every cron must check `isOptedIn(category)` from `src/lib/notify.ts` before sending. New notification categories require: a `NotifyCategory` entry in `notify.ts`, a row in `DEFAULT_NOTIF` (set to `false`), and a toggle row in the Settings page Notifications section. Do NOT add a cron that fires without this gate.
3. **Use `notify()` for proactive alerts, not direct sendNotification.** Direct Telegram sends in `src/app/api/telegram/route.ts` are for conversational chat replies only. Anything that should land in the dashboard bell goes through `notify()`.
4. **Tier-3 actions confirm first** (calendar create, SMS, deletes, wealth updates, goal target changes). Until the Tier-3 Telegram executor is wired, the agent confirms via text and waits for the next user message — don't bypass.
5. **Quality bar:** see `~/.claude/projects/-Users-max-Desktop-Claude-Code-Project-1/memory/feedback_quality_bar.md`. No half-done features. Empty + error states designed at the same time as golden path.
6. **Plaid is in production mode.** Diagnostics panel on `/dashboard/finance` Overview is the source of truth — ask Max what it shows when there are doubts.
7. **Twilio is in trial mode.** SMS only works to verified numbers. Upgrade when ready.
8. **M.A.X. personality:** Jarvis capability + TARS dry wit. Direct, capable, never sycophantic. Never starts with "Certainly!", "Of course!", "Great question!".
9. **Google OAuth tokens** are environment-specific — localhost and Vercel have separate redirect URIs and may need separate re-auth.
10. **Vercel Hobby plan only allows daily cron schedules.** `*/30` or hour-range patterns silently break ALL deploys. Always use daily-pattern crons (`0 X * * *` or weekly).

---

## WHAT "DONE" MEANS ON THIS PROJECT

A feature is done when:
1. It works correctly end-to-end
2. It handles loading states, errors, and edge cases gracefully
3. It looks polished — design matches the HUD aesthetic, no rough edges
4. It integrates naturally with M.A.X. (the agent can use/reference it)
5. Max can use it without instructions

"It mostly works" is not done. Basic = not shipped.

---

## API KEY HANDLING

When a new API key is needed:
1. Open `.env.local` in the native Mac text editor: `open -e .env.local`
2. Max will type the key in himself — never ask him to paste it in chat
3. After he's done, remind him to add it to Vercel too:
   - Vercel dashboard → Project → Settings → Environment Variables
   - One line per variable: `KEY_NAME` = `value`

---

## HOW TO WORK WITH MAX

- Explain what you're doing and why in 1-2 plain English sentences before doing it
- Don't use jargon without a brief explanation
- When asking Max to run a command, give him the exact command to type
- Don't write multi-paragraph explanations — brief is better
- When something is complex enough to need planning, lay out the approach first and get agreement before building
- Don't make changes to multiple unrelated things in one session without flagging it
- **Commit + push after each meaningful unit, not just at end of session.** Max wants to see commits as they land.
- When Max says short imperatives like "go", "continue", "keep coding" — infer the next unit from the plan and ship it. Don't ask which phase to work on if it's obvious from session memory.
