import { NextRequest, NextResponse } from "next/server";
import { getOrderByBuyerRef, releaseOrder } from "@/lib/db";
import { getConversation, addMessage } from "@/lib/store";
import { rateLimit, clientIp } from "@/lib/ratelimit";

/**
 * Buyer confirms delivery — releases the held funds to the seller.
 * Authorization = knowing the conversationId, which only the buyer's
 * browser/agent holds. Paid orders auto-release after 7 days regardless,
 * so a silent buyer can't starve the seller.
 */
export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(`confirm:${clientIp(req)}`, 10, 60_000)) {
      return NextResponse.json(
        { ok: false, error: "Too many attempts — slow down." },
        { status: 429 }
      );
    }

    const { conversationId } = await req.json();
    if (!conversationId) {
      return NextResponse.json(
        { ok: false, error: "conversationId required" },
        { status: 400 }
      );
    }

    const convo = await getConversation(conversationId);
    if (!convo) {
      return NextResponse.json(
        { ok: false, error: "Conversation not found" },
        { status: 404 }
      );
    }

    const order = await getOrderByBuyerRef(conversationId);
    if (!order) {
      return NextResponse.json(
        { ok: false, error: "No paid order in this conversation." },
        { status: 404 }
      );
    }
    if (order.status === "completed" || order.status === "withdrawn") {
      return NextResponse.json({ ok: true, alreadyReleased: true });
    }

    const released = await releaseOrder(order.id);
    if (!released) {
      return NextResponse.json(
        { ok: false, error: "Order is not in a releasable state." },
        { status: 409 }
      );
    }

    await addMessage(conversationId, {
      role: "assistant",
      content:
        "Delivery confirmed — funds released to the seller. Pleasure doing business.",
      metadata: { type: "payment_confirmed", orderId: released.crooOrderId ?? undefined },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Confirm error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
