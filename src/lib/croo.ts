import { AgentClient } from "@croo-network/sdk";

let clientInstance: AgentClient | null = null;

export function getCrooClient(): AgentClient {
  if (clientInstance) return clientInstance;

  const apiKey = process.env.CROO_SDK_KEY;
  if (!apiKey) throw new Error("CROO_SDK_KEY not set");

  clientInstance = new AgentClient(
    {
      baseURL: process.env.CROO_API_URL || "https://api.croo.network",
      wsURL: process.env.CROO_WS_URL || "wss://api.croo.network/ws",
    },
    apiKey
  );

  return clientInstance;
}

export async function testConnection(): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    const client = getCrooClient();
    const negotiations = await client.listNegotiations({ page: 1, pageSize: 1 });
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}
