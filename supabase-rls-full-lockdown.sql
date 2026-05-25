-- ============================================================
-- FULL RLS LOCKDOWN — run this in Supabase SQL Editor
-- Covers every table in the current schema.
-- The browser uses the anon key (read-only or blocked).
-- The server uses SUPABASE_SERVICE_ROLE_KEY which bypasses RLS.
-- ============================================================


-- ── 1. DENY ALL (anon gets zero access) ─────────────────────────────────────
-- These tables contain tokens, financial data, or internal state that the
-- browser should never touch directly.

DO $$
DECLARE
  t text;
  deny_tables text[] := ARRAY[
    'google_tokens',       -- OAuth access/refresh tokens
    'accounts',            -- Plaid access tokens
    'pending_actions',     -- Tier-3 approval queue
    'email_intel',         -- Email content + AI summaries
    'email_rules',         -- Email rules engine
    'merchant_rules',      -- Transaction categorization rules
    'budget_allocations'   -- Budget data
  ];
BEGIN
  FOREACH t IN ARRAY deny_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS deny_anon ON %I', t);
      EXECUTE format('DROP POLICY IF EXISTS anon_full ON %I', t);
      EXECUTE format('DROP POLICY IF EXISTS anon_read ON %I', t);
      EXECUTE format('DROP POLICY IF EXISTS anon_select ON %I', t);
      EXECUTE format('CREATE POLICY deny_anon ON %I FOR ALL TO anon USING (false) WITH CHECK (false)', t);
      RAISE NOTICE 'deny_anon applied to %', t;
    ELSE
      RAISE NOTICE 'Table % not found — skipped', t;
    END IF;
  END LOOP;
END $$;


-- ── 2. READ-ONLY (anon can SELECT, cannot write/delete) ─────────────────────
-- Dashboard pages read these directly via the anon key.
-- All mutations go through server API routes using the service role key.

DO $$
DECLARE
  t text;
  readonly_tables text[] := ARRAY[
    'wealth',
    'wealth_history',
    'ira_funds',
    'transactions',
    'memories',
    'chat_messages',
    'telegram_history',
    'activity_log',
    'notifications',
    'settings',
    'habits',
    'habit_logs',
    'tasks',
    'task_lists',
    'goals',
    'goal_notes',
    'bills',
    'feedback'
  ];
BEGIN
  FOREACH t IN ARRAY readonly_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);

      -- Drop all old permissive policies
      EXECUTE format('DROP POLICY IF EXISTS anon_full ON %I', t);
      EXECUTE format('DROP POLICY IF EXISTS deny_anon ON %I', t);
      EXECUTE format('DROP POLICY IF EXISTS anon_read ON %I', t);
      EXECUTE format('DROP POLICY IF EXISTS anon_select ON %I', t);
      EXECUTE format('DROP POLICY IF EXISTS anon_no_write ON %I', t);
      EXECUTE format('DROP POLICY IF EXISTS anon_no_insert ON %I', t);
      EXECUTE format('DROP POLICY IF EXISTS anon_no_update ON %I', t);
      EXECUTE format('DROP POLICY IF EXISTS anon_no_delete ON %I', t);

      -- Anon: read only
      EXECUTE format('CREATE POLICY anon_select ON %I FOR SELECT TO anon USING (true)', t);
      -- Anon: block all writes
      EXECUTE format('CREATE POLICY anon_no_insert ON %I FOR INSERT TO anon WITH CHECK (false)', t);
      EXECUTE format('CREATE POLICY anon_no_update ON %I FOR UPDATE TO anon USING (false) WITH CHECK (false)', t);
      EXECUTE format('CREATE POLICY anon_no_delete ON %I FOR DELETE TO anon USING (false)', t);

      RAISE NOTICE 'read-only applied to %', t;
    ELSE
      RAISE NOTICE 'Table % not found — skipped', t;
    END IF;
  END LOOP;
END $$;
