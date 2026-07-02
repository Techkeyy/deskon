import { Conversation, ChatMessage } from "@/types";
import { randomUUID } from "crypto";
import { dbClient } from "./db";

// Conversations are durable (Supabase) so a buyer refresh or a serverless
// cold start never loses a negotiation mid-deal.

function toConvo(r: any): Conversation {
  return {
    id: r.id,
    sellerId: r.seller_id,
    visitorType: r.visitor_type ?? "human",
    status: r.status,
    messages: (r.messages as ChatMessage[]) ?? [],
    crooNegotiationId: r.croo_negotiation_id ?? undefined,
    crooOrderId: r.croo_order_id ?? undefined,
    agreedPrice: r.agreed_price != null ? Number(r.agreed_price) : undefined,
    agreedScope: r.agreed_scope ?? undefined,
    createdAt: r.created_at,
  };
}

export async function createConversation(
  sellerId: string,
  visitorType: "human" | "agent" = "human"
): Promise<Conversation> {
  const { data, error } = await dbClient()
    .from("conversations")
    .insert({ seller_id: sellerId, visitor_type: visitorType })
    .select("*")
    .single();
  if (error) throw new Error(`createConversation: ${error.message}`);
  return toConvo(data);
}

export async function getConversation(
  id: string
): Promise<Conversation | null> {
  try {
    const { data } = await dbClient()
      .from("conversations")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    return data ? toConvo(data) : null;
  } catch {
    // malformed id (non-uuid) — treat as not found
    return null;
  }
}

/** Append a message and return the updated conversation. */
export async function addMessage(
  conversationId: string,
  message: Omit<ChatMessage, "id" | "timestamp">
): Promise<Conversation | null> {
  const convo = await getConversation(conversationId);
  if (!convo) return null;

  const msg: ChatMessage = {
    ...message,
    id: randomUUID(),
    timestamp: new Date().toISOString(),
  };
  const messages = [...convo.messages, msg];

  const { data, error } = await dbClient()
    .from("conversations")
    .update({ messages, updated_at: new Date().toISOString() })
    .eq("id", conversationId)
    .select("*")
    .single();
  if (error) throw new Error(`addMessage: ${error.message}`);
  return toConvo(data);
}

export async function updateConversationStatus(
  id: string,
  status: Conversation["status"],
  extras?: Partial<
    Pick<
      Conversation,
      "agreedPrice" | "agreedScope" | "crooNegotiationId" | "crooOrderId"
    >
  >
): Promise<void> {
  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (extras?.agreedPrice !== undefined) patch.agreed_price = extras.agreedPrice;
  if (extras?.agreedScope !== undefined) patch.agreed_scope = extras.agreedScope;
  if (extras?.crooNegotiationId !== undefined)
    patch.croo_negotiation_id = extras.crooNegotiationId;
  if (extras?.crooOrderId !== undefined)
    patch.croo_order_id = extras.crooOrderId;

  await dbClient().from("conversations").update(patch).eq("id", id);
}
