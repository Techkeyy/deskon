import { createClient, SupabaseClient } from "@supabase/supabase-js";

let authClient: SupabaseClient | null = null;

/**
 * Server-side Supabase client used only to validate a user's access token
 * via auth.getUser(jwt). Uses the publishable key — the JWT itself is the
 * credential being checked, so no secret is required here.
 */
export function supabaseAuthServer(): SupabaseClient {
  if (authClient) return authClient;
  const url =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase auth env not set.");
  authClient = createClient(url, key, { auth: { persistSession: false } });
  return authClient;
}
