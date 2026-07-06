/**
 * Funding round — spread the Deskon Relay agent's USDC into the five buyer
 * agents via real CROO deals (withdraws are blocked for undeployed wallets;
 * deals are the only pipe that always works).
 *
 * Relay agent (CROO_SDK_KEY) acts as the BUYER paying each buyer-agent's
 * one-off service. This process connects all five buyer agents as providers
 * so each accepts + delivers its own negotiation — no mapping needed.
 *
 * Usage: npx tsx scripts/fund-buyers.ts [serviceIndex...]   (1-based subset)
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

const agents = JSON.parse(
  readFileSync(join(process.cwd(), "a2a-agents.json"), "utf8")
) as {
  fundingServices: string[];
  buyers: { name: string; sdkKey: string }[];
};

const relayKey = process.env.CROO_SDK_KEY;
if (!relayKey) {
  console.error("CROO_SDK_KEY not set");
  process.exit(1);
}
const payer = new AgentClient(cfg, relayKey);

function log(tag: string, msg: string) {
  console.log(`\x1b[2m[${tag}]\x1b[0m ${msg}`);
}

/** All five buyer agents online as providers: accept + deliver their own deals. */
async function buyersOnline() {
  for (const b of agents.buyers) {
    const client = new AgentClient(cfg, b.sdkKey);
    const stream = await client.connectWebSocket();
    stream.on(EventType.NegotiationCreated, async (ev: any) => {
      try {
        const r = await client.acceptNegotiation(ev.negotiation_id);
        log(b.name, `accepted → order ${r.order.orderId}`);
      } catch (e: any) {
        log(b.name, `accept failed: ${e.message}`);
      }
    });
    stream.on(EventType.OrderPaid, async (ev: any) => {
      try {
        await client.deliverOrder(ev.order_id, {
          deliverableType: DeliverableType.Text,
          deliverableText: JSON.stringify({
            status: "delivered",
            orderId: ev.order_id,
            closedAt: new Date().toISOString(),
          }),
        });
        log(b.name, `delivered ${ev.order_id}`);
      } catch (e: any) {
        log(b.name, `deliver failed: ${e.message}`);
      }
    });
    log(b.name, "online (provider mode)");
  }
}

async function waitForOrder(negotiationId: string, timeoutMs = 90_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const neg = await payer.getNegotiation(negotiationId);
    if (neg.status === "accepted") {
      const orders = await payer.listOrders({ role: "buyer", pageSize: 20 });
      const order = orders.find((o) => o.negotiationId === negotiationId);
      if (order && order.status === "created") return order.orderId;
    }
    if (neg.status === "rejected" || neg.status === "expired") return null;
    await new Promise((r) => setTimeout(r, 3000));
  }
  return null;
}

async function main() {
  const only = process.argv.slice(2).map(Number).filter(Boolean);
  const idxs = only.length
    ? only
    : agents.fundingServices.map((_, i) => i + 1);

  await buyersOnline();
  console.log("");

  const results: { i: number; ok: boolean; tx?: string; error?: string }[] = [];

  for (const i of idxs) {
    const serviceId = agents.fundingServices[i - 1];
    console.log(`\x1b[1m— funding deal #${i} (service ${serviceId.slice(0, 8)}…)\x1b[0m`);
    try {
      const neg = await payer.negotiateOrder({
        serviceId,
        requirements: JSON.stringify({
          brief: `Funding round gig #${i} — deliver the one-off service as described.`,
          via: "deskon-relay",
        }),
      });
      log("relay", `negotiation ${neg.negotiationId} opened`);
      const orderId = await waitForOrder(neg.negotiationId);
      if (!orderId) {
        results.push({ i, ok: false, error: "not accepted in time" });
        continue;
      }
      log("relay", `order ${orderId} — paying…`);
      const pay = await payer.payOrder(orderId);
      console.log(`\x1b[32m  ✓ paid — tx ${pay.txHash}\x1b[0m\n`);
      results.push({ i, ok: true, tx: pay.txHash });
    } catch (e: any) {
      const msg = isInsufficientBalance(e)
        ? "INSUFFICIENT USDC in relay wallet"
        : e.message;
      console.log(`\x1b[31m  ✗ ${msg}\x1b[0m\n`);
      results.push({ i, ok: false, error: msg });
    }
    await new Promise((r) => setTimeout(r, 4000));
  }

  console.log("waiting 25s for deliveries…");
  await new Promise((r) => setTimeout(r, 25_000));

  console.log("\n\x1b[1m═══ funding summary ═══\x1b[0m");
  for (const r of results) {
    console.log(
      r.ok
        ? `  #${r.i} ✓ ${r.tx}`
        : `  #${r.i} ✗ ${r.error}`
    );
  }
  const failed = results.filter((r) => !r.ok).map((r) => r.i);
  if (failed.length)
    console.log(`\nretry: npx tsx scripts/fund-buyers.ts ${failed.join(" ")}`);
  process.exit(0);
}

main().catch((e) => {
  console.error("funding crashed:", e);
  process.exit(1);
});
