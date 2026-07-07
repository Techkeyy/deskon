import {
  createPublicClient,
  createWalletClient,
  http,
  erc20Abi,
  parseUnits,
  formatUnits,
} from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

// USDC on Base mainnet.
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;

export function treasuryConfigured(): boolean {
  return !!process.env.TREASURY_PRIVATE_KEY;
}

function account() {
  const pk = process.env.TREASURY_PRIVATE_KEY as `0x${string}` | undefined;
  if (!pk) throw new Error("TREASURY_PRIVATE_KEY not set");
  return privateKeyToAccount(pk);
}

export function treasuryAddress(): string {
  return account().address;
}

export interface PayoutResult {
  ok: boolean;
  tx?: string;
  error?: string;
}

/**
 * Send USDC from the Deskon treasury to a seller's payout wallet.
 * Checks the treasury balance first so a short tank fails cleanly
 * instead of reverting on-chain.
 */
export async function sendUsdc(
  to: string,
  amount: number
): Promise<PayoutResult> {
  try {
    const acct = account();
    const publicClient = createPublicClient({ chain: base, transport: http() });
    const walletClient = createWalletClient({
      account: acct,
      chain: base,
      transport: http(),
    });

    const units = parseUnits(amount.toFixed(6), 6);

    const balance = await publicClient.readContract({
      address: USDC,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [acct.address],
    });
    if (balance < units) {
      return {
        ok: false,
        error: `Treasury holds $${formatUnits(balance, 6)} USDC — top up ${acct.address} to cover $${amount}.`,
      };
    }

    const tx = await walletClient.writeContract({
      address: USDC,
      abi: erc20Abi,
      functionName: "transfer",
      args: [to as `0x${string}`, units],
    });

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: tx,
      timeout: 120_000,
    });
    if (receipt.status !== "success") {
      return { ok: false, error: `Payout tx reverted: ${tx}` };
    }

    return { ok: true, tx };
  } catch (err: any) {
    return { ok: false, error: err.shortMessage || err.message };
  }
}
