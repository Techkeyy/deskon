export interface SellerProfile {
  id: string;
  walletAddress: string;
  crooAgentId: string;
  crooApiKey: string;
  displayName: string;
  slug: string;
  services: SellerService[];
  personaPrompt: string;
  createdAt: string;
}

export interface SellerService {
  name: string;
  description: string;
  minPrice: number;
  maxPrice: number;
  currency: string;
  examples: string[];
  /** The CROO service ID this maps to (fixed price on-chain). */
  crooServiceId?: string;
}

export interface Conversation {
  id: string;
  sellerId: string;
  visitorType: "human" | "agent";
  status: "active" | "negotiating" | "payment_pending" | "completed" | "abandoned";
  messages: ChatMessage[];
  crooNegotiationId?: string;
  crooOrderId?: string;
  agreedPrice?: number;
  agreedScope?: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  metadata?: {
    type?: "payment_prompt" | "payment_confirmed" | "deal_summary";
    amount?: number;
    orderId?: string;
  };
}
