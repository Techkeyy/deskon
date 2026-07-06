// Throwaway: check funding-order statuses from each buyer's provider side,
// and deliver any paid-but-undelivered order.
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { readFileSync } from "fs";
import { AgentClient, DeliverableType } from "@croo-network/sdk";

const cfg = {
  baseURL: "https://api.croo.network",
  wsURL: "wss://api.croo.network/ws",
};
const a = JSON.parse(readFileSync("a2a-agents.json", "utf8"));

async function main() {
  for (const b of a.buyers) {
    const c = new AgentClient(cfg, b.sdkKey);
    const orders = await c.listOrders({ role: "provider", pageSize: 10 });
    for (const o of orders) {
      console.log(`${b.name}: order ${o.orderId.slice(0, 8)} — ${o.status}`);
      if (o.status === "paid") {
        try {
          await c.deliverOrder(o.orderId, {
            deliverableType: DeliverableType.Text,
            deliverableText: JSON.stringify({
              status: "delivered",
              orderId: o.orderId,
              closedAt: new Date().toISOString(),
            }),
          });
          console.log(`${b.name}:   → delivered now`);
        } catch (e: any) {
          console.log(`${b.name}:   → deliver failed: ${e.message}`);
        }
      }
    }
  }
}
main();
