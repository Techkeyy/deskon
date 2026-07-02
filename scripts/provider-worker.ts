/**
 * Deskon Relay — Provider Worker
 *
 * Long-running process that keeps Deskon's provider agent "online" on CROO.
 * It listens for incoming negotiations, auto-accepts them, and delivers
 * a deal-confirmation once the buyer pays.
 *
 * Run with:  npm run relay
 *
 * Requires CROO_SDK_KEY (the Relay/provider agent key) in the environment.
 * Locally that comes from .env.local; on Railway/Render from platform env vars.
 */

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { AgentClient, DeliverableType, EventType } from "@croo-network/sdk";

const HEARTBEAT_MS = 5 * 60 * 1000;
const BACKOFF_START_MS = 1_000;
const BACKOFF_MAX_MS = 60_000;

if (!process.env.CROO_SDK_KEY) {
  console.error("[relay] CROO_SDK_KEY not set — aborting.");
  process.exit(1);
}

const client = new AgentClient(
  {
    baseURL: process.env.CROO_API_URL || "https://api.croo.network",
    wsURL: process.env.CROO_WS_URL || "wss://api.croo.network/ws",
  },
  process.env.CROO_SDK_KEY,
);

let shuttingDown = false;
let backoffMs = BACKOFF_START_MS;

function attachHandlers(stream: any) {
  stream.on(EventType.NegotiationCreated, async (event: any) => {
    const negId = event.negotiation_id;
    console.log(`[relay] negotiation received: ${negId}`);
    try {
      const result = await client.acceptNegotiation(negId);
      console.log(`[relay] accepted — on-chain order: ${result.order.orderId}`);
    } catch (err: any) {
      console.error(`[relay] accept failed for ${negId}: ${err.message}`);
    }
  });

  stream.on(EventType.OrderPaid, async (event: any) => {
    const orderId = event.order_id;
    console.log(`[relay] order paid: ${orderId} — delivering confirmation`);
    try {
      const order = await client.getOrder(orderId);
      await client.deliverOrder(orderId, {
        deliverableType: DeliverableType.Text,
        deliverableText: JSON.stringify({
          status: "deal_closed",
          orderId,
          price: order.price,
          message:
            "Deal confirmed via Deskon Relay. The seller will follow up to begin the work.",
          closedAt: new Date().toISOString(),
        }),
      });
      console.log(`[relay] delivered — order ${orderId} settling on-chain`);
    } catch (err: any) {
      console.error(`[relay] deliver failed for ${orderId}: ${err.message}`);
    }
  });

  stream.on(EventType.OrderCompleted, (event: any) => {
    console.log(`[relay] order completed & settled: ${event.order_id}`);
  });
}

/**
 * Connect and stay connected. Any close/error tears the stream down and we
 * reconnect with exponential backoff; a successful connection resets it.
 */
async function run(): Promise<void> {
  while (!shuttingDown) {
    try {
      console.log("[relay] connecting to CROO…");
      const stream = await client.connectWebSocket();
      console.log("[relay] ONLINE — listening for negotiations and payments");
      backoffMs = BACKOFF_START_MS;

      attachHandlers(stream);

      // Hold here until the underlying socket dies, then loop to reconnect.
      await new Promise<void>((resolve) => {
        const emitter = stream as {
          on: (ev: string, fn: (...args: any[]) => void) => void;
        };
        for (const ev of ["close", "disconnect", "error", "end"]) {
          try {
            emitter.on(ev, (arg: any) => {
              console.error(
                `[relay] stream ${ev}${arg?.message ? `: ${arg.message}` : ""}`
              );
              resolve();
            });
          } catch {
            /* SDK may not expose this event — fine */
          }
        }
      });
    } catch (err: any) {
      console.error(`[relay] connection failed: ${err.message}`);
    }

    if (shuttingDown) break;
    console.log(`[relay] reconnecting in ${Math.round(backoffMs / 1000)}s`);
    await new Promise((r) => setTimeout(r, backoffMs));
    backoffMs = Math.min(backoffMs * 2, BACKOFF_MAX_MS);
  }
}

// Heartbeat so the host's log view shows the worker is alive.
setInterval(() => {
  console.log(`[relay] heartbeat — alive at ${new Date().toISOString()}`);
}, HEARTBEAT_MS).unref();

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    console.log(`[relay] ${sig} — shutting down`);
    shuttingDown = true;
    process.exit(0);
  });
}

run().catch((err) => {
  console.error("[relay] fatal:", err);
  process.exit(1); // host restart policy takes over
});
