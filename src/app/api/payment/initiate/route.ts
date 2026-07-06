import { NextRequest, NextResponse } from "next/server";
import { getSellerById, createOrder } from "@/lib/db";
import {
  getConversation,
  updateConversationStatus,
  addMessage,
} from "@/lib/store";
import { createAndPayOrder } from "@/lib/payment";
import { hasRequesterKey } from "@/lib/croo-clients";
import { sendDealClosedEmail } from "@/lib/notify";

export async function POST(req: NextRequest) {
  try {
    const { conversationId } = await req.json();

    if (!conversationId) {
      return NextResponse.json({ error: "conversationId required" }, { status: 400 });
    }

    const convo = await getConversation(conversationId);
    if (!convo) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const seller = await getSellerById(convo.sellerId);
    if (!seller) {
      return NextResponse.json({ error: "Seller not found" }, { status: 404 });
    }

    // Path B: every deal settles through the Deskon-managed CROO service.
    const crooServiceId = seller.crooServiceId || process.env.CROO_DEMO_SERVICE_ID;

    if (!hasRequesterKey()) {
      return NextResponse.json({
        ok: false,
        error: "Payment not configured: Deskon Pay requester agent not registered.",
        stage: "config",
      });
    }

    if (!crooServiceId) {
      return NextResponse.json({
        ok: false,
        error: "No CROO settlement service configured.",
        stage: "config",
      });
    }

    const requirements = JSON.stringify({
      scope: convo.agreedScope || "",
      price: convo.agreedPrice || 0,
      via: "deskon-relay",
      seller: seller.slug,
    });

    const result = await createAndPayOrder(crooServiceId, requirements);

    if (result.ok) {
      // Attribute the settled deal to this seller in the ledger.
      await createOrder({
        sellerId: seller.id,
        crooOrderId: result.orderId ?? null,
        amount: convo.agreedPrice || 0,
        scope: convo.agreedScope ?? null,
        status: "completed",
        payTx: result.payTxHash ?? null,
        buyerRef: conversationId,
      });

      await updateConversationStatus(conversationId, "completed", {
        crooOrderId: result.orderId,
      });

      const handoff = seller.deliveryInstructions
        ? `\n\nNext step: ${seller.deliveryInstructions}`
        : "";
      await addMessage(conversationId, {
        role: "assistant",
        content: `Payment cleared — order ${result.orderId?.slice(
          0,
          8
        )} is locked in escrow on Base.${handoff}`,
        metadata: { type: "payment_confirmed", orderId: result.orderId },
      });

      // Tell the seller a deal just closed (never blocks the payment path).
      const notifyTo = seller.notifyEmail ?? seller.authEmail;
      if (notifyTo) {
        await sendDealClosedEmail({
          to: notifyTo,
          sellerName: seller.displayName,
          amount: convo.agreedPrice || 0,
          scope: convo.agreedScope ?? null,
          orderId: result.orderId ?? null,
          payTx: result.payTxHash ?? null,
        });
      }

      return NextResponse.json({
        ...result,
        deliveryInstructions: seller.deliveryInstructions,
      });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("Payment error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
