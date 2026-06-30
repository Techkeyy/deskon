# DESKON (Relay) — MVP Build Plan
## CROO Agent Hackathon Submission

**One-liner:** Share a link. Your AI closes the deal. Money hits your wallet.

**Hackathon deadline:** 2026-07-12
**Tracks:** Open – Any A2A Agents (primary) | Creator & Content Ops (secondary)

---

## UI Philosophy: ZERO DASHBOARDS

The #1 idea to reduce UI complexity: **the chat IS the entire interface.**

### For Sellers (service providers)
- No signup form. No settings page. No dashboard.
- Seller visits deskon, connects wallet, and **talks to the AI** to set up their Relay.
- The AI asks: "What do you do? What do you charge? Any rules I should follow?"
- That conversation becomes the agent's configuration.
- Seller gets a shareable link. Done.
- To check earnings or update config → they chat with their Relay agent.

### For Buyers (clients/leads)
- Click a link → land in a chat. That's it.
- No wallet needed upfront. No signup. No app to install.
- The AI qualifies them, scopes the work, agrees on price.
- Payment happens inside the chat via a simple "Pay $X" button (CROO handles the crypto settlement underneath).
- Buyer sees: chat + one payment button. Nothing else.

### For Other Agents (A2A)
- Call the Relay's CAP service endpoint.
- Negotiate via the standard CAP order lifecycle.
- Fully automated: discover → negotiate → pay → receive confirmation.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   DESKON                         │
│                                                  │
│  ┌──────────┐   ┌──────────────┐   ┌──────────┐ │
│  │  Next.js  │   │  Conversation │   │  CROO    │ │
│  │  Frontend │◄─►│  Engine (AI)  │◄─►│  SDK     │ │
│  │  (Chat UI)│   │  (OpenAI/etc) │   │  (CAP)   │ │
│  └──────────┘   └──────────────┘   └──────────┘ │
│       │                │                  │      │
│       │          ┌─────┴─────┐           │      │
│       │          │  Seller   │           │      │
│       │          │  Profiles │           │      │
│       │          │  (DB)     │           │      │
│       │          └───────────┘           │      │
│       │                                   │      │
│  [shareable link]              [Base USDC] │      │
└─────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Frontend | Next.js 14 + Tailwind | Fast to ship, SSR for link previews, chat UI is one component |
| Chat UI | Custom minimal component | Just a message list + input. No library needed. |
| AI Engine | OpenAI GPT-4o (or Claude) | Function calling for structured actions (set price, trigger payment) |
| Backend | Next.js API routes | No separate server needed |
| Database | Supabase (Postgres) | Seller profiles, conversation logs, service configs |
| Payments | CROO SDK (`@croo-network/sdk`) | CAP protocol, escrow, settlement on Base |
| Auth | Wallet connect (wagmi/viem) | Sellers auth with wallet. Buyers don't need auth. |
| Hosting | Vercel | Free tier, instant deploys |

---

## Data Model

### SellerProfile
```
id: uuid
wallet_address: string          -- Base wallet (owner)
croo_agent_id: string           -- CROO Agent DID
croo_api_key: string (encrypted)-- SDK auth
display_name: string
slug: string (unique)           -- deskon.app/{slug} = their Relay link
services: jsonb                 -- what they offer, pricing rules, boundaries
persona_prompt: text            -- AI personality/instructions derived from onboarding chat
created_at: timestamp
```

### Conversation
```
id: uuid
seller_id: uuid (FK)
visitor_type: enum (human | agent)
status: enum (active | negotiating | payment_pending | completed | abandoned)
messages: jsonb[]
croo_negotiation_id: string?
croo_order_id: string?
agreed_price: decimal?
agreed_scope: text?
created_at: timestamp
updated_at: timestamp
```

---

## AI Conversation Engine — How It Works

The AI operates in phases within each conversation:

### Phase 1: Qualify
- Understand what the buyer wants
- Check if it matches what the seller offers
- If no match → politely redirect or decline

### Phase 2: Scope
- Clarify deliverables, timeline, specifics
- Reference seller's pricing rules
- Propose a price (within seller-defined boundaries)

### Phase 3: Close
- Summarize the agreement: "Here's what we agreed on: X for $Y, delivered by Z"
- Trigger the payment flow
- System function call → `initiate_payment(amount, scope_summary)`
- Chat UI renders a "Pay $Y" button
- Buyer clicks → CROO SDK handles: negotiate → escrow → lock

### Phase 4: Confirm
- Payment confirmed → notify seller (email/webhook)
- Provide buyer with confirmation + next steps
- Conversation archived with full context

### AI Function Calls (OpenAI function calling)
```
- check_availability(service_type) → bool
- get_pricing(service_type, scope) → { price, currency, notes }
- initiate_payment(amount, scope_summary, buyer_info) → { payment_link, order_id }
- notify_seller(conversation_summary, agreed_terms) → void
- reject_inquiry(reason) → void
```

---

## CAP Integration Detail

### Provider Side (Seller's Relay Agent)
```typescript
// On CROO, the Relay is registered as a Provider agent
// Service: "Relay Deal Closer"
// Price: Variable (set per-deal during conversation)
// SLA: Configurable per seller

const client = new AgentClient(config, sellerApiKey);

// Listen for incoming orders (A2A path)
client.ws.on('negotiation_created', async (event) => {
  // Another agent wants to hire through this Relay
  // Parse the request, check seller availability
  // Accept or reject the negotiation
  await client.acceptNegotiation(event.negotiationId);
});

client.ws.on('order_paid', async (event) => {
  // Payment received, deliver confirmation
  await client.deliverOrder(event.orderId, {
    type: DeliverableType.Text,
    content: JSON.stringify({
      status: 'deal_closed',
      scope: agreedScope,
      seller_contact: sellerContact,
      next_steps: 'Seller will reach out within 24h'
    })
  });
});
```

### Requester Side (Buyer paying through chat)
```typescript
// When buyer clicks "Pay $X" in chat:
// 1. Backend creates a CROO agent for the buyer (or uses existing)
// 2. Initiates negotiation with seller's Relay service
// 3. Auto-accepts, triggers payment

const negotiation = await client.negotiateOrder({
  serviceId: sellerServiceId,
  requirements: { scope, price, buyerInfo }
});

// Provider (Relay) auto-accepts → order created
// Buyer pays → escrow locks
await client.payOrder(orderId);

// Provider delivers (confirmation) → settlement → done
```

---

## Build Schedule (12 Days)

### Phase 1: Foundation (Day 1-2) — CAP Integration
- [ ] Register agent on CROO Agent Store
- [ ] Get SDK working end-to-end (negotiate → pay → deliver → settle)
- [ ] Test with example provider/requester scripts
- [ ] Confirm USDC flow on Base mainnet
- **Deliverable:** Working CAP payment loop, no UI

### Phase 2: AI Engine (Day 3-5) — Conversation Core
- [ ] Design system prompt + function calling schema
- [ ] Build conversation state machine (qualify → scope → close → confirm)
- [ ] Implement AI function calls (pricing, payment trigger, notifications)
- [ ] Seller onboarding conversation flow (AI interviews seller to build config)
- [ ] Test 10+ conversation scenarios end-to-end
- **Deliverable:** AI that can close a deal via CLI/API

### Phase 3: Frontend (Day 6-8) — Chat UI + Links
- [ ] Next.js project setup with Tailwind
- [ ] Chat component (message list, input, typing indicator)
- [ ] Payment button component (renders when AI triggers payment)
- [ ] Shareable link page: `deskon.app/{slug}` → opens chat
- [ ] Seller onboarding page: connect wallet → chat with AI → get link
- [ ] Minimal seller view: "Your link is X. You've earned $Y."
- **Deliverable:** Working web app, shareable links, payment in chat

### Phase 4: A2A + Polish (Day 9-10)
- [ ] A2A endpoint: other agents can discover and call Relay via CAP
- [ ] Register at least 3 test agents that interact with Relay
- [ ] Link preview meta tags (OG image, title, description)
- [ ] Mobile responsive chat
- [ ] Error states, loading states, edge cases
- **Deliverable:** A2A working, app polished

### Phase 5: Ship (Day 11-12)
- [ ] List on CROO Agent Store
- [ ] Record 5-min demo video
- [ ] Write README (setup instructions, SDK methods used, architecture)
- [ ] Open-source repo (MIT license)
- [ ] File BUIDL on DoraHacks
- [ ] Final testing: golden path, edge cases, anti-sybil checks
- **Deliverable:** Submitted hackathon entry

---

## UI Simplification Strategies

### 1. Conversation-as-Configuration
Instead of forms/dashboards, the seller configures everything by chatting:
```
AI: "What do you do?"
Seller: "I'm a logo designer"
AI: "What do you typically charge?"
Seller: "Starts at $200 for a basic logo, $500 for a full brand kit"
AI: "Any rules? Like minimum budget or things you won't do?"
Seller: "No crypto projects, minimum $150, max 2 weeks turnaround"
AI: "Got it. Here's your Relay link: deskon.app/jess-designs"
```
Zero forms. Zero settings pages. The AI extracts structured data from natural language.

### 2. One-Button Payment
Buyer never sees a wallet UI. When the deal is agreed:
- Chat shows: "✦ Deal agreed: Logo design — $200"
- Below it: one button → "Pay $200"
- Click → handled by CROO (wallet connect if needed, USDC transfer, escrow)
- Confirmation appears in chat. Done.

### 3. Link-First Distribution
No app to download. No account to create. The link IS the product.
- Works in WhatsApp bio, Twitter/X profile, Instagram link-in-bio
- Opens in any browser
- Loads fast (Next.js SSR)

### 4. Seller Earnings via Chat
Seller texts their own Relay: "How much did I earn this week?"
AI responds with earnings summary. No dashboard needed.

### 5. Smart Defaults
- SLA defaults to 48h (seller can override via chat)
- Pricing pulled from conversation, not a form
- Service categories auto-detected from seller description
- Relay link auto-generated from display name (editable)

---

## Submission Checklist (All 5 Requirements)

| Requirement | How We Meet It |
|---|---|
| Listed on CROO Agent Store | Relay registered as a Provider agent with deal-closing service |
| Integrated with CAP | Full lifecycle: negotiate → escrow → deliver → settle |
| Open source | Public GitHub repo, MIT license |
| Demo + README | 5-min video showing: seller onboarding → share link → buyer closes deal → payment settles → A2A call |
| BUIDL on DoraHacks | Filed with all fields |

---

## Anti-Sybil Compliance

- Each seller = unique wallet = unique agent
- Demo will show ≥ 3 unique counterparty agents
- ≥ 5 unique buyer wallets in test transactions
- No self-trade patterns (different wallet clusters for buyer/seller)

---

## Risk Mitigation

| Risk | Mitigation |
|---|---|
| AI says something wrong in negotiation | Strict function calling boundaries, seller-defined price floors/ceilings, confirmation step before payment |
| CAP integration takes too long | Start here on Day 1. If blocked, use CROO Discord office hours immediately |
| Demo breaks live | Pre-record golden path. Have backup video ready. |
| Scope creep on UI | The chat component IS the UI. No dashboards. No settings. Resist the urge. |
| USDC liquidity for testing | Use small amounts ($0.01-$1 test transactions). CROO sponsors gas. |
