-- ══════════════════════════════════════════════════════════════════
-- M.A.X. Phase 2 + 3 Schema Migration
-- ══════════════════════════════════════════════════════════════════
-- Run this ONCE in the Supabase SQL Editor. Safe to re-run — all
-- statements are idempotent (IF NOT EXISTS + ALTER TABLE ADD IF).
--
-- Adds:
--   - surface column on chat_messages (unified conversation tagging)
--   - feedback table (Phase 3 learning loop — thumbs up/down on AI outputs)
--   - pending_actions table (Phase 2.5 Tier-3 agency confirmation flow)
-- ══════════════════════════════════════════════════════════════════

-- ─── chat_messages.surface ────────────────────────────────────────
-- Where did this message originate? 'web' | 'bubble' | 'telegram'
-- Nullable for backwards-compat with existing rows.
alter table chat_messages
  add column if not exists surface text;

create index if not exists chat_messages_surface_idx
  on chat_messages(surface);

-- ─── feedback ─────────────────────────────────────────────────────
-- Thumbs up/down on any AI-generated output in the product.
-- The rollup cron reads this and writes learned preferences to memories.
create table if not exists feedback (
  id            bigserial primary key,
  surface       text,                           -- where it was rated (page path or 'bubble'/'telegram')
  artifact_type text not null,                  -- 'email_summary' | 'feed_top3' | 'dashboard_insight' | 'brief' | ...
  artifact_id   text,                           -- optional ID of the specific artifact
  rating        smallint not null check (rating in (-1, 1)),  -- -1 thumbs down, +1 thumbs up
  note          text,                           -- optional short context from user
  metadata      jsonb default '{}'::jsonb,      -- any extra structured info the producer wants to capture
  created_at    timestamptz default now()
);

alter table feedback disable row level security;

create index if not exists feedback_type_created_idx
  on feedback(artifact_type, created_at desc);

-- ─── pending_actions ──────────────────────────────────────────────
-- Tier-3 actions queued awaiting Max's Telegram ✓/✗ approval.
-- Executor picks these up when a callback fires.
create table if not exists pending_actions (
  id            uuid primary key default gen_random_uuid(),
  tool_name     text not null,
  tool_input    jsonb not null,
  description   text not null,                  -- human-readable summary for the Telegram card
  status        text not null default 'pending' check (status in ('pending','approved','rejected','executed','expired','failed')),
  result        text,                           -- what happened after execution
  requested_by  text default 'agent',           -- 'agent' | 'max' | 'cron'
  surface       text,                           -- where the request originated
  telegram_message_id bigint,                   -- the card Max gets on Telegram
  created_at    timestamptz default now(),
  resolved_at   timestamptz
);

alter table pending_actions disable row level security;

create index if not exists pending_actions_status_idx
  on pending_actions(status, created_at desc);
