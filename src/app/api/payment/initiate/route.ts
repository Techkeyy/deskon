import { NextRequest, NextResponse } from "next/server";
import { getConversation, getSellerById, updateConversationStatus, addMessage } from "@/lib/store";
import { createAndPayOrder } from "@/lib/payment";
import { hasRequesterKey } from "@/lib/croo-clients";

export async function POST(req: NextRequest) {
  try {
    const { conversationId } = await req.json();

    if (!conversationId) {
      return NextResponse.json({ error: "conversationId required" }, { status: 400 });
    }

    const convo = getConversation(conversationId);
    if (!convo) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const seller = getSellerById(convo.sellerId);
    if (!seller) {
      return NextResponse.json({ error: "Seller not found" }, { status: 404 });
    }

    // Find the matching service's CROO serviceId
    const service = seller.services[0]; // MVP: use primary service
    const crooServiceId = service?.crooServiceId;

    if (!hasRequesterKey()) {
      return NextResponse.json({
        ok: false,
        error: "Payment not configured: Deskon Pay requester agent not registered yet.",
        stage: "config",
      });
    }

    if (!crooServiceId) {
      return NextResponse.json({
        ok: false,
        error: "Seller service not linked to a CROO service ID yet.",
        stage: "config",
      });
    }

    const requirements = JSON.stringify({
      scope: convo.agreedScope || "",
      price: convo.agreedPrice || 0,
      via: "deskon-relay",
    });

    const result = await createAndPayOrder(crooServiceId, requirements);

    if (result.ok) {
      updateConversationStatus(conversationId, "completed", {
        crooOrderId: result.orderId,
      });
      addMessage(conversationId, {
        role: "assistant",
        content: `✅ Payment confirmed! Order \`${result.orderId?.slice(0, 8)}...\` is locked in escrow on Base. ${seller.displayName} will reach out to start the work.`,
        metadata: { type: "payment_confirmed", orderId: result.orderId },
      });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("Payment error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
