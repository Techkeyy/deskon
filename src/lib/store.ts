import { Conversation, ChatMessage } from "@/types";
import { randomUUID } from "crypto";

// Conversations are live chat sessions — kept in-memory on purpose.
// They're short-lived and fine to lose on restart; the moment a deal is paid,
// the order is persisted to Supabase (see lib/db.ts). Sellers, orders, and
// withdrawals all live in the database.
interface ConvoStore {
  conversations: Map<string, Conversation>;
}

const g = globalThis as unknown as { __deskonConvos?: ConvoStore };
const store: ConvoStore =
  g.__deskonConvos ?? (g.__deskonConvos = { conversations: new Map() });

const { conversations } = store;

export function createConversation(
  sellerId: string,
  visitorType: "human" | "agent" = "human"
): Conversation {
  const convo: Conversation = {
    id: randomUUID(),
    sellerId,
    visitorType,
    status: "active",
    messages: [],
    createdAt: new Date().toISOString(),
  };
  conversations.set(convo.id, convo);
  return convo;
}

export function getConversation(id: string): Conversation | undefined {
  return conversations.get(id);
}

export function addMessage(
  conversationId: string,
  message: Omit<ChatMessage, "id" | "timestamp">
): ChatMessage | undefined {
  const convo = conversations.get(conversationId);
  if (!convo) return undefined;
  const msg: ChatMessage = {
    ...message,
    id: randomUUID(),
    timestamp: new Date().toISOString(),
  };
  convo.messages.push(msg);
  return msg;
}

export function updateConversationStatus(
  id: string,
  status: Conversation["status"],
  extras?: Partial<Conversation>
): void {
  const convo = conversations.get(id);
  if (!convo) return;
  convo.status = status;
  if (extras) Object.assign(convo, extras);
}
