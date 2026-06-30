import { NextRequest, NextResponse } from "next/server";
import { generateResponse } from "@/lib/ai";
import { getSellerBySlug, getConversation, createConversation, addMessage, updateConversationStatus } from "@/lib/store";
import { seedDemoSeller } from "@/lib/store";

export async function POST(req: NextRequest) {
  try {
    const { slug, conversationId, message } = await req.json();

    if (!slug || !message) {
      return NextResponse.json({ error: "slug and message are required" }, { status: 400 });
    }

    // Seed demo seller on every request (idempotent)
    seedDemoSeller();

    const seller = getSellerBySlug(slug);
    if (!seller) {
      return NextResponse.json({ error: "Seller not found" }, { status: 404 });
    }

    let convo = conversationId ? getConversation(conversationId) : null;
    if (!convo) {
      convo = createConversation(seller.id, "human");
    }

    addMessage(convo.id, { role: "user", content: message });

    const aiResponse = await generateResponse(seller, convo.messages, convo.status);

    if (aiResponse.functionCall?.name === "initiate_payment") {
      updateConversationStatus(convo.id, "payment_pending", {
        agreedPrice: aiResponse.functionCall.args.amount,
        agreedScope: aiResponse.functionCall.args.scope_summary,
      });

      addMessage(convo.id, {
        role: "assistant",
        content: aiResponse.message,
        metadata: {
          type: "payment_prompt",
          amount: aiResponse.functionCall.args.amount,
        },
      });
    } else if (aiResponse.functionCall?.name === "propose_deal") {
      updateConversationStatus(convo.id, "negotiating");
      addMessage(convo.id, {
        role: "assistant",
        content: aiResponse.message,
        metadata: { type: "deal_summary", amount: aiResponse.functionCall.args.price },
      });
    } else {
      addMessage(convo.id, { role: "assistant", content: aiResponse.message });
    }

    return NextResponse.json({
      conversationId: convo.id,
      message: aiResponse.message,
      functionCall: aiResponse.functionCall || null,
      status: convo.status,
    });
  } catch (err: any) {
    console.error("Chat error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
