-- Phase 4: Email rebuild — additive migration.
--
-- Adds:
--   email_intel    — per-thread Claude classification + summary + snooze
--   email_rules    — Max-editable trainable rules engine
--
-- Run safely; everything is `if not exists`.

create table if not exists email_intel (
  thread_id              text primary key,
  classification         text check (classification in ('action','waiting','newsletter','fyi','noise')),
  classification_source  text check (classification_source in ('rule','ai','manual')) default 'ai',
  classification_confidence numeric,                       -- 0..1
  summary                text,
  why_important          text,
  action_required        boolean default false,
  action_reason          text,
  importance_score       int default 0,                    -- 0..100
  snooze_until           timestamptz,
  archived               boolean default false,
  starred                boolean default false,
  last_message_at        timestamptz,
  model_input_hash       text,                             -- detect when re-classify is needed
  generated_at           timestamptz default now(),
  -- raw cached header info so list rendering doesn't re-hit Gmail every render
  subject                text,
  sender_name            text,
  sender_email           text,
  preview                text,
  unread                 boolean default true
);

create index if not exists email_intel_classification_idx on email_intel(classification, last_message_at desc);
create index if not exists email_intel_action_idx on email_intel(action_required, last_message_at desc) where action_required = true;
create index if not exists email_intel_snooze_idx on email_intel(snooze_until) where snooze_until is not null;
create index if not exists email_intel_archived_idx on email_intel(archived, last_message_at desc);

create table if not exists email_rules (
  id                     uuid primary key default gen_random_uuid(),
  name                   text not null,
  condition_type         text not null check (condition_type in ('sender_email','sender_domain','subject_contains','body_contains','has_label')),
  condition_value        text not null,
  action_classification  text not null check (action_classification in ('action','waiting','newsletter','fyi','noise')),
  priority               int default 50,                   -- lower runs first
  active                 boolean default true,
  hit_count              int default 0,                    -- updated by classifier on apply
  last_hit_at            timestamptz,
  created_at             timestamptz default now(),
  source                 text default 'manual' check (source in ('manual','feedback'))  -- 'feedback' = auto-created from a 👎 reclassify
);

create index if not exists email_rules_active_idx on email_rules(active, priority);

-- Disable RLS for single-user app convention (matches existing tables)
alter table email_intel disable row level security;
alter table email_rules disable row level security;
