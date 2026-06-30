import { AgentClient } from "@croo-network/sdk";

const config = {
  baseURL: process.env.CROO_API_URL || "https://api.croo.network",
  wsURL: process.env.CROO_WS_URL || "wss://api.croo.network/ws",
};

let providerClient: AgentClient | null = null;
let requesterClient: AgentClient | null = null;

/**
 * Provider client = the seller's Relay agent (receives orders, delivers).
 * Uses CROO_SDK_KEY (the Deskon Relay agent key).
 */
export function getProviderClient(): AgentClient {
  if (providerClient) return providerClient;
  const key = process.env.CROO_SDK_KEY;
  if (!key) throw new Error("CROO_SDK_KEY not set");
  providerClient = new AgentClient(config, key);
  return providerClient;
}

/**
 * Requester client = the "Deskon Pay" agent that pays sellers on behalf of
 * human buyers. Uses CROO_REQUESTER_SDK_KEY.
 */
export function getRequesterClient(): AgentClient {
  if (requesterClient) return requesterClient;
  const key = process.env.CROO_REQUESTER_SDK_KEY;
  if (!key) throw new Error("CROO_REQUESTER_SDK_KEY not set — register the Deskon Pay agent first");
  requesterClient = new AgentClient(config, key);
  return requesterClient;
}

export function hasRequesterKey(): boolean {
  return !!process.env.CROO_REQUESTER_SDK_KEY;
}
