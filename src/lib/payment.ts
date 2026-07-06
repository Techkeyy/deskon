import { getRequesterClient } from "./croo-clients";
import { isInsufficientBalance } from "@croo-network/sdk";

export interface PaymentResult {
  ok: boolean;
  orderId?: string;
  status?: string;
  payTxHash?: string;
  /** What actually settled on-chain (the CROO service price) — the ledger
   * must credit this, not the chat-negotiated figure. */
  settledAmount?: number;
  error?: string;
  needsFunds?: boolean;
}

/**
 * Creates an order against a seller's CROO service and pays for it,
 * acting as the requester (Deskon Pay agent).
 *
 * Flow: negotiate -> (provider worker auto-accepts -> on-chain order) ->
 * poll until order exists -> payOrder -> escrow locked.
 *
 * The provider worker (scripts/provider-worker.ts) must be running for the
 * negotiation to be accepted.
 */
export async function createAndPayOrder(
  serviceId: string,
  requirements: string,
): Promise<PaymentResult> {
  try {
    const client = getRequesterClient();

    // 1. Open negotiation against the seller's service
    const negotiation = await client.negotiateOrder({
      serviceId,
      requirements,
    });

    // 2. Poll until the provider accepts and the on-chain order is created
    const orderId = await waitForOrder(negotiation.negotiationId);
    if (!orderId) {
      return { ok: false, error: "Provider did not accept in time. Is the Relay online?" };
    }

    // 3. Pay — SDK auto-handles USDC approve
    const payResult = await client.payOrder(orderId);

    const settled = Number((payResult.order as { price?: unknown }).price);

    return {
      ok: true,
      orderId,
      status: payResult.order.status,
      payTxHash: payResult.txHash,
      settledAmount: Number.isFinite(settled) ? settled : undefined,
    };
  } catch (err: any) {
    if (isInsufficientBalance(err)) {
      return {
        ok: false,
        needsFunds: true,
        error: "Buyer wallet has insufficient USDC on Base.",
      };
    }
    return { ok: false, error: err.message };
  }
}

/**
 * Polls the negotiation until it's accepted and an order is created.
 * Returns the orderId, or null on timeout.
 */
async function waitForOrder(
  negotiationId: string,
  timeoutMs = 60000,
  intervalMs = 3000,
): Promise<string | null> {
  const client = getRequesterClient();
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const neg = await client.getNegotiation(negotiationId);

    if (neg.status === "accepted") {
      const orders = await client.listOrders({ role: "buyer", pageSize: 20 });
      const order = orders.find((o) => o.negotiationId === negotiationId);
      if (order && order.status === "created") return order.orderId;
      // Order exists but still "creating" on-chain — keep polling
    }

    if (neg.status === "rejected" || neg.status === "expired") {
      return null;
    }

    await sleep(intervalMs);
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
