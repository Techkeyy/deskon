/**
 * Drain idle USDC from the buyer agents into Deskon Pay (the requester wallet
 * the sponsored spot-check spends from). CROO's withdraw UI is broken
 * ("not in deployable state"), so we move funds the only way that works: a
 * deal. Buyers pay a service owned by Deskon Pay; escrow clears into it.
 *
 * Deskon Pay (CROO_REQUESTER_SDK_KEY) runs the provider side here (accept +
 * deliver). Buyers 2-5 (deployed, funded) pay. Buyer-1 is skipped (its
 * funding stuck; likely undeployed).
 *
 * Usage: npx tsx scripts/fund-deskonpay.ts <deskonpay-service-id>
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { readFileSync } from "fs";
import { join } from "path";
import {
  AgentClient,
  DeliverableType,
  EventType,
  isInsufficientBalance,
} from "@croo-network/sdk";

const cfg = {
  baseURL: process.env.CROO_API_URL || "https://api.croo.network",
  wsURL: process.env.CROO_WS_URL || "wss://api.croo.network/ws",
};

const serviceId = process.argv[2];
if (!serviceId) {
  console.log("usage: npx tsx scripts/fund-deskonpay.ts <deskonpay-service-id>");
  process.exit(1);
}

const agents = JSON.parse(
  readFileSync(join(process.cwd(), "a2a-agents.json"), "utf8")
) as { buyers: { name: string; sdkKey: string }[] };

// The deployed, funded buyers (buyer-1 skipped).
const payers = agents.buyers.filter((b) => b.name !== "buyer-1");

const deskonPay = new AgentClient(cfg, process.env.CROO_REQUESTER_SDK_KEY!);

function log(tag: string, msg: string) {
  console.log(`\x1b[2m[${tag}]\x1b[0m ${msg}`);
}

/** Deskon Pay online as the provider: accept + deliver its own service. */
async function providerOnline() {
  const stream = await deskonPay.connectWebSocket();
  stream.on(EventType.NegotiationCreated, async (ev: any) => {
    try {
      const r = await deskonPay.acceptNegotiation(ev.negotiation_id);
      log("deskon-pay", `accepted → order ${r.order.orderId}`);
    } catch (e: any) {
      log("deskon-pay", `accept failed: ${e.message}`);
    }
  });
  stream.on(EventType.OrderPaid, async (ev: any) => {
    try {
      await deskonPay.deliverOrder(ev.order_id, {
        deliverableType: DeliverableType.Text,
        deliverableText: JSON.stringify({ status: "delivered", orderId: ev.order_id }),
      });
      log("deskon-pay", `delivered ${ev.order_id}`);
    } catch (e: any) {
      log("deskon-pay", `deliver failed: ${e.message}`);
    }
  });
  log("deskon-pay", "ONLINE (provider mode)");
}

async function waitForOrder(buyer: AgentClient, negotiationId: string, timeoutMs = 90_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const neg = await buyer.getNegotiation(negotiationId);
    if (neg.status === "accepted") {
      const orders = await buyer.listOrders({ role: "buyer", pageSize: 20 });
      const order = orders.find((o) => o.negotiationId === negotiationId);
      if (order && order.status === "created") return order.orderId;
    }
    if (neg.status === "rejected" || neg.status === "expired") return null;
    await new Promise((r) => setTimeout(r, 3000));
  }
  return null;
}

async function main() {
  await providerOnline();
  console.log("");

  const results: { name: string; ok: boolean; tx?: string; error?: string }[] = [];
  for (const b of payers) {
    console.log(`\n\x1b[1m— ${b.name} → deskon-pay\x1b[0m`);
    try {
      const buyer = new AgentClient(cfg, b.sdkKey);
      const neg = await buyer.negotiateOrder({
        serviceId,
        requirements: JSON.stringify({ note: "consolidating idle balance", from: b.name }),
      });
      const orderId = await waitForOrder(buyer, neg.negotiationId);
      if (!orderId) {
        results.push({ name: b.name, ok: false, error: "not accepted in time" });
        continue;
      }
      const pay = await buyer.payOrder(orderId);
      console.log(`\x1b[32m  ✓ paid — tx ${pay.txHash}\x1b[0m`);
      results.push({ name: b.name, ok: true, tx: pay.txHash });
    } catch (e: any) {
      const msg = isInsufficientBalance(e) ? "insufficient balance (already drained)" : e.message;
      console.log(`\x1b[31m  ✗ ${msg}\x1b[0m`);
      results.push({ name: b.name, ok: false, error: msg });
    }
    await new Promise((r) => setTimeout(r, 4000));
  }

  console.log("\nwaiting 25s for deliveries…");
  await new Promise((r) => setTimeout(r, 25_000));

  console.log("\n\x1b[1m═══ summary ═══\x1b[0m");
  for (const r of results) console.log(r.ok ? `  ${r.name} ✓ ${r.tx}` : `  ${r.name} ✗ ${r.error}`);
  const ok = results.filter((r) => r.ok).length;
  console.log(`\n${ok}/${results.length} moved into Deskon Pay.`);
  process.exit(0);
}

main().catch((e) => { console.error("drain crashed:", e); process.exit(1); });
