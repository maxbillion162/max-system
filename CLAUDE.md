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
- **Roadmap items completed** → move them to completed, update Next Priorities

Do NOT document volatile implementation details (specific prop names, internal function signatures) — those go stale fast. Document stable architecture, patterns, and rules only. Read source files directly for low-level details.

---

## WHAT THIS PROJECT IS

M.A.X. is a fully autonomous personal AI agent built exclusively for Max. M.A.X. is best thought of as an entity — it doesn't live in one place, it exists across three equal surfaces:

- **Web dashboard** — master command center; all data visible in one place, manual controls, full chat interface
- **Floating chat bubble** — available on every dashboard page for quick queries without leaving context
- **Telegram** — mobile interface; equal in capability, primary for on-the-go use and proactive notifications

The agent is the product. All three surfaces are interfaces to the same underlying agent.

**Live URL:** max-system-dusky.vercel.app  
**Vision:** Jarvis-level autonomous assistant. M.A.X. should proactively plan, remind, warn, and complete tasks — not just answer questions. Think: you tell it "book me a dinner reservation Saturday" and it checks your calendar, finds a good time, searches the restaurant, books it online or calls to make the reservation, then sends you a Telegram confirmation. No follow-up needed.

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
| Crypto | CoinGecko API |
| Weather | Open-Meteo API |
| Web search | Tavily API |
| Voice (planned) | Vapi.ai |

All API keys are in `.env.local`. All keys are configured and active.

**Deployment:** Hosted on Vercel (auto-deploys from the `main` branch). All changes must be pushed to GitHub — this is how they reach production. Always commit and push at the end of a build session. Do not leave working code sitting only on the local machine.

**Live URL:** max-system-dusky.vercel.app

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
      calendar/page.tsx         # Google Calendar (day/week/month views)
      email/page.tsx            # Gmail (3-panel: folders, list, reader)
      feed/page.tsx             # News feed (breaking ticker, topic filters)
      finance/page.tsx          # Finance Hub — 4-tab layout: Overview, Budget, Investments, Transactions
      budget/page.tsx           # Redirect → /dashboard/finance
      habits/page.tsx           # Habit tracker
      goals/page.tsx            # Goals with progress bars
      archive/page.tsx          # Chat history + action receipts
    api/
      chat/route.ts             # Main chat SSE endpoint (streams agent events)
      chat/brief/route.ts       # Generates proactive brief on chat load
      briefing/route.ts         # Triggers daily briefing email via Resend
      telegram/route.ts         # Telegram webhook handler
      auth/google/route.ts      # Google OAuth initiation
      auth/google/callback/route.ts  # Google OAuth callback + token storage
      auth/login/route.ts
      google/calendar/route.ts  # Google Calendar proxy
      google/gmail/route.ts     # Gmail proxy
      crypto/route.ts           # CoinGecko proxy (BTC, XRP, sparklines)
      weather/route.ts          # Open-Meteo proxy (Orlando)
      news/route.ts             # News aggregator
      email/digest/route.ts
      email/reply/route.ts
      feed/summary/route.ts
      cron/calendar-alerts/route.ts   # Removed (requires Vercel Pro)
      cron/weekly-recap/route.ts      # Sunday 8am recap (Telegram + email)
  lib/
    max-agent.ts    # CORE: agentic loop, tool executor, context injection, streaming
    max-tools.ts    # All tool implementations (Supabase + Google + APIs)
    supabase.ts     # Supabase client
    google.ts       # Google OAuth client + token refresh
    crypto.ts       # CoinGecko fetcher
    weather.ts      # Open-Meteo fetcher
    news.ts         # News aggregator
    briefing.ts     # Daily briefing email builder
    utils.ts        # Shared utilities
    gemini.ts       # DEAD FILE — ignore, do not use
  components/
    layout/Sidebar.tsx          # Dashboard navigation sidebar
    ui/HudCard.tsx              # Primary card component (dark glass style)
    ui/MaxChatBubble.tsx        # Floating chat widget (all dashboard pages)
    ui/Sparkline.tsx            # SVG sparkline chart component
    ui/NotificationBell.tsx     # Real-time notification bell + drawer + toast stack
    ui/PlaidLinkButton.tsx      # Plaid Link flow button (create-link-token → exchange)
    ui/TransactionReview.tsx    # Tinder-style swipe UI for training AI categories
```

---

## SUPABASE TABLES

| Table | Status | Purpose |
|-------|--------|---------|
| `habits` | ✅ | Daily habits (id, name, completed, updated_at) |
| `tasks` | ✅ | Task list (id, text, priority, due_date, completed) |
| `goals` | ✅ | Goals (id, current) — metadata is hardcoded in dashboard |
| `google_tokens` | ✅ | Google OAuth tokens (access_token, refresh_token, expiry) |
| `memories` | ✅ | M.A.X. long-term memory (id, content, tags, created_at) |
| `wealth` | ✅ | Financial holdings (id:'max', ira, savings, btc_amount, xrp_amount) |
| `telegram_history` | ✅ | Telegram conversation history (role, content, created_at) |
| `ira_funds` | ✅ | IRA fund breakdown (symbol, name, nav, chg, value, shares) |
| `bills` | ✅ | Monthly bills (name, amt, due day) |
| `chat_messages` | ✅ | Web chat history (role, content, created_at) |
| `wealth_history` | ✅ | Net worth over time for chart (recorded_at, net_worth, crypto_total, ira_total, savings) |
| `notifications` | ✅ | Real-time alerts (type, title, body, read, action_url) |
| `activity_log` | ✅ | M.A.X. action history (type, description, detail JSONB) |
| `transactions` | ✅ | Plaid + manual transactions (date, amount, merchant, category, source) |
| `merchant_rules` | ✅ | Learned merchant→category rules (merchant_pattern, category) |
| `budget_allocations` | ✅ | Zero-based budget per category (category, budgeted, period_start, rollover) |
| `accounts` | ✅ | Connected bank accounts — Plaid ready (plaid_account_id, institution, balances) |
| `task_lists` | ✅ | Named task lists (name, color, position). Defaults: Personal, Work, M.A.X. |
| `habit_logs` | ✅ | Real date-anchored habit completions (habit_id, date, completed) |
| `goal_notes` | ✅ | Goal journal entries (goal_id, text) |
| `settings` | ✅ | Key-value preference store (key, value JSONB) |
| `writing_style` | ✅ | Max's analyzed email voice profile |

**Note:** Web chat history (`chat_messages`) is NOT currently used by the agent — it only uses the last 14 in-memory messages per session. Telegram history IS persisted and loaded.

**tasks table** also has: list_id, description, subtasks (JSONB), position, show_in_calendar — added Week 1.
**habits table** also has: cat, color, streak, best, history — added Week 1.
**goals table** also has: label, description, target, unit, deadline, color, category, milestones, subgoals — added Week 1.

---

## THE AGENT SYSTEM (`src/lib/max-agent.ts`)

This is the core of M.A.X. Understand it before touching anything AI-related.

**Model:** Claude Haiku 4.5 (fast + cheap — keep this unless a specific feature needs more power) Ultimate goal is to rin this assistant for under $5 a month total
**Max tokens:** 2048 per response  
**Max tool iterations:** 8 per message

**Context injection:** On every first message in a session, M.A.X. prepends live data: current time (ET), habits completion, open tasks, BTC/XRP prices, Orlando weather and eventually much much more. This gives M.A.X. situational awareness without being asked.

**Streaming:** The agent uses a non-streaming Anthropic call, then simulates streaming by splitting the response word-by-word via SSE. Real token streaming would improve perceived responsiveness.

**Tools (20 total):**
- Habits: `read_habits`, `toggle_habit`
- Tasks: `read_tasks`, `add_task`, `complete_task`, `delete_task`
- Goals: `read_goals`, `update_goal`
- Calendar: `read_calendar`, `create_calendar_event`
- Gmail: `read_gmail`, `draft_email`
- Data: `read_crypto`, `read_weather`, `read_news`
- Memory: `store_memory`, `recall_memory`
- Finance: `update_wealth`
- Search: `web_search` (Tavily)
- Notifications: `create_notification`, `log_activity`

**System prompt** contains Max's full personal profile. Keep it up to date as Max's life changes.

---

## DESIGN SYSTEM

**Theme:** Dark HUD. Think Iron Man / Jarvis interface. Not consumer SaaS, not a dark-mode website — a mission control panel.

**CSS Variables (defined in `globals.css`):**
- `--bg`: main background (near-black)
- `--surface`, `--surface2`, `--surface3`: card backgrounds (slightly lighter)
- `--border`, `--border2`: subtle borders
- `--t1`, `--t2`, `--t3`, `--t4`: text hierarchy (white → gray)
- `--blue`: primary accent (#4589FF or similar)
- `--green`, `--red`, `--amber`: status colors
- `--text-primary` = `var(--t1)`

**Component patterns:**
- Cards: always use `<HudCard>` — check `src/components/ui/HudCard.tsx` for current props
- Charts: use `<Sparkline>` — check `src/components/ui/Sparkline.tsx` for current props
- All inline styles (no Tailwind, no CSS modules) — this is intentional
- Before using any shared component, read its source file — don't assume props from memory

**Design bar is HIGH.** If it looks like a prototype or a "vibe code" project, it doesn't ship. Every card, modal, button, and layout must look intentional and polished. Hover states, transitions, loading states — all required. No placeholder UI.

---

## CODING STANDARDS

- **TypeScript everywhere.** No `any` types unless absolutely unavoidable — use proper interfaces.
- **File structure matters.** Logic goes in `src/lib/`. API endpoints in `src/app/api/`. Page components stay in `src/app/dashboard/`. Shared UI in `src/components/ui/`.
- **No inline business logic in page components.** Pages render data; `src/lib/` does the work.
- **No unused files.** `src/lib/gemini.ts` is dead — remove it when touching that area.
- **Error handling at boundaries.** API routes handle errors gracefully. Agent tools return `{ error: string }` on failure — never throw to the user.
- **Comments only when non-obvious.** Don't narrate code with comments. Good names are enough.
- **No backwards-compatibility shims.** If something changes, update all the callsites.

---

## KEY RULES & CONSTRAINTS

1. **Never auto-send email.** `draft_email` only. Max always reviews before sending.
2. **Confirm before irreversible actions.** Calendar creates, bookings, anything that can't be undone — M.A.X. confirms intent first.
3. **Telegram is the primary mobile channel.** Features that notify Max should send to Telegram.
4. **Plaid integration is planned** — Week 2 of the revamp plan. Read-only, all accounts (checking, savings, credit cards).
5. **Calendar alerts require Vercel Pro** — don't implement cron-based calendar alerts without flagging this.
6. **M.A.X. personality:** Jarvis capability + TARS dry wit. Direct, capable, never sycophantic. Never starts with "Certainly!", "Of course!", "Great question!".
7. **Google OAuth tokens** are environment-specific — localhost and Vercel have separate redirect URIs and may need separate re-auth.

---

## CURRENT STATE & PRIORITIES

**Active plan: 14-week full revamp.** See `ROADMAP.md` in this directory for the build order and week-by-week specs. See Claude's memory file `build_plan_revamp.md` for the complete detailed plan.

**Current status: Weeks 1–10 complete. Week 11 is next.**

### Week 1 — DONE:
New tables: `notifications`, `activity_log`, `transactions`, `merchant_rules`, `budget_allocations`, `accounts`, `task_lists`, `habit_logs`, `goal_notes`, `settings`, `writing_style`. Expanded `tasks`, `habits`, `goals`. Built `NotificationBell` component. Settings page shell. Added `create_notification`, `log_activity`, `get_budget_status`, `get_transactions` agent tools.

### Week 2 — DONE:
Plaid integration: `src/lib/plaid.ts`, create-link-token + exchange-token + sync API routes. `PlaidLinkButton` component. Daily cron sync. Vercel `vercel.json` updated with cron. PLAID_ENV=sandbox (upgrade to development for real bank — swap PLAID_SECRET + PLAID_ENV env var).

### Week 3 — DONE:
Finance Hub full rewrite as 4-tab layout (Overview, Budget, Investments, Transactions). AI batch categorization via `/api/transactions/ai-categorize` (Claude Haiku). Tinder-style `TransactionReview` component for training merchant rules. Zero-based budget with Quick Setup. Old `/dashboard/budget` now redirects to Finance Hub. Budget removed from sidebar nav.

### Pending — Plaid real bank access:
Max needs to: go to dashboard.plaid.com → switch to Development environment → get Development Secret → set `PLAID_ENV=development` + new `PLAID_SECRET` in `.env.local` AND Vercel env vars → redeploy.

### Week 4 — DONE:
CoinMarketCap for crypto. Alpha Vantage for IRA NAVs + market indices. Finance news feed (Tavily). Wealth snapshot cron (11pm). Market update cron (2pm). Bill alerts cron (7am). New API routes: /api/market, /api/finance-news, /api/cron/wealth-snapshot, /api/cron/market-update, /api/cron/bill-alerts.

### Week 5 — DONE:
Dashboard revamp. M.A.X. Brief (Claude Haiku, 10-min cache, /api/dashboard-brief). Finance Snapshot tile. Goal Pulse with urgency badges. Tasks tile with priority dots + due dates.

### Week 6 — DONE:
Tasks merged into Calendar page (now "Schedule"). Task list management, subtasks, inline TaskDetail panel. Stats row (Open/Done/High/Due Soon). Default lists seeded from task_lists table.

### Week 7 — DONE:
Calendar revamp. Day/week views: absolute-positioned event blocks proportional to time, overlap detection, current-time red line. Click empty slot → EventModal pre-filled. Natural language bar: plain-English → Claude Haiku parse → preview → confirm → creates Google Calendar event (/api/calendar/nl). Event detail panel in right sidebar on click. Month view: +X more chip, task chips.

### Week 8 — DONE:
Email full revamp. 3-column layout: smart folder nav | email list | reading pane. Smart folders (All/Needs Action/FYI/Newsletters/Noise). AI summary line per email (/api/email/summaries batch). Priority pills (URGENT/REPLY NEEDED/FYI). Keyboard shortcuts: J/K navigate, R reply, D draft, E archive, / search, ? toggle. Eye icon (👁) button in list header opens shortcuts modal.

### Week 9 — DONE:
Habits gamification. 30-day GitHub-style heatmap per habit. Level system (Recruit/Consistent/Machine/Untouchable) based on best streak. 5 achievements (First Week, Iron Will, Centurion, Perfect Week, Comeback). Streak Shields (max 3, stored in settings). PPL workout split with "TODAY" badge. 9pm Telegram nudge cron (/api/cron/habit-nudge, 01:00 UTC). Real date-anchored tracking via habit_logs table.

### Week 10 — DONE:
Goals full build. All goal metadata saved to Supabase (label, description, target, unit, deadline, color, category, milestones, subgoals). Seeds 5 default goals on first load. Notes stored in goal_notes table (not localStorage). Subgoals persisted as JSONB. Linked habits shown on each goal card via keyword/category matching. Delete goal + cascade delete notes. Quarterly check-in cron (/api/cron/goal-checkin, 10am UTC Jan 1 / Apr 1 / Jul 1 / Oct 1) sends Telegram progress report.

### Upcoming:
- Week 11: Feed Revamp (daily topic override, M.A.X. Top 3, save articles)
- Week 12+: Settings, Chat upgrades, Agent tools

### Key API upgrades planned:
- CoinGecko → **CoinMarketCap** for crypto
- New: **Alpha Vantage** for IRA fund NAVs + market indices
- New: **Plaid** for bank/transaction data (all accounts)

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
1. Open `.env.local` in the native Mac text editor automatically: `open -e .env.local`
2. Max will type the key in himself — never ask him to paste it in chat
3. After he's done, always remind him to add it to Vercel too, and show the exact format:
   - Vercel dashboard → Project → Settings → Environment Variables
   - Show: `KEY_NAME` = `value` (one line per variable)

---

## HOW TO WORK WITH MAX

- Explain what you're doing and why in 1-2 plain English sentences before doing it
- Don't use jargon without a brief explanation
- When asking Max to run a command, give him the exact command to type
- Don't write multi-paragraph explanations — brief is better
- When something is complex enough to need planning, lay out the approach first and get agreement before building
- Don't make changes to multiple unrelated things in one session without flagging it
