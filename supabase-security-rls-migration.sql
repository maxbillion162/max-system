-- Security hardening: enable RLS with deny-all on tables the client must never reach.
-- The server uses SUPABASE_SERVICE_ROLE_KEY which bypasses RLS by design.
-- The browser uses the anon key (NEXT_PUBLIC_SUPABASE_ANON_KEY); these policies block it.
--
-- Run this in the Supabase SQL Editor once after deploying the security update.
-- After running, also rotate the anon key in Supabase dashboard so the old key (which
-- has been visible to anyone who pulled the JS bundle) is invalidated.

-- ── DENY-ALL TABLES (anon cannot SELECT/INSERT/UPDATE/DELETE) ──────────────
-- These are tables the client never needs to hit directly. Server (service role) bypasses RLS.

DO $$
DECLARE
  t text;
  sensitive_tables text[] := ARRAY[
    'google_tokens',          -- Gmail/Calendar OAuth tokens
    'accounts',               -- Plaid access tokens live here
    'pending_actions',        -- Tier-3 approval state
    'email_intel',            -- Email content + summaries
    'email_rules',            -- Email rules engine
    'feedback',               -- Feedback ratings
    'merchant_rules',         -- Categorization rules
    'budget_allocations',     -- Budget data
    'category_classification' -- Transaction categorization
  ];
BEGIN
  FOREACH t IN ARRAY sensitive_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS deny_anon ON %I', t);
      EXECUTE format('CREATE POLICY deny_anon ON %I FOR ALL TO anon USING (false) WITH CHECK (false)', t);
    END IF;
  END LOOP;
END $$;

-- ── PERMISSIVE READ TABLES (anon can SELECT, but not write) ─────────────────
-- These are still read by the dashboard pages; lock writes so a leaked anon key
-- can't mutate state. The server uses service role for writes.

DO $$
DECLARE
  t text;
  read_only_tables text[] := ARRAY[
    'wealth',
    'wealth_history',
    'ira_funds',
    'transactions',
    'memories',
    'chat_messages',
    'telegram_history',
    'writing_style',
    'activity_log',
    'notifications'
  ];
BEGIN
  FOREACH t IN ARRAY read_only_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS anon_read ON %I', t);
      EXECUTE format('CREATE POLICY anon_read ON %I FOR SELECT TO anon USING (true)', t);
      EXECUTE format('DROP POLICY IF EXISTS anon_no_write ON %I', t);
      EXECUTE format('CREATE POLICY anon_no_write ON %I FOR INSERT TO anon WITH CHECK (false)', t);
      EXECUTE format('DROP POLICY IF EXISTS anon_no_update ON %I', t);
      EXECUTE format('CREATE POLICY anon_no_update ON %I FOR UPDATE TO anon USING (false) WITH CHECK (false)', t);
      EXECUTE format('DROP POLICY IF EXISTS anon_no_delete ON %I', t);
      EXECUTE format('CREATE POLICY anon_no_delete ON %I FOR DELETE TO anon USING (false)', t);
    END IF;
  END LOOP;
END $$;

-- ── DASHBOARD-INTERACTIVE TABLES (anon can read + write) ────────────────────
-- The dashboard currently lets the user toggle these directly via Supabase JS.
-- Acceptable for a single-user app behind cookie-gated /dashboard. Documented
-- as a known gap; future refactor moves these to API routes too.

DO $$
DECLARE
  t text;
  rw_tables text[] := ARRAY[
    'habits', 'habit_logs',
    'tasks', 'task_lists',
    'goals', 'goal_notes',
    'bills',
    'settings'
  ];
BEGIN
  FOREACH t IN ARRAY rw_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS anon_full ON %I', t);
      EXECUTE format('CREATE POLICY anon_full ON %I FOR ALL TO anon USING (true) WITH CHECK (true)', t);
    END IF;
  END LOOP;
END $$;

-- After running this migration, in Supabase dashboard:
--   1. Settings → API → "reveal" service role key → set as SUPABASE_SERVICE_ROLE_KEY in Vercel.
--   2. Rotate anon key (the old one was exposed to the public JS bundle).
--   3. Update NEXT_PUBLIC_SUPABASE_ANON_KEY on Vercel + locally.
