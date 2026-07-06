import { NextRequest, NextResponse } from "next/server";
import { generateResponse } from "@/lib/ai";
import { getSellerBySlug } from "@/lib/db";
import {
  getConversation,
  createConversation,
  addMessage,
  updateConversationStatus,
} from "@/lib/store";
import { rateLimit, clientIp } from "@/lib/ratelimit";

/** Resume an existing conversation (buyer refreshed the page). */
export async function GET(req: NextRequest) {
  try {
    const conversationId = req.nextUrl.searchParams.get("conversationId");
    if (!conversationId) {
      return NextResponse.json(
        { error: "conversationId required" },
        { status: 400 }
      );
    }
    const convo = await getConversation(conversationId);
    if (!convo) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({
      conversationId: convo.id,
      status: convo.status,
      messages: convo.messages.map((m) => ({
        role: m.role,
        content: m.content,
        metadata: m.metadata ?? undefined,
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // Every message is a paid DeepSeek call — keep bots off the faucet.
    if (!rateLimit(`chat:${clientIp(req)}`, 20, 60_000)) {
      return NextResponse.json(
        { error: "Too many messages — slow down for a minute." },
        { status: 429 }
      );
    }

    const { slug, conversationId, message } = await req.json();

    if (!slug || !message) {
      return NextResponse.json(
        { error: "slug and message are required" },
        { status: 400 }
      );
    }

    const seller = await getSellerBySlug(slug);
    if (!seller) {
      return NextResponse.json({ error: "Seller not found" }, { status: 404 });
    }

    let convo = conversationId ? await getConversation(conversationId) : null;
    if (!convo) convo = await createConversation(seller.id, "human");

    convo =
      (await addMessage(convo.id, { role: "user", content: message })) ?? convo;

    const aiResponse = await generateResponse(
      seller,
      convo.messages,
      convo.status
    );

    let status = convo.status;
    if (aiResponse.functionCall?.name === "initiate_payment") {
      status = "payment_pending";
      await updateConversationStatus(convo.id, status, {
        agreedPrice: aiResponse.functionCall.args.amount,
        agreedScope: aiResponse.functionCall.args.scope_summary,
      });
      await addMessage(convo.id, {
        role: "assistant",
        content: aiResponse.message,
        metadata: {
          type: "payment_prompt",
          amount: aiResponse.functionCall.args.amount,
        },
      });
    } else if (aiResponse.functionCall?.name === "propose_deal") {
      status = "negotiating";
      await updateConversationStatus(convo.id, status);
      await addMessage(convo.id, {
        role: "assistant",
        content: aiResponse.message,
        metadata: {
          type: "deal_summary",
          amount: aiResponse.functionCall.args.price,
        },
      });
    } else {
      await addMessage(convo.id, {
        role: "assistant",
        content: aiResponse.message,
      });
    }

    return NextResponse.json({
      conversationId: convo.id,
      message: aiResponse.message,
      functionCall: aiResponse.functionCall || null,
      status,
    });
  } catch (err: any) {
    console.error("Chat error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
