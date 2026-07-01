import { verifyMessage } from "viem";
import { getSellerByWallet } from "./db";
import { SellerProfile } from "@/types";

const MAX_AGE_MS = 5 * 60 * 1000; // signatures are valid for 5 minutes

type AuthResult =
  | { ok: true; seller: SellerProfile }
  | { ok: false; error: string };

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
