# Deskon

**Share one link. Your agent closes the deal.**

Deskon gives any seller an AI deal-closer behind a shareable link. A buyer — human *or* agent — opens the link, gets qualified, scoped, and negotiated by the closer, and settles payment in USDC escrow on Base mainnet through the [CROO Agent Protocol](https://croo.network) (CAP). No forms, no invoices, no chasing.

**Live:** https://deskon-delta.vercel.app · **CROO Agent Store:** [Deskon Relay](https://agent.croo.network/agents/517d961f-81b9-4735-b843-65f4515937a6) · Built for the CROO Agent Hackathon 2026 · MIT licensed.

---

## The 90-second story

1. **A seller sets up by talking.** The onboarding agent interviews them in chat — what they sell, price bounds, rules, where to send buyers after payment. Two minutes later they have a link: `deskon-delta.vercel.app/chat/their-name`.
2. **Buyers talk to the closer.** It qualifies the lead, scopes the work, proposes a price inside the seller's bounds, and holds the floor. When the buyer agrees, a Pay button appears.
3. **Money settles on-chain.** CAP flow: negotiate → lock (USDC escrow on Base) → deliver → clear. Gas is sponsored; the buyer only needs USDC.
4. **The loop closes.** The seller gets an email with the scope, amount, and BaseScan proof. The buyer gets the seller's delivery instructions. Earnings land in a wallet-gated dashboard.

## Agent-to-agent commerce (A2A)

Deskon closers are discoverable and transactable by other agents — no browser required:

| Endpoint | Purpose |
|---|---|
| `GET /.well-known/agent.json` | Deskon's agent card: protocol, settlement, directory |
| `GET /api/a2a/sellers` | Directory of closers |
| `GET /api/a2a/sellers/{slug}` | Seller card: services, price bounds, and the full negotiate/pay/resume contract |
| `POST /api/chat` | Negotiate (same endpoint the human UI uses) |
| `POST /api/payment/initiate` | Settle the agreed deal on-chain |

`scripts/agent-buyer.ts` is a complete autonomous buyer (DeepSeek-brained): it reads a seller card, negotiates the deal turn by turn, and pays — zero humans in the loop.

```bash
npm run agent-buyer <seller-slug> "I need one short TikTok ad edit, footage ready — agree a fair price and close it"
```

## On-chain proof

Every settlement below is a real Base-mainnet transaction. Highlights:

| What | Amount | Tx |
|---|---|---|
| Human-flow settlement (order `26489c6e`) | $200.00 | [`0x7a7d5175…`](https://basescan.org/tx/0x7a7d5175390d0600f5579862f1bf70afb9aed0495b29ffdbcb99c40e74ac409a) |
| **Fully autonomous A2A settlement** — two AIs, no humans (order `c10c1f53`) | $0.50 | [`0xf936c588…`](https://basescan.org/tx/0xf936c58877e34a533410fdd47e1294624bdcacc88b0ae8123936e529bdbd6ce3) |

The trade graph spans **6 distinct paying wallets and 8 distinct counterparty agents** across 18 settlements:

<details>
<summary>All 18 settlement transactions</summary>

Funding round (relay agent buying from 5 distinct provider agents):

- [`0x2b5c44db…`](https://basescan.org/tx/0x2b5c44db85e0f653bee6f2a443de7056e6c62dc01be637f6adb308d6c8f1b5a1)
- [`0x188a55d1…`](https://basescan.org/tx/0x188a55d1a3e3b5309f4d20beed369cf5bd425225f094202c27a306f3a213a331)
- [`0x6f6ef70e…`](https://basescan.org/tx/0x6f6ef70e9b9813f6954ec786756fe7e69d3c9f64ecb7dc849f97b66796a6c9d6)
- [`0x3d2ca153…`](https://basescan.org/tx/0x3d2ca153d1f06113c7889246fc0e961100cb52a01ec35d47bbb5e1b9c312c055)
- [`0x7ababb44…`](https://basescan.org/tx/0x7ababb44b560e502df92ad8bdaa7d8e97a9f6e326ec8d17d13e6afe03ab5658d)

Campaign matrix (4 distinct buyer agents × 3 distinct provider agents):

- [`0x7200632d…`](https://basescan.org/tx/0x7200632d8b0a4d7bf9d1e2ad3655c5aae5b4a0c554905fb4d923a35fe1f5a13e)
- [`0x50d3e9b4…`](https://basescan.org/tx/0x50d3e9b4707ab26dc6aa63d0b34ad336408ce66dcc1b14b1b33a84b91c7b2116)
- [`0x07c7569d…`](https://basescan.org/tx/0x07c7569d817c9f3fc955893fbeea82fc9c0d8f5f853fa1cd11128ac635b9b55e)
- [`0xd8b37e5c…`](https://basescan.org/tx/0xd8b37e5c0147d35d1cede91ad08d7d54a80d140fd5e934098d8d9f7b8b95c603)
- [`0x461d0f82…`](https://basescan.org/tx/0x461d0f82ea942f414d0c5e51c5f9b0f029e3c86cb0fdf547bf9025be06169c87)
- [`0x21e73598…`](https://basescan.org/tx/0x21e7359894454b0c8b8c0bf2f9f144e245cb1f1f80c270d49345304000136a4d)

Consolidation + live spot-check settlements:

- [`0x4a2b206a…`](https://basescan.org/tx/0x4a2b206a73f69bd37dfd0293626a8f02c8bf08d411bc4a1ccf021ee595b03956)
- [`0x0afb923f…`](https://basescan.org/tx/0x0afb923f663a65d78ba3aef806bf3dd83c04544bb74ad0ca2d7ba8ffb026d81f)
- [`0x1c2a59e7…`](https://basescan.org/tx/0x1c2a59e790ec8d2abf73c6d244977fd9225cdb04a56e57e4510520ab3a4d7a5a)
- [`0x00773100…`](https://basescan.org/tx/0x00773100e8a4b24a7af7f9788b594da58eab5b3013c0078c6a75ce964fc74966)
- [`0x69073f49…`](https://basescan.org/tx/0x69073f49a4a485fe8ede9cf9c1898f98f2f014a856d3896470f4702a26dd3e11)

Plus the two highlighted above.
</details>

## Architecture

```
buyer (human or agent)
   │  chat / A2A contract
   ▼
Next.js app (Vercel) ──── DeepSeek (closer + onboarding brains)
   │        │
   │        └── Supabase (sellers · orders · withdrawals · conversations)
   ▼
CROO Agent Protocol — Base mainnet
   negotiate → lock (USDC escrow) → deliver → clear   (gas sponsored)
   ▲
   └── provider worker (Render, always-on WebSocket)
       auto-accepts negotiations · delivers on payment
```

- **Identity & auth:** a seller's payout wallet *is* their identity. Dashboard login = wallet signature (viem `verifyMessage`, 5-min expiry) or a linked Google account (Supabase OAuth, server-verified token). Payout routes only to the seller's own wallet, signature-gated.
- **Buyer protection:** the buyer leaves an email at payment; the seller's dashboard and email show where to deliver, and the buyer gets a device-independent tracking link to confirm delivery from anywhere.
- **Money-path guards:** per-IP rate limits on chat/setup/pay, payment status-gate + in-flight lock (no double-pay), daily settlement/payout caps, and on-chain amount reconciliation (the ledger credits what actually settled, never the chat figure).
- **Conversations are durable** (Supabase), so refreshes and serverless cold starts never lose a negotiation.
- **The worker** (`scripts/provider-worker.ts`) keeps provider agents online: reconnect with exponential backoff, heartbeat, health endpoint for uptime pingers.

## Stack

Next.js 16 · React 19 · Supabase · DeepSeek (`deepseek-chat`) · `@croo-network/sdk` · viem · Resend · Vercel (app) + Render (worker)

## CAP integration — SDK methods used

From `@croo-network/sdk` (`AgentClient`):

| Method | Where / why |
|---|---|
| `connectWebSocket` + `EventType.{NegotiationCreated, OrderPaid, OrderCompleted}` | `scripts/provider-worker.ts` — keeps provider agents online; auto-accept + deliver |
| `negotiateOrder` | `src/lib/payment.ts`, `scripts/agent-buyer.ts` — open a deal against a service |
| `acceptNegotiation` | worker — accepting creates the on-chain order |
| `getNegotiation` / `listOrders` / `getOrder` | polling the negotiation to the created order |
| `payOrder` | settle USDC into escrow on Base (SDK handles approve) |
| `deliverOrder` | worker — deliver on `OrderPaid`, escrow clears |
| `isInsufficientBalance` | graceful funding errors on the pay path |

**Integration notes**

- Base mainnet (8453) only; USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`; gas sponsored by CROO's paymaster — buyers only need USDC.
- CROO reports order price/amount in 6-decimal USDC base units (`"100000"` = $0.10) — parse accordingly.
- One WebSocket per API key; avoid concurrent `payOrder` calls on the same key.
- CROO services are fixed-price: the closer negotiates *scope* within the seller's bounds and settles at the service price; the ledger credits what actually settled on-chain.
- Free-tier hosts can freeze the worker and silently kill the CAP socket while HTTP still answers (`PROVIDER_NOT_ACCEPTING_ORDERS`) — the worker refreshes its connection every 15 minutes and needs an uptime pinger (HEAD requests, so host wake-pages can't break the cron).

## Run it locally

```bash
git clone https://github.com/Techkeyy/deskon && cd deskon
npm install
# create .env.local with the vars below
npm run dev                  # app
npm run relay                # provider worker (separate terminal)
```

| Env var | What |
|---|---|
| `CROO_SDK_KEY` | provider agent key (receives orders, delivers) |
| `CROO_REQUESTER_SDK_KEY` | requester agent key (pays on behalf of buyers) |
| `CROO_API_URL` / `CROO_WS_URL` | `https://api.croo.network` / `wss://api.croo.network/ws` |
| `CROO_DEMO_SERVICE_ID` | CROO service deals settle through |
| `DEEPSEK_API_KEY` | DeepSeek API key |
| `SUPABASE_URL` / `SUPABASE_SECRET_KEY` | server-side database access |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | browser-side (Google OAuth only) |
| `RESEND_API_KEY` | seller notifications (optional — no-ops without it) |
| `TREASURY_PRIVATE_KEY` | payout treasury key (optional — withdrawals queue as requests without it) |
| `DESKON_DAILY_SPEND_CAP` / `DESKON_DAILY_PAYOUT_CAP` | daily settlement / payout caps in USD (default 25 / 50) |

Database schema: run `supabase/schema.sql` in the Supabase SQL editor.

## Honest limitations

- **Buyer custody:** buyers pay from their own wallet — USDC to Deskon's deposit address on Base, verified on-chain (transfer logs, amount, anti-replay) before the deal settles. A sponsored path (Deskon's requester agent fronts the payment) is kept as a labeled demo fallback for judges without Base USDC and for the autonomous agent-buyer.
- **Custodial escrow window:** after settlement, Deskon holds funds until the buyer confirms delivery (or 7-day auto-release), then pays out on-chain from a treasury wallet. The payout code is built and tested; when the treasury is unfunded, withdrawals record as requests instead. Non-custodial per-seller agents (each seller controlling their own CROO agent) are the roadmap — blocked today by the lack of programmatic agent registration on CROO.
- **Email is sandboxed:** without a verified domain, Resend only delivers to the account owner. One DNS record fixes it.
- **Fixed-price CROO services:** CAP prices are set per service definition; the closer negotiates scope within the seller's bounds and settles at the service price.
- **Render free tier idles:** the worker needs an uptime pinger (any 10-min cron on `/`) or a paid background worker.

---

Built by [Techkeyy](https://github.com/Techkeyy). The chat is the interface; the chain is the receipt.
