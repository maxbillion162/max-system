import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;

// Server: prefer service role (bypasses RLS). Client: fall back to anon.
const serverKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const isServer = typeof window === "undefined";

const key = isServer && serverKey ? serverKey : anonKey;

export const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Explicit admin client for clarity in server code that wants to be obvious
// about bypassing RLS. Identical to `supabase` on the server.
export const supabaseAdmin = createClient(url, serverKey ?? anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
