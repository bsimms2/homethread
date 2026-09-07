import { createClient } from "@supabase/supabase-js";

/**
 * The URL and publishable key are meant to be public: every row is guarded
 * by row-level security keyed on the signed-in user's email (see
 * supabase/schema.sql). Nothing here is a secret.
 */
export const SUPABASE_URL = "https://punorbgwckjyexbbkpvq.supabase.co";
export const SUPABASE_KEY = "sb_publishable_IdSuzNwYgvJRSz_lFgr8NQ_6kP6clRb";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
