import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  SellerProfile,
  SellerService,
  Order,
  Withdrawal,
  SellerLedger,
} from "@/types";

let client: SupabaseClient | null = null;

function db(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_SECRET_KEY not set");
  }
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

/** Shared server-side client for other data modules (store.ts). */
export function dbClient(): SupabaseClient {
  return db();
}

// ── row → domain mappers ────────────────────────────────

function toSeller(r: any): SellerProfile {
  return {
    id: r.id,
    slug: r.slug,
    displayName: r.display_name,
    personaPrompt: r.persona_prompt ?? "",
    payoutWallet: r.payout_wallet ?? null,
    authEmail: r.auth_email ?? null,
    services: (r.services as SellerService[]) ?? [],
    crooServiceId: r.croo_service_id ?? null,
    createdAt: r.created_at,
  };
}

function toOrder(r: any): Order {
  return {
    id: r.id,
    sellerId: r.seller_id,
    crooOrderId: r.croo_order_id ?? null,
    amount: Number(r.amount),
    currency: r.currency,
    scope: r.scope ?? null,
    status: r.status,
    payTx: r.pay_tx ?? null,
    buyerRef: r.buyer_ref ?? null,
    createdAt: r.created_at,
  };
}

function toWithdrawal(r: any): Withdrawal {
  return {
    id: r.id,
    sellerId: r.seller_id,
    amount: Number(r.amount),
    toWallet: r.to_wallet,
    status: r.status,
    tx: r.tx ?? null,
    createdAt: r.created_at,
  };
}

// ── sellers ─────────────────────────────────────────────

export async function getSellerBySlug(
  slug: string
): Promise<SellerProfile | null> {
  const { data } = await db()
    .from("sellers")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  return data ? toSeller(data) : null;
}

export async function getSellerById(
  id: string
): Promise<SellerProfile | null> {
  const { data } = await db()
    .from("sellers")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data ? toSeller(data) : null;
}

export async function getSellerByWallet(
  wallet: string
): Promise<SellerProfile | null> {
  const { data } = await db()
    .from("sellers")
    .select("*")
    .eq("payout_wallet", wallet.toLowerCase())
    .maybeSingle();
  return data ? toSeller(data) : null;
}

export async function listSellers(limit = 50): Promise<SellerProfile[]> {
  const { data } = await db()
    .from("sellers")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map(toSeller);
}

export async function getSellerByEmail(
  email: string
): Promise<SellerProfile | null> {
  // One Google account may map to more than one Relay — take the most recent.
  const { data } = await db()
    .from("sellers")
    .select("*")
    .eq("auth_email", email.toLowerCase())
    .order("created_at", { ascending: false })
    .limit(1);
  return data && data[0] ? toSeller(data[0]) : null;
}

export async function generateSlug(displayName: string): Promise<string> {
  const base =
    displayName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 30) || "relay";
  let slug = base;
  let n = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await getSellerBySlug(slug)) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

export async function createSeller(input: {
  slug: string;
  displayName: string;
  personaPrompt?: string;
  payoutWallet?: string | null;
  authEmail?: string | null;
  services?: SellerService[];
  crooServiceId?: string | null;
}): Promise<SellerProfile> {
  const { data, error } = await db()
    .from("sellers")
    .insert({
      slug: input.slug,
      display_name: input.displayName,
      persona_prompt: input.personaPrompt ?? "",
      payout_wallet: input.payoutWallet?.toLowerCase() ?? null,
      auth_email: input.authEmail?.toLowerCase() ?? null,
      services: input.services ?? [],
      croo_service_id:
        input.crooServiceId ?? process.env.CROO_DEMO_SERVICE_ID ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(`createSeller: ${error.message}`);
  return toSeller(data);
}

export async function updateSeller(
  id: string,
  updates: Partial<{
    displayName: string;
    personaPrompt: string;
    payoutWallet: string | null;
    authEmail: string | null;
    services: SellerService[];
    crooServiceId: string | null;
  }>
): Promise<SellerProfile | null> {
  const patch: Record<string, unknown> = {};
  if (updates.displayName !== undefined) patch.display_name = updates.displayName;
  if (updates.personaPrompt !== undefined)
    patch.persona_prompt = updates.personaPrompt;
  if (updates.payoutWallet !== undefined)
    patch.payout_wallet = updates.payoutWallet?.toLowerCase() ?? null;
  if (updates.authEmail !== undefined)
    patch.auth_email = updates.authEmail?.toLowerCase() ?? null;
  if (updates.services !== undefined) patch.services = updates.services;
  if (updates.crooServiceId !== undefined)
    patch.croo_service_id = updates.crooServiceId;

  const { data } = await db()
    .from("sellers")
    .update(patch)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  return data ? toSeller(data) : null;
}

// ── orders (the ledger) ─────────────────────────────────

export async function createOrder(input: {
  sellerId: string;
  crooOrderId?: string | null;
  amount: number;
  currency?: string;
  scope?: string | null;
  status?: Order["status"];
  payTx?: string | null;
  buyerRef?: string | null;
}): Promise<Order> {
  const { data, error } = await db()
    .from("orders")
    .insert({
      seller_id: input.sellerId,
      croo_order_id: input.crooOrderId ?? null,
      amount: input.amount,
      currency: input.currency ?? "USDC",
      scope: input.scope ?? null,
      status: input.status ?? "completed",
      pay_tx: input.payTx ?? null,
      buyer_ref: input.buyerRef ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(`createOrder: ${error.message}`);
  return toOrder(data);
}

export async function getOrdersBySeller(sellerId: string): Promise<Order[]> {
  const { data } = await db()
    .from("orders")
    .select("*")
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false });
  return (data ?? []).map(toOrder);
}

// ── withdrawals ─────────────────────────────────────────

export async function createWithdrawal(input: {
  sellerId: string;
  amount: number;
  toWallet: string;
  status?: Withdrawal["status"];
  tx?: string | null;
}): Promise<Withdrawal> {
  const { data, error } = await db()
    .from("withdrawals")
    .insert({
      seller_id: input.sellerId,
      amount: input.amount,
      to_wallet: input.toWallet.toLowerCase(),
      status: input.status ?? "requested",
      tx: input.tx ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(`createWithdrawal: ${error.message}`);
  return toWithdrawal(data);
}

export async function getWithdrawalsBySeller(
  sellerId: string
): Promise<Withdrawal[]> {
  const { data } = await db()
    .from("withdrawals")
    .select("*")
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false });
  return (data ?? []).map(toWithdrawal);
}

// ── ledger rollup ───────────────────────────────────────

export async function getSellerLedger(
  sellerId: string
): Promise<SellerLedger> {
  const [orders, withdrawals] = await Promise.all([
    getOrdersBySeller(sellerId),
    getWithdrawalsBySeller(sellerId),
  ]);

  const collected = orders
    .filter((o) => o.status === "completed" || o.status === "withdrawn")
    .reduce((sum, o) => sum + o.amount, 0);

  const pending = orders
    .filter((o) => o.status === "pending" || o.status === "paid")
    .reduce((sum, o) => sum + o.amount, 0);

  const withdrawn = withdrawals
    .filter((w) => w.status !== "failed")
    .reduce((sum, w) => sum + w.amount, 0);

  return {
    collected,
    pending,
    available: Math.max(0, collected - withdrawn),
    orders,
    withdrawals,
  };
}
