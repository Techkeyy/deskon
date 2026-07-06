import { NextRequest, NextResponse } from "next/server";
import { getSellerById, createOrder, getOrderVolumeSince } from "@/lib/db";
import {
  getConversation,
  updateConversationStatus,
  addMessage,
} from "@/lib/store";
import { createAndPayOrder } from "@/lib/payment";
import { hasRequesterKey } from "@/lib/croo-clients";
import { sendDealClosedEmail } from "@/lib/notify";
import { rateLimit, clientIp } from "@/lib/ratelimit";

// This endpoint spends from the Deskon Pay wallet, so it gets the full
// guard stack: rate limit, status gate, in-flight lock, daily spend cap.

// Payments currently being executed (per instance) — blocks double-clicks
// and concurrent retries for the same conversation.
const g = globalThis as unknown as { __deskonPaying?: Set<string> };
const inFlight = g.__deskonPaying ?? (g.__deskonPaying = new Set());

const DAILY_SPEND_CAP = Number(process.env.DESKON_DAILY_SPEND_CAP || 25);

export async function POST(req: NextRequest) {
  let lockKey: string | null = null;
  try {
    if (!rateLimit(`pay:${clientIp(req)}`, 5, 60_000)) {
      return NextResponse.json(
        { ok: false, error: "Too many payment attempts — slow down." },
        { status: 429 }
      );
    }

    const { conversationId } = await req.json();

    if (!conversationId) {
      return NextResponse.json({ error: "conversationId required" }, { status: 400 });
    }

    const convo = await getConversation(conversationId);
    if (!convo) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    // Status gate: only a conversation with a closer-proposed deal is payable,
    // and a completed one is never payable twice.
    if (convo.status === "completed") {
      return NextResponse.json({
        ok: false,
        error: "This deal is already paid.",
      });
    }
    if (convo.status !== "payment_pending") {
      return NextResponse.json({
        ok: false,
        error: "No agreed deal to pay yet — confirm the deal with the closer first.",
      });
    }

    // In-flight lock: one payment per conversation at a time.
    if (inFlight.has(conversationId)) {
      return NextResponse.json({
        ok: false,
        error: "Payment already in progress for this deal.",
      });
    }
    lockKey = conversationId;
    inFlight.add(conversationId);

    // Daily cap on total ledgered volume — bounds worst-case drain.
    const utcMidnight = new Date();
    utcMidnight.setUTCHours(0, 0, 0, 0);
    const spentToday = await getOrderVolumeSince(utcMidnight.toISOString());
    if (spentToday + (convo.agreedPrice || 0) > DAILY_SPEND_CAP) {
      return NextResponse.json({
        ok: false,
        error: "Deskon's daily settlement cap is reached — try again tomorrow.",
      });
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

    // Protocol errors are not buyer language — translate the known ones.
    if (!result.ok && result.error) {
      if (result.error.includes("PROVIDER_NOT_ACCEPTING_ORDERS")) {
        result.error =
          "The seller's agent is reconnecting — give it a minute and hit Pay again.";
      } else if (result.error.includes("insufficient")) {
        result.error = "The payment wallet is short on USDC.";
      }
    }

    if (result.ok) {
      // The ledger credits what actually settled on-chain (the CROO service
      // price), never the chat-negotiated figure — books must match the chain.
      const settled = result.settledAmount ?? convo.agreedPrice ?? 0;
      await createOrder({
        sellerId: seller.id,
        crooOrderId: result.orderId ?? null,
        amount: settled,
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
          amount: settled,
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
  } finally {
    if (lockKey) inFlight.delete(lockKey);
  }
}
