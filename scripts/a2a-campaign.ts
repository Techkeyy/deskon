/**
 * Deskon A2A campaign — anti-sybil settlement runs.
 *
 * Executes a matrix of real CROO deals across 5 distinct buyer agents
 * (5 unique wallets) and 3 distinct provider agents, so the on-chain
 * trade graph shows genuine variety instead of one self-trading wallet.
 *
 * - Providers 2 & 3 are accepted/delivered by THIS process (one WS each).
 * - Provider 1 (the main Deskon Relay, env CROO_SDK_KEY) is accepted by the
 *   hosted Render worker — wake it first: curl https://deskon.onrender.com/
 *
 * Usage:
 *   npx tsx scripts/a2a-campaign.ts           # run all deals
 *   npx tsx scripts/a2a-campaign.ts 3 6       # rerun only deals #3 and #6
 *
 * Keys live in a2a-agents.json (gitignored).
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

interface ProviderDef { name: string; sdkKey: string; serviceId: string }
interface BuyerDef { name: string; sdkKey: string }

const agents: { providers: ProviderDef[]; buyers: BuyerDef[] } = JSON.parse(
  readFileSync(join(process.cwd(), "a2a-agents.json"), "utf8")
);

// Provider 1 = the main Deskon Relay (env). Its worker runs on Render.
const P1: ProviderDef = {
  name: "deskon-relay (hosted worker)",
  sdkKey: process.env.CROO_SDK_KEY!,
  serviceId: process.env.CROO_DEMO_SERVICE_ID!,
};
const [P2, P3] = agents.providers;

// The deal matrix: every buyer trades, all three providers see volume.
const DEALS: { buyer: string; provider: ProviderDef; requirements: string }[] = [
  { buyer: "buyer-1", provider: P2, requirements: "One product teaser cut for a coffee brand — 20s, captions on." },
  { buyer: "buyer-2", provider: P3, requirements: "Logo refresh concept for a small fitness studio." },
  { buyer: "buyer-3", provider: P1, requirements: "Short TikTok ad edit, footage supplied, energetic pacing." },
  { buyer: "buyer-4", provider: P2, requirements: "Vertical recap edit of a launch event, 30s." },
  { buyer: "buyer-5", provider: P3, requirements: "Simple brand mark exploration, two directions." },
  { buyer: "buyer-2", provider: P1, requirements: "Second edit: UGC-style clip for a sneaker drop." },
  { buyer: "buyer-4", provider: P3, requirements: "Social banner set to match new brand look." },
];

function log(tag: string, msg: string) {
  console.log(`\x1b[2m[${tag}]\x1b[0m ${msg}`);
}

/** Keep providers 2 & 3 online in this process: accept + deliver. */
async function bringProvidersOnline(): Promise<void> {
  for (const p of [P2, P3]) {
    const client = new AgentClient(cfg, p.sdkKey);
    const stream = await client.connectWebSocket();
    stream.on(EventType.NegotiationCreated, async (ev: any) => {
      try {
        const r = await client.acceptNegotiation(ev.negotiation_id);
        log(p.name, `accepted → order ${r.order.orderId}`);
      } catch (e: any) {
        log(p.name, `accept failed: ${e.message}`);
      }
    });
    stream.on(EventType.OrderPaid, async (ev: any) => {
      try {
        await client.deliverOrder(ev.order_id, {
          deliverableType: DeliverableType.Text,
          deliverableText: JSON.stringify({
            status: "deal_closed",
            orderId: ev.order_id,
            message: "Deal confirmed via Deskon Relay.",
            closedAt: new Date().toISOString(),
          }),
        });
        log(p.name, `delivered order ${ev.order_id}`);
      } catch (e: any) {
        log(p.name, `deliver failed: ${e.message}`);
      }
    });
    log(p.name, "ONLINE");
  }
}

async function waitForOrder(
  buyer: AgentClient,
  negotiationId: string,
  timeoutMs = 90_000
): Promise<string | null> {
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

interface RunResult {
  n: number;
  buyer: string;
  provider: string;
  ok: boolean;
  orderId?: string;
  tx?: string;
  error?: string;
}

async function runDeal(n: number): Promise<RunResult> {
  const deal = DEALS[n - 1];
  const buyerDef = agents.buyers.find((b) => b.name === deal.buyer)!;
  const base: RunResult = { n, buyer: deal.buyer, provider: deal.provider.name, ok: false };

  console.log(`\n\x1b[1m— deal #${n}: ${deal.buyer} → ${deal.provider.name}\x1b[0m`);
  try {
    const buyer = new AgentClient(cfg, buyerDef.sdkKey);
    const neg = await buyer.negotiateOrder({
      serviceId: deal.provider.serviceId,
      requirements: JSON.stringify({ brief: deal.requirements, via: "deskon-a2a" }),
    });
    log(deal.buyer, `negotiation ${neg.negotiationId} opened`);

    const orderId = await waitForOrder(buyer, neg.negotiationId);
    if (!orderId) return { ...base, error: "provider did not accept in time" };
    log(deal.buyer, `order ${orderId} created — paying…`);

    const pay = await buyer.payOrder(orderId);
    console.log(`\x1b[32m  ✓ settled — tx ${pay.txHash}\x1b[0m`);
    return { ...base, ok: true, orderId, tx: pay.txHash };
  } catch (e: any) {
    if (isInsufficientBalance(e)) {
      return { ...base, error: "INSUFFICIENT USDC — fund this buyer's wallet" };
    }
    return { ...base, error: e.message };
  }
}

async function main() {
  const only = process.argv.slice(2).map(Number).filter(Boolean);
  const toRun = only.length
    ? only
    : DEALS.map((_, i) => i + 1);

  if (!P1.sdkKey || !P1.serviceId) {
    console.error("CROO_SDK_KEY / CROO_DEMO_SERVICE_ID missing from env.");
    process.exit(1);
  }

  console.log(`Running deals: ${toRun.join(", ")}`);
  console.log("(provider-1 deals need the Render worker awake)\n");

  await bringProvidersOnline();

  const results: RunResult[] = [];
  for (const n of toRun) {
    results.push(await runDeal(n));
    await new Promise((r) => setTimeout(r, 4000)); // no concurrent pays
  }

  // Grace period so paid orders get delivered before we exit.
  console.log("\nwaiting 30s for deliveries to complete…");
  await new Promise((r) => setTimeout(r, 30_000));

  console.log("\n\x1b[1m═══ campaign summary ═══\x1b[0m");
  for (const r of results) {
    if (r.ok) {
      console.log(`  #${r.n} ${r.buyer} → ${r.provider}\n     order ${r.orderId}\n     tx ${r.tx}`);
    } else {
      console.log(`  #${r.n} ${r.buyer} → ${r.provider}  \x1b[31m✗ ${r.error}\x1b[0m`);
    }
  }
  const okCount = results.filter((r) => r.ok).length;
  console.log(`\n${okCount}/${results.length} settled.`);
  if (okCount < results.length) {
    const failed = results.filter((r) => !r.ok).map((r) => r.n);
    console.log(`retry failed ones with: npx tsx scripts/a2a-campaign.ts ${failed.join(" ")}`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error("campaign crashed:", e);
  process.exit(1);
});
