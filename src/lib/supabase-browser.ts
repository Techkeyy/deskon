"use client";

import { createClient, SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

/** Browser-side Supabase client (publishable key) — used only for Google OAuth. */
export function supabaseBrowser(): SupabaseClient {
  if (browserClient) return browserClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase browser env not set.");
  browserClient = createClient(url, key);
  return browserClient;
}

export function googleConfigured(): boolean {
  return (
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}

/** Current Google session, if the browser has one (after an OAuth redirect). */
export async function getGoogleSession(): Promise<{
  token: string;
  email: string;
} | null> {
  if (!googleConfigured()) return null;
  const { data } = await supabaseBrowser().auth.getSession();
  const session = data.session;
  if (!session?.access_token || !session.user?.email) return null;
  return { token: session.access_token, email: session.user.email };
}

/** Sign the Google session out of the browser (does not touch the Relay). */
export async function googleSignOut(): Promise<void> {
  if (!googleConfigured()) return;
  await supabaseBrowser().auth.signOut();
}
