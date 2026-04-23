-- ============================================================
-- M.A.X. Week 1 Migration
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Paste → Run
-- ============================================================

-- 1. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL DEFAULT 'general',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  action_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;

-- 2. ACTIVITY LOG
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  detail JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE activity_log DISABLE ROW LEVEL SECURITY;

-- 3. TRANSACTIONS (Plaid + manual)
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plaid_transaction_id TEXT UNIQUE,
  date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  merchant TEXT,
  merchant_normalized TEXT,
  category TEXT DEFAULT 'Uncategorized',
  plaid_category TEXT,
  budget_category TEXT,
  notes TEXT,
  source TEXT DEFAULT 'manual',
  account_id TEXT,
  pending BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;

-- 4. MERCHANT RULES (learned categorization)
CREATE TABLE IF NOT EXISTS merchant_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_pattern TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  confirmed BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE merchant_rules DISABLE ROW LEVEL SECURITY;

-- 5. BUDGET ALLOCATIONS (zero-based budget)
CREATE TABLE IF NOT EXISTS budget_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  budgeted NUMERIC NOT NULL DEFAULT 0,
  period_start DATE NOT NULL,
  rollover BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(category, period_start)
);
ALTER TABLE budget_allocations DISABLE ROW LEVEL SECURITY;

-- 6. ACCOUNTS (Plaid connected bank accounts)
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plaid_account_id TEXT UNIQUE,
  plaid_access_token TEXT,
  plaid_item_id TEXT,
  name TEXT NOT NULL,
  official_name TEXT,
  type TEXT,
  subtype TEXT,
  institution TEXT,
  mask TEXT,
  current_balance NUMERIC,
  available_balance NUMERIC,
  last_synced TIMESTAMPTZ,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE accounts DISABLE ROW LEVEL SECURITY;

-- 7. TASK LISTS
CREATE TABLE IF NOT EXISTS task_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT DEFAULT '#4589ff',
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE task_lists DISABLE ROW LEVEL SECURITY;

INSERT INTO task_lists (name, color, position) VALUES
  ('Personal', '#4589ff', 0),
  ('Work',     '#10b981', 1),
  ('M.A.X.',   '#8b5cf6', 2)
ON CONFLICT DO NOTHING;

-- 8. HABIT LOGS (real date-anchored completions — replaces fake 7-slot array)
CREATE TABLE IF NOT EXISTS habit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id TEXT NOT NULL,
  date DATE NOT NULL,
  completed BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(habit_id, date)
);
ALTER TABLE habit_logs DISABLE ROW LEVEL SECURITY;

-- 9. GOAL NOTES (move out of localStorage)
CREATE TABLE IF NOT EXISTS goal_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE goal_notes DISABLE ROW LEVEL SECURITY;

-- 10. SETTINGS (key-value store for preferences)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;

INSERT INTO settings (key, value) VALUES
  ('morning_brief_time',       '"07:00"'),
  ('privacy_default',          'true'),
  ('crypto_alert_threshold',   '5'),
  ('default_calendar_view',    '"week"'),
  ('default_task_list',        'null'),
  ('personality_mode',         '"tars"'),
  ('notification_crypto',      'true'),
  ('notification_habits',      'true'),
  ('notification_bills',       'true'),
  ('notification_calendar',    'true'),
  ('notification_max_actions', 'true'),
  ('tasks_show_in_calendar',   'true'),
  ('base_feed_interests',      '["crypto","sales","AI","entrepreneurship","investing","Orlando"]'),
  ('budget_reset_day',         '1')
ON CONFLICT (key) DO NOTHING;

-- 11. WRITING STYLE (Max's analyzed email voice)
CREATE TABLE IF NOT EXISTS writing_style (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  summary TEXT,
  tone TEXT,
  avg_length TEXT,
  common_openings TEXT[],
  common_closings TEXT[],
  sample_phrases TEXT[],
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  email_count INTEGER DEFAULT 0
);
ALTER TABLE writing_style DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- EXPAND EXISTING TABLES
-- ============================================================

-- Expand tasks (add new columns without breaking existing data)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS list_id UUID REFERENCES task_lists(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS subtasks JSONB DEFAULT '[]';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS show_in_calendar BOOLEAN DEFAULT true;

-- Expand habits (add columns the UI uses that may not be in DB yet)
ALTER TABLE habits ADD COLUMN IF NOT EXISTS cat TEXT DEFAULT 'General';
ALTER TABLE habits ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#4589ff';
ALTER TABLE habits ADD COLUMN IF NOT EXISTS streak INTEGER DEFAULT 0;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS best INTEGER DEFAULT 0;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS history JSONB DEFAULT '[false,false,false,false,false,false,false]';

-- Expand goals (add metadata columns for future Week 10 build)
ALTER TABLE goals ADD COLUMN IF NOT EXISTS label TEXT;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS target NUMERIC;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT '$';
ALTER TABLE goals ADD COLUMN IF NOT EXISTS deadline DATE;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#4589ff';
ALTER TABLE goals ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'General';
ALTER TABLE goals ADD COLUMN IF NOT EXISTS milestones JSONB DEFAULT '[]';
ALTER TABLE goals ADD COLUMN IF NOT EXISTS subgoals JSONB DEFAULT '[]';

-- ============================================================
-- ENABLE REAL-TIME ON NOTIFICATIONS TABLE
-- ============================================================
-- This allows the web dashboard to receive notifications instantly
-- without refreshing. Run this line separately if the above works
-- but notifications don't appear in real-time:
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- ============================================================
-- DONE. All 12 new tables created, existing tables expanded.
-- ============================================================
