import {
  createPublicClient,
  http,
  parseUnits,
  formatUnits,
  parseEventLogs,
  erc20Abi,
} from "viem";
import { base } from "viem/chains";
import { treasuryAddress, treasuryConfigured } from "./treasury";

// USDC on Base mainnet.
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913".toLowerCase();

export interface DepositCheck {
  ok: boolean;
  amount?: number;
  from?: string;
  error?: string;
}

/**
 * Verify a buyer's USDC deposit on-chain: the tx must be a successful
 * transfer of at least `minAmount` USDC into Deskon's deposit (treasury)
 * address. Replay across orders is blocked by the unique index on
 * orders.deposit_tx — this function only proves the money moved.
 */
export async function verifyUsdcDeposit(
  txHash: string,
  minAmount: number
): Promise<DepositCheck> {
  if (!treasuryConfigured()) {
    return { ok: false, error: "Deposits are not configured." };
  }
  if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
    return { ok: false, error: "Invalid transaction hash." };
  }

  try {
    const client = createPublicClient({ chain: base, transport: http() });
    const receipt = await client.waitForTransactionReceipt({
      hash: txHash as `0x${string}`,
      timeout: 120_000,
    });
    if (receipt.status !== "success") {
      return { ok: false, error: "Deposit transaction reverted." };
    }

    const deposit = treasuryAddress().toLowerCase();
    const transfers = parseEventLogs({
      abi: erc20Abi,
      eventName: "Transfer",
      logs: receipt.logs,
    }).filter(
      (l) =>
        l.address.toLowerCase() === USDC &&
        (l.args.to as string).toLowerCase() === deposit
    );

    const received = transfers.reduce(
      (sum, l) => sum + (l.args.value as bigint),
      BigInt(0)
    );
    if (received === BigInt(0)) {
      return { ok: false, error: "No USDC transfer to Deskon found in that transaction." };
    }
    if (received < parseUnits(minAmount.toFixed(6), 6)) {
      return {
        ok: false,
        error: `Deposit was $${formatUnits(received, 6)} — the agreed price is $${minAmount}.`,
      };
    }

    return {
      ok: true,
      amount: Number(formatUnits(received, 6)),
      from: (transfers[0].args.from as string).toLowerCase(),
    };
  } catch (err: any) {
    return { ok: false, error: err.shortMessage || err.message };
  }
}
