-- ════════════════════════════════════════════════════════════════════
-- Finance Revamp — Autonomous CFO migration
-- ════════════════════════════════════════════════════════════════════
-- Single migration covering schema additions for all 6 finance phases.
-- Fully additive — safe to run on an existing DB. Run once.
--
-- Phases:
--   F1 — accounts.account_type, accounts.archived
--   F2 — category_classification, budget_allocations.rollover
--   F3 — scenarios, recurring_subscriptions
--   F4 — money_dna, anomaly_log
--   F5 — bills.recurrence, bills.next_due_date, investment_thesis
--   F6 — financial_reports
-- ════════════════════════════════════════════════════════════════════

-- ─── F1 ─────────────────────────────────────────────────────────────
alter table accounts add column if not exists account_type text;
alter table accounts add column if not exists archived boolean default false;

create index if not exists accounts_active_idx on accounts(archived) where archived = false;

-- ─── F2 ─────────────────────────────────────────────────────────────
create table if not exists category_classification (
  category text primary key,
  type     text not null check (type in ('need','want','savings','investment')),
  set_by   text default 'system' check (set_by in ('system','user')),
  updated_at timestamptz default now()
);

alter table budget_allocations add column if not exists rollover boolean default false;

-- ─── F3 ─────────────────────────────────────────────────────────────
create table if not exists scenarios (
  id            uuid primary key default gen_random_uuid(),
  label         text not null,
  description   text,
  knobs         jsonb not null,           -- { savings_rate, btc_assumption, salary_change_at, ... }
  baseline_data jsonb,                    -- snapshot of finance state when scenario created
  status        text default 'draft' check (status in ('draft','active','tracking','retired')),
  trigger_event text,                     -- e.g. 'AM job starts' — when present, scenario becomes 'tracking'
  trigger_date  date,
  created_at    timestamptz default now(),
  retired_at    timestamptz
);

create index if not exists scenarios_status_idx on scenarios(status, created_at desc);

create table if not exists recurring_subscriptions (
  id                   uuid primary key default gen_random_uuid(),
  merchant_pattern     text not null,
  display_name         text,
  monthly_amount       numeric not null,
  annual_amount        numeric generated always as (monthly_amount * 12) stored,
  cadence              text default 'monthly' check (cadence in ('monthly','quarterly','annual','weekly','irregular')),
  last_seen            date,
  first_seen           date,
  occurrences          int default 1,
  suggestion           text check (suggestion in ('cancel','keep','negotiate','review')),
  suggestion_reasoning text,
  user_decision        text check (user_decision in ('accepted','rejected','snoozed','pending')),
  user_decision_at     timestamptz,
  detected_at          timestamptz default now()
);

create unique index if not exists recurring_subs_pattern_idx on recurring_subscriptions(merchant_pattern);

-- ─── F4 ─────────────────────────────────────────────────────────────
create table if not exists money_dna (
  id                    uuid primary key default gen_random_uuid(),
  generated_at          timestamptz default now(),
  patterns              jsonb not null,    -- [{ title, body, severity, evidence_metric }]
  baseline_period_start date,
  baseline_period_end   date,
  txn_count             int                -- how many transactions feed this DNA
);

create index if not exists money_dna_recent_idx on money_dna(generated_at desc);

create table if not exists anomaly_log (
  id              uuid primary key default gen_random_uuid(),
  transaction_id  text,                    -- plaid_transaction_id reference
  merchant        text,
  amount          numeric,
  z_score         numeric,
  reason          text,                    -- human-readable description of why flagged
  status          text default 'pending' check (status in ('pending','confirmed','flagged','dismissed')),
  resolved_via    text,                    -- 'telegram_approval' | 'web' | 'auto_expired'
  pending_action_id uuid,                  -- if a Tier-3 confirmation was queued
  created_at      timestamptz default now(),
  resolved_at     timestamptz
);

create index if not exists anomaly_log_status_idx on anomaly_log(status, created_at desc);

-- ─── F5 ─────────────────────────────────────────────────────────────
alter table bills add column if not exists recurrence text default 'monthly'
  check (recurrence in ('monthly','quarterly','annual','one-time','custom'));
alter table bills add column if not exists next_due_date date;
alter table bills add column if not exists category text;
alter table bills add column if not exists active boolean default true;

create table if not exists investment_thesis (
  id                  uuid primary key default gen_random_uuid(),
  holding_id          text not null,        -- e.g. 'BTC' | 'XRP' | 'MDDVX' | 'RPEAX' | 'PTTRX'
  holding_type        text not null check (holding_type in ('crypto','fund','stock','etf','other')),
  thesis              text not null,
  conviction          smallint check (conviction between 1 and 10),
  written_at          timestamptz default now(),
  last_referenced_at  timestamptz,
  active              boolean default true
);

create index if not exists thesis_holding_idx on investment_thesis(holding_id, active);

-- ─── F6 ─────────────────────────────────────────────────────────────
create table if not exists financial_reports (
  id            uuid primary key default gen_random_uuid(),
  period_label  text not null,              -- 'Q2 2026', 'April 2026', etc.
  period_type   text default 'quarterly' check (period_type in ('quarterly','annual','monthly','custom')),
  period_start  date not null,
  period_end    date not null,
  content       text not null,              -- the prose narrative
  highlights    jsonb,                      -- [{ kind: 'win'|'leak'|'driver', text, value }]
  generated_at  timestamptz default now(),
  viewed_at     timestamptz
);

create unique index if not exists financial_reports_period_idx on financial_reports(period_type, period_start);

-- ─── RLS ────────────────────────────────────────────────────────────
-- Match the existing pattern (single-user app, no RLS).
alter table category_classification     disable row level security;
alter table scenarios                   disable row level security;
alter table recurring_subscriptions     disable row level security;
alter table money_dna                   disable row level security;
alter table anomaly_log                 disable row level security;
alter table investment_thesis           disable row level security;
alter table financial_reports           disable row level security;

-- ─── Seed: default category classification ─────────────────────────
-- Best-guess starter set. Max can override via UI in F2.
insert into category_classification (category, type, set_by) values
  ('Rent',           'need',       'system'),
  ('Mortgage',       'need',       'system'),
  ('Utilities',      'need',       'system'),
  ('Groceries',      'need',       'system'),
  ('Gas',            'need',       'system'),
  ('Transport',      'need',       'system'),
  ('Insurance',      'need',       'system'),
  ('Healthcare',     'need',       'system'),
  ('Phone',          'need',       'system'),
  ('Internet',       'need',       'system'),
  ('Dining',         'want',       'system'),
  ('Coffee',         'want',       'system'),
  ('Entertainment',  'want',       'system'),
  ('Subscriptions',  'want',       'system'),
  ('Shopping',       'want',       'system'),
  ('Travel',         'want',       'system'),
  ('Hobbies',        'want',       'system'),
  ('Gym',            'want',       'system'),
  ('Savings',        'savings',    'system'),
  ('Emergency Fund', 'savings',    'system'),
  ('Roth IRA',       'investment', 'system'),
  ('Crypto',         'investment', 'system'),
  ('Investments',    'investment', 'system')
on conflict (category) do nothing;
