import { NextRequest, NextResponse } from "next/server";

/**
 * Deskon's top-level agent card (A2A discovery).
 * A visiting agent reads this to learn what Deskon is, how deals settle,
 * and where to find the directory of closers it can negotiate with.
 */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;

  return NextResponse.json(
    {
      protocolVersion: "0.1",
      name: "Deskon",
      description:
        "AI deal-closers for sellers. Each seller has a closer agent that qualifies, scopes, negotiates, and settles payment on-chain via the CROO Agent Protocol.",
      provider: { organization: "Deskon", url: origin },
      settlement: {
        protocol: "CROO Agent Protocol (CAP)",
        network: "Base mainnet",
        currency: "USDC",
        flow: ["negotiate", "lock (escrow)", "deliver", "clear"],
      },
      // Also hireable natively in the CROO agent store.
      crooStore:
        "https://agent.croo.network/agents/517d961f-81b9-4735-b843-65f4515937a6",
      capabilities: {
        negotiation: true,
        onchainSettlement: true,
        streaming: false,
      },
      directory: {
        description: "List available closers, then fetch a specific one.",
        listSellers: `${origin}/api/a2a/sellers`,
        sellerCard: `${origin}/api/a2a/sellers/{slug}`,
      },
    },
    { headers: { "Access-Control-Allow-Origin": "*" } }
  );
}
