-- Tighten RLS: deny anon WRITE/DELETE on dashboard-mutated tables.
-- Server (service role) bypasses RLS. Anon (browser) loses ability to mutate.
-- Reads stay open so dashboard pages still load instantly.
--
-- Run this AFTER the new client code (dbWrite + /api/db/write) is deployed.
-- If you run this BEFORE the deploy, the dashboard will fail to write because
-- the old client code is still trying to write directly with the anon key.

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
      -- Drop the old permissive policy
      EXECUTE format('DROP POLICY IF EXISTS anon_full ON %I', t);
      -- Create read-only policy for anon
      EXECUTE format('DROP POLICY IF EXISTS anon_select ON %I', t);
      EXECUTE format('CREATE POLICY anon_select ON %I FOR SELECT TO anon USING (true)', t);
      -- Block all writes for anon (server uses service role which bypasses RLS)
      EXECUTE format('DROP POLICY IF EXISTS anon_no_insert ON %I', t);
      EXECUTE format('CREATE POLICY anon_no_insert ON %I FOR INSERT TO anon WITH CHECK (false)', t);
      EXECUTE format('DROP POLICY IF EXISTS anon_no_update ON %I', t);
      EXECUTE format('CREATE POLICY anon_no_update ON %I FOR UPDATE TO anon USING (false) WITH CHECK (false)', t);
      EXECUTE format('DROP POLICY IF EXISTS anon_no_delete ON %I', t);
      EXECUTE format('CREATE POLICY anon_no_delete ON %I FOR DELETE TO anon USING (false)', t);
    END IF;
  END LOOP;
END $$;
