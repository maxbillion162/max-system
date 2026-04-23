# M.A.X. Revamp Roadmap

**Current status: Week 1 complete — Week 2 is next**  
**Full plan last updated: April 2026**

This file tracks the full revamp build plan. Update it as weeks are completed.

---

## Build Order

| Week | Focus | Status |
|------|-------|--------|
| 1 | Foundation — new Supabase tables, notification system | ✅ DONE |
| 2 | Plaid integration — connect all bank accounts | ⏳ NEXT |
| 3 | Transaction categorization + zero-based budget system | ⏳ |
| 4 | Finance Hub full revamp (CoinMarketCap, Alpha Vantage, investment news) | ⏳ |
| 5 | Dashboard revamp (real M.A.X. Brief, tasks tile, notification bell) | ⏳ |
| 6 | Tasks — Google Tasks-style (lists, subtasks, drag-reorder, calendar integration) | ⏳ |
| 7 | Calendar — full visual revamp, inline creation, natural language input | ⏳ |
| 8 | Email — full revamp, writing style analysis, AI summaries, smart draft reply | ⏳ |
| 9 | Habits — gamification (XP, achievements, shields, heatmap, real date tracking) | ⏳ |
| 10 | Goals — full Supabase, habit linking, create from chat/Telegram | ⏳ |
| 11 | Feed — daily algorithm override, M.A.X. curation, save articles | ⏳ |
| 12 | Settings page — gear icon in nav, all meaningful settings | ⏳ |
| 13 | Chat upgrades — history, real streaming, tool visualization | ⏳ |
| 14+ | Agent intelligence — Plaid tools, budget tools, goals from chat, full context | ⏳ |

---

## Key Technical Decisions

- **AI Model**: Claude Haiku 4.5 (keep until feel too shallow, then Sonnet)
- **Crypto**: CoinMarketCap (replace CoinGecko)
- **IRA/Market data**: Alpha Vantage (daily NAV for MDDVX/RPEAX/PTTRX + S&P/NASDAQ/Dow)
- **Bank data**: Plaid — all accounts, all transactions, read-only
- **Budget style**: Zero-based (every dollar assigned a job)
- **Voice**: Web Speech API now → ElevenLabs when phone calls are added
- **Draft replies**: Trained on Max's Gmail sent folder → sounds like him
- **Dark mode**: Enforced, no toggle
- **Settings**: Gear icon at bottom of sidebar nav

## New Supabase Tables Needed (Week 1)

- `notifications` — real-time alert system
- `activity_log` — M.A.X. action history
- `transactions` — Plaid transaction data
- `merchant_rules` — learned categorization rules
- `budget_allocations` — zero-based budget by category
- `accounts` — connected Plaid accounts
- `task_lists` — named task lists
- `habit_logs` — real date-anchored habit completions
- `goal_notes` — goal journal entries (move from localStorage)
- `settings` — key-value preference store
- `writing_style` — Max's analyzed writing profile

Also expand `tasks` table: add list_id, description, subtasks (JSON), order, show_in_calendar columns.

---

*For the full detailed plan with all specs, see Claude's memory or ask Claude to reference the build plan.*
