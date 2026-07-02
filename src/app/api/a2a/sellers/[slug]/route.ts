import { NextRequest, NextResponse } from "next/server";
import { getSellerBySlug } from "@/lib/db";

/**
 * Machine-readable seller card. A visiting agent reads this to learn the
 * closer's services and price bounds, then negotiates over the chat contract
 * below — the exact same endpoint the human UI uses.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const origin = req.nextUrl.origin;
  const seller = await getSellerBySlug(slug);

  if (!seller) {
    return NextResponse.json(
      { error: "closer not found" },
      { status: 404, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }

  return NextResponse.json(
    {
      slug: seller.slug,
      name: seller.displayName,
      role: "AI deal-closer",
      settlement: {
        protocol: "CROO Agent Protocol (CAP)",
        network: "Base mainnet",
        currency: "USDC",
      },
      services: seller.services.map((s) => ({
        name: s.name,
        description: s.description,
        priceRange: { min: s.minPrice, max: s.maxPrice, currency: s.currency },
        examples: s.examples,
      })),
      // How to transact — the same API the browser chat uses.
      interaction: {
        negotiate: {
          method: "POST",
          url: `${origin}/api/chat`,
          body: {
            slug: seller.slug,
            message: "<your message>",
            conversationId: "<omit on first turn; reuse the returned id after>",
          },
          returns: {
            conversationId: "string",
            message: "closer's reply",
            status:
              "active | negotiating | payment_pending | completed",
            functionCall:
              "when status is payment_pending, name is 'initiate_payment' with args.amount",
          },
        },
        pay: {
          method: "POST",
          url: `${origin}/api/payment/initiate`,
          body: { conversationId: "<from negotiate>" },
          note: "Settles the agreed amount in USDC escrow on Base via CROO. Call once status is payment_pending.",
        },
        resume: {
          method: "GET",
          url: `${origin}/api/chat?conversationId=<id>`,
        },
      },
    },
    { headers: { "Access-Control-Allow-Origin": "*" } }
  );
}
