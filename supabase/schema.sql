-- Deskon — Path B ledger schema
-- Run this in the Supabase SQL editor (Dashboard → SQL → New query → Run).
-- The wallet is the seller's identity: payout destination AND dashboard login.

-- ── sellers ──────────────────────────────────────────────
create table if not exists sellers (
  id              uuid primary key default gen_random_uuid(),
  slug            text unique not null,
  display_name    text not null,
  persona_prompt  text not null default '',
  payout_wallet   text,                 -- lowercased 0x… ; null until the seller connects
  auth_email      text,                 -- lowercased Google email ; convenience dashboard login (payout still = wallet)
  services        jsonb not null default '[]',
  croo_service_id text,                 -- CROO service deals settle through (Path B: Deskon-managed)
  created_at      timestamptz not null default now()
);
create index if not exists sellers_wallet_idx on sellers (lower(payout_wallet));
create index if not exists sellers_email_idx on sellers (lower(auth_email));

-- If the table already exists from an earlier run, add the column:
alter table sellers add column if not exists auth_email text;

-- ── orders ───────────────────────────────────────────────
-- every closed deal, attributed to the seller who earned it
create table if not exists orders (
  id            uuid primary key default gen_random_uuid(),
  seller_id     uuid not null references sellers(id) on delete cascade,
  croo_order_id text,
  amount        numeric not null,
  currency      text not null default 'USDC',
  scope         text,
  status        text not null default 'pending',  -- pending | paid | completed | withdrawn
  pay_tx        text,
  buyer_ref     text,
  created_at    timestamptz not null default now()
);
create index if not exists orders_seller_idx on orders (seller_id);

-- ── withdrawals ──────────────────────────────────────────
-- seller payout requests / executions against their balance
create table if not exists withdrawals (
  id          uuid primary key default gen_random_uuid(),
  seller_id   uuid not null references sellers(id) on delete cascade,
  amount      numeric not null,
  to_wallet   text not null,
  status      text not null default 'requested',  -- requested | sent | failed
  tx          text,
  created_at  timestamptz not null default now()
);
create index if not exists withdrawals_seller_idx on withdrawals (seller_id);

-- Server-side access only (service_role key in API routes). RLS stays off;
-- never expose the service_role key to the client.
