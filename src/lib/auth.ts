import { verifyMessage } from "viem";
import { getSellerByWallet, getSellerByEmail } from "./db";
import { supabaseAuthServer } from "./supabase-server";
import { SellerProfile } from "@/types";

const MAX_AGE_MS = 5 * 60 * 1000; // wallet signatures are valid for 5 minutes

export type AuthResult =
  | { ok: true; seller: SellerProfile }
  | { ok: false; error: string };

/** Credentials accepted by the dashboard — a wallet signature OR a Google session token. */
export interface AuthInput {
  wallet?: string;
  message?: string;
  signature?: string;
  googleToken?: string;
}

/**
 * Verify a seller signed the dashboard-auth message with the wallet they claim,
 * then resolve the Relay bound to that wallet.
 */
export async function verifySellerAuth(input: {
  wallet?: string;
  message?: string;
  signature?: string;
}): Promise<AuthResult> {
  const { wallet, message, signature } = input;
  if (!wallet || !message || !signature) {
    return { ok: false, error: "Missing auth fields." };
  }

  const ts = message.match(/Time:\s*(\d+)/)?.[1];
  if (!ts || Date.now() - Number(ts) > MAX_AGE_MS) {
    return { ok: false, error: "Signature expired — reconnect." };
  }

  if (!message.toLowerCase().includes(wallet.toLowerCase())) {
    return { ok: false, error: "Wallet mismatch." };
  }

  let valid = false;
  try {
    valid = await verifyMessage({
      address: wallet as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });
  } catch {
    valid = false;
  }
  if (!valid) return { ok: false, error: "Invalid signature." };

  const seller = await getSellerByWallet(wallet);
  if (!seller) {
    return { ok: false, error: "No Relay is bound to this wallet yet." };
  }

  return { ok: true, seller };
}

/**
 * Validate a Supabase (Google) access token, then resolve the Relay linked to
 * that email. Payout still routes to the seller's stored wallet — this is a
 * read/convenience login only.
 */
export async function verifyGoogleAuth(
  token?: string
): Promise<AuthResult> {
  if (!token) return { ok: false, error: "Missing Google session." };

  let email: string | undefined;
  try {
    const { data, error } = await supabaseAuthServer().auth.getUser(token);
    if (error) return { ok: false, error: "Google session invalid or expired." };
    email = data.user?.email ?? undefined;
  } catch {
    return { ok: false, error: "Could not verify Google session." };
  }
  if (!email) return { ok: false, error: "Google account has no email." };

  const seller = await getSellerByEmail(email);
  if (!seller) {
    return {
      ok: false,
      error:
        "No Relay is linked to this Google account yet. Sign in with your payout wallet, or create a Relay.",
    };
  }
  return { ok: true, seller };
}

/**
 * Extract the verified email from a Supabase (Google) access token.
 * Used at setup so the linked email is proven, never client-claimed.
 */
export async function googleEmailFromToken(
  token?: string | null
): Promise<string | null> {
  if (!token) return null;
  try {
    const { data, error } = await supabaseAuthServer().auth.getUser(token);
    if (error) return null;
    return data.user?.email?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

/** Resolve a seller from either credential type — Google token preferred if present. */
export async function resolveSellerAuth(input: AuthInput): Promise<AuthResult> {
  if (input.googleToken) return verifyGoogleAuth(input.googleToken);
  return verifySellerAuth(input);
}
