export interface SellerProfile {
  id: string;
  slug: string;
  displayName: string;
  personaPrompt: string;
  /** Base wallet the seller connected — payout destination AND dashboard identity. */
  payoutWallet: string | null;
  /** Google email linked at setup — convenience dashboard login. Payout still routes to the wallet. */
  authEmail: string | null;
  /** Where deal-closed notifications go. Defaults to authEmail. */
  notifyEmail: string | null;
  /** Shown to the buyer right after payment ("send your footage to …"). */
  deliveryInstructions: string | null;
  services: SellerService[];
  /** CROO service deals settle through. Path B: the Deskon-managed shared service. */
  crooServiceId: string | null;
  createdAt: string;
}

export interface SellerService {
  name: string;
  description: string;
  minPrice: number;
  maxPrice: number;
  currency: string;
  examples: string[];
}

export interface Order {
  id: string;
  sellerId: string;
  crooOrderId: string | null;
  amount: number;
  currency: string;
  scope: string | null;
  status: "pending" | "paid" | "completed" | "withdrawn";
  payTx: string | null;
  /** Buyer's on-chain USDC deposit tx (buyer-custody path; null = sponsored demo). */
  depositTx: string | null;
  buyerRef: string | null;
  /** Buyer's email — where the seller delivers, and the buyer's tracking receipt. */
  buyerContact: string | null;
  createdAt: string;
}

export interface Withdrawal {
  id: string;
  sellerId: string;
  amount: number;
  toWallet: string;
  status: "requested" | "sent" | "failed";
  tx: string | null;
  createdAt: string;
}

export interface SellerLedger {
  /** Sum of completed (settled) orders. */
  collected: number;
  /** Orders in flight — paid but not yet completed, or pending. */
  pending: number;
  /** Collected minus what's already been withdrawn/requested. */
  available: number;
  orders: Order[];
  withdrawals: Withdrawal[];
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
