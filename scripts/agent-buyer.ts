/**
 * Deskon A2A demo — autonomous buyer agent.
 *
 * A standalone AI agent that discovers a Deskon closer via its A2A card,
 * negotiates the deal over the public chat contract (DeepSeek as its brain),
 * and settles payment on-chain — with zero humans in the loop.
 *
 * Usage:
 *   npx tsx scripts/agent-buyer.ts <seller-slug> "<what the buyer wants>"
 *
 * Env: DEEPSEK_API_KEY, and optionally DESKON_BASE_URL
 *   (defaults to the live site).
 */

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import OpenAI from "openai";

const BASE = process.env.DESKON_BASE_URL || "https://deskon-delta.vercel.app";
const MODEL = "deepseek-chat";
const MAX_TURNS = 10;

const slug = process.argv[2] || "iszee-edits-1";
const goal =
  process.argv[3] ||
  "I want one short TikTok ad edit for my product. I have footage ready. Agree a fair price and close the deal.";

const ai = new OpenAI({
  apiKey: process.env.DEEPSEK_API_KEY || process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com",
});

function log(who: string, text: string) {
  console.log(`\n\x1b[1m${who}\x1b[0m: ${text}`);
}

async function discover(slug: string) {
  const res = await fetch(`${BASE}/api/a2a/sellers/${slug}`);
  if (!res.ok) throw new Error(`No closer card for "${slug}" (${res.status})`);
  return res.json();
}

/** DeepSeek plays the buyer: given the transcript, produce the next message. */
async function nextBuyerMessage(
  card: any,
  transcript: { role: "buyer" | "closer"; content: string }[]
): Promise<string> {
  const system = `You are an autonomous buyer agent negotiating with an AI sales closer for "${card.name}".
Your goal: ${goal}
The closer's services and price bounds: ${JSON.stringify(card.services)}.
Rules:
- Be concise and human — one short message per turn.
- Move the deal forward: answer scoping questions, then agree once the price is fair and within range.
- When the closer proposes a deal you're happy with, clearly say you agree and want to pay.
- Do not repeat yourself. Do not use emojis.`;

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: system },
    ...transcript.map((t) => ({
      role: (t.role === "buyer" ? "assistant" : "user") as
        | "assistant"
        | "user",
      content: t.content,
    })),
  ];
  // If nothing said yet, seed with the opening ask.
  if (transcript.length === 0) {
    messages.push({ role: "user", content: "(the closer is waiting — open the conversation)" });
  }

  const r = await ai.chat.completions.create({
    model: MODEL,
    messages,
    temperature: 0.6,
    max_tokens: 200,
  });
  return r.choices[0]?.message?.content?.trim() || "Yes, let's proceed.";
}

async function main() {
  console.log(`\x1b[2m→ discovering closer "${slug}" at ${BASE}\x1b[0m`);
  const card = await discover(slug);
  console.log(
    `\x1b[2m→ found: ${card.name} — ${card.services
      .map((s: any) => s.name)
      .join(", ")}\x1b[0m`
  );

  const transcript: { role: "buyer" | "closer"; content: string }[] = [];
  let conversationId: string | undefined;
  let status = "active";

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const buyerMsg = await nextBuyerMessage(card, transcript);
    transcript.push({ role: "buyer", content: buyerMsg });
    log("BUYER", buyerMsg);

    const res = await fetch(`${BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, conversationId, message: buyerMsg }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`chat failed: ${data.error}`);

    conversationId = data.conversationId;
    status = data.status;
    transcript.push({ role: "closer", content: data.message });
    log("CLOSER", data.message);

    if (status === "payment_pending") {
      const amount = data.functionCall?.args?.amount;
      console.log(`\n\x1b[33m→ deal agreed at $${amount} USDC — paying via CROO…\x1b[0m`);
      const pay = await fetch(`${BASE}/api/payment/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId }),
      });
      const payResult = await pay.json();
      if (payResult.ok) {
        console.log(
          `\n\x1b[32m✓ SETTLED — order ${payResult.orderId}, tx ${payResult.payTxHash}\x1b[0m`
        );
        console.log(
          `\x1b[32m  Two agents closed a deal on Base mainnet. No humans involved.\x1b[0m\n`
        );
      } else {
        console.log(`\n\x1b[31m✗ payment failed: ${payResult.error}\x1b[0m\n`);
      }
      return;
    }
  }

  console.log(`\n\x1b[31m✗ no deal after ${MAX_TURNS} turns (status: ${status})\x1b[0m\n`);
}

main().catch((err) => {
  console.error("\x1b[31magent-buyer crashed:\x1b[0m", err.message);
  process.exit(1);
});
