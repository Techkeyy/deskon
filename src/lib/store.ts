import { SellerProfile, Conversation, ChatMessage } from "@/types";
import { randomUUID } from "crypto";

// In-memory store for MVP — replace with Supabase later.
// Stashed on globalThis so it survives hot-reloads and is shared as a true
// singleton across all route handlers in Next.js dev/serverless.
interface DeskonStore {
  sellers: Map<string, SellerProfile>;
  conversations: Map<string, Conversation>;
  slugIndex: Map<string, string>;
}

const g = globalThis as unknown as { __deskonStore?: DeskonStore };

const store: DeskonStore =
  g.__deskonStore ??
  (g.__deskonStore = {
    sellers: new Map(),
    conversations: new Map(),
    slugIndex: new Map(),
  });

const { sellers, conversations, slugIndex } = store;

export function createSeller(data: Omit<SellerProfile, "id" | "createdAt">): SellerProfile {
  const seller: SellerProfile = {
    ...data,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  sellers.set(seller.id, seller);
  slugIndex.set(seller.slug, seller.id);
  return seller;
}

export function generateSlug(displayName: string): string {
  const base = displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30) || "relay";
  let slug = base;
  let n = 1;
  while (slugIndex.has(slug)) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

export function getSellerBySlug(slug: string): SellerProfile | undefined {
  const id = slugIndex.get(slug);
  if (!id) return undefined;
  return sellers.get(id);
}

export function getSellerById(id: string): SellerProfile | undefined {
  return sellers.get(id);
}

export function getAllSellers(): SellerProfile[] {
  return Array.from(sellers.values());
}

export function updateSeller(id: string, updates: Partial<SellerProfile>): SellerProfile | undefined {
  const seller = sellers.get(id);
  if (!seller) return undefined;
  const updated = { ...seller, ...updates };
  sellers.set(id, updated);
  if (updates.slug && updates.slug !== seller.slug) {
    slugIndex.delete(seller.slug);
    slugIndex.set(updates.slug, id);
  }
  return updated;
}

export function createConversation(sellerId: string, visitorType: "human" | "agent" = "human"): Conversation {
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

export function addMessage(conversationId: string, message: Omit<ChatMessage, "id" | "timestamp">): ChatMessage | undefined {
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

export function updateConversationStatus(id: string, status: Conversation["status"], extras?: Partial<Conversation>): void {
  const convo = conversations.get(id);
  if (!convo) return;
  convo.status = status;
  if (extras) Object.assign(convo, extras);
}

// Seed a demo seller for testing
export function seedDemoSeller(): SellerProfile {
  const existing = getSellerBySlug("demo");
  if (existing) {
    const envServiceId = process.env.CROO_DEMO_SERVICE_ID || "";
    if (!existing.services[0]?.crooServiceId && envServiceId) {
      existing.services[0].crooServiceId = envServiceId;
    }
    return existing;
  }

  return createSeller({
    walletAddress: "0x0000000000000000000000000000000000000000",
    crooAgentId: "517d961f-81b9-4735-b843-65f4515937a6",
    crooApiKey: process.env.CROO_SDK_KEY || "",
    displayName: "Demo Designer",
    slug: "demo",
    services: [
      {
        name: "Logo Design",
        description: "Custom logo design for brands and businesses",
        minPrice: 50,
        maxPrice: 500,
        currency: "USDC",
        examples: ["Minimalist logo", "Brand kit", "Icon design"],
        crooServiceId: process.env.CROO_DEMO_SERVICE_ID || "",
      },
      {
        name: "Brand Identity",
        description: "Full brand identity package including logo, colors, typography",
        minPrice: 200,
        maxPrice: 2000,
        currency: "USDC",
        examples: ["Startup branding", "Rebrand", "Visual identity system"],
      },
    ],
    personaPrompt: `You are the AI assistant for Demo Designer, a professional graphic designer specializing in logo and brand identity design. You are friendly, professional, and direct. You help potential clients understand the services offered, scope their project, agree on pricing, and close the deal. Always stay within the pricing boundaries set by the seller.`,
  });
}
