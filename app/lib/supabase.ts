import { createClient } from "@supabase/supabase-js";

// Server-only client. The service key must never be exposed to the browser,
// so do NOT give these variables a NEXT_PUBLIC_ prefix.
export function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;

  return createClient(url, key, { auth: { persistSession: false } });
}