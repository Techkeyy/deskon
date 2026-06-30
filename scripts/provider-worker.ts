/**
 * Deskon Relay — Provider Worker
 *
 * Long-running process that keeps a seller's Relay "online" on CROO.
 * It listens for incoming negotiations, auto-accepts them, and delivers
 * a deal-confirmation once the buyer pays.
 *
 * Run with:  npx tsx scripts/provider-worker.ts
 *
 * Requires CROO_SDK_KEY (the Relay/provider agent key) in the environment.
 */

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { AgentClient, DeliverableType, EventType } from "@croo-network/sdk";

const client = new AgentClient(
  {
    baseURL: process.env.CROO_API_URL || "https://api.croo.network",
    wsURL: process.env.CROO_WS_URL || "wss://api.croo.network/ws",
  },
  process.env.CROO_SDK_KEY!,
);

async function main() {
  if (!process.env.CROO_SDK_KEY) {
    console.error("✗ CROO_SDK_KEY not set in .env.local");
    process.exit(1);
  }

  console.log("⚡ Deskon Relay provider worker starting...");
  const stream = await client.connectWebSocket();
  console.log("✓ Connected to CROO. Relay is ONLINE and listening for orders.\n");

  stream.on(EventType.NegotiationCreated, async (event: any) => {
    const negId = event.negotiation_id;
    console.log(`→ Negotiation received: ${negId}`);
    try {
      const result = await client.acceptNegotiation(negId);
      console.log(`  ✓ Accepted. On-chain order created: ${result.order.orderId}`);
    } catch (err: any) {
      console.error(`  ✗ Accept failed: ${err.message}`);
    }
  });

  stream.on(EventType.OrderPaid, async (event: any) => {
    const orderId = event.order_id;
    console.log(`→ Order paid: ${orderId} — delivering confirmation...`);
    try {
      const order = await client.getOrder(orderId);
      await client.deliverOrder(orderId, {
        deliverableType: DeliverableType.Text,
        deliverableText: JSON.stringify({
          status: "deal_closed",
          orderId,
          price: order.price,
          message: "Deal confirmed via Deskon Relay. The seller will follow up to begin the work.",
          closedAt: new Date().toISOString(),
        }),
      });
      console.log(`  ✓ Delivered. Order ${orderId} settling on-chain.\n`);
    } catch (err: any) {
      console.error(`  ✗ Deliver failed: ${err.message}`);
    }
  });

  stream.on(EventType.OrderCompleted, (event: any) => {
    console.log(`✓ Order completed & settled: ${event.order_id}\n`);
  });

  // Keep the process alive
  process.on("SIGINT", () => {
    console.log("\nShutting down Relay worker...");
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("Worker crashed:", err);
  process.exit(1);
});
