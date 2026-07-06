import OpenAI from "openai";
import { ChatMessage, SellerService } from "@/types";

const MODEL = "deepseek-chat";

function getAI(): OpenAI {
  return new OpenAI({
    apiKey: process.env.DEEPSEK_API_KEY || process.env.DEEPSEEK_API_KEY,
    baseURL: "https://api.deepseek.com",
  });
}

const FINALIZE_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "finalize_relay",
    description:
      "Call this once you have gathered enough about the seller to create their Relay: their name/brand, at least one service with a price range, and any rules. Only call after confirming the details with the seller.",
    parameters: {
      type: "object",
      properties: {
        display_name: { type: "string", description: "The seller's display name or brand" },
        services: {
          type: "array",
          description: "The services the seller offers",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              description: { type: "string" },
              min_price: { type: "number", description: "Minimum price in USDC" },
              max_price: { type: "number", description: "Maximum price in USDC" },
            },
            required: ["name", "description", "min_price", "max_price"],
          },
        },
        rules: {
          type: "string",
          description: "Any boundaries, e.g. minimum budget, turnaround limits, things they won't do",
        },
        notify_email: {
          type: "string",
          description: "Email where the seller wants deal-closed notifications (optional)",
        },
        delivery_instructions: {
          type: "string",
          description:
            "What the buyer should do right after paying — where to send materials or how the seller will reach them (optional)",
        },
      },
      required: ["display_name", "services"],
    },
  },
};

const ONBOARDING_SYSTEM = `You are the setup assistant for Deskon — a tool that gives sellers an AI deal-closer behind a shareable link.

Your job is to interview a new seller in a friendly, efficient way and gather everything needed to build their Relay:
1. What they do / their name or brand
2. What services they offer and typical pricing (a range is fine)
3. Any rules or boundaries (minimum budget, turnaround, things they won't take on)
4. The handoff: what should a buyer do right after paying (e.g. "email your footage to studio@example.com"), and where the seller wants deal notifications sent

GUIDELINES:
- Be warm and conversational. Ask ONE focused question at a time.
- Don't interrogate — infer sensible defaults and confirm rather than asking everything explicitly.
- The handoff question can be one combined question; if they skip it, that's fine — leave those fields out.
- Never use emojis or exclamation marks.
- Once you have their name, at least one priced service, and any rules, summarize it back and ask them to confirm.
- After they confirm, call finalize_relay with the structured data.
- Keep messages short.

Start by warmly asking what they do.`;

export interface OnboardingResponse {
  message: string;
  finalized?: {
    displayName: string;
    services: SellerService[];
    rules: string;
    personaPrompt: string;
    notifyEmail: string | null;
    deliveryInstructions: string | null;
  };
}

export async function runOnboardingTurn(messages: ChatMessage[]): Promise<OnboardingResponse> {
  const chatMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: ONBOARDING_SYSTEM },
    ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
  ];

  const completion = await getAI().chat.completions.create({
    model: MODEL,
    messages: chatMessages,
    tools: [FINALIZE_TOOL],
    tool_choice: "auto",
    temperature: 0.7,
    max_tokens: 400,
  });

  const msg = completion.choices[0].message;

  if (msg.tool_calls?.length) {
    const tc = msg.tool_calls[0] as any;
    const args = JSON.parse(tc.function.arguments);

    const services: SellerService[] = (args.services || []).map((s: any) => ({
      name: s.name,
      description: s.description,
      minPrice: s.min_price,
      maxPrice: s.max_price,
      currency: "USDC",
      examples: [],
    }));

    const personaPrompt = `You are the AI assistant for ${args.display_name}. ${
      args.rules ? `Rules to follow strictly: ${args.rules}.` : ""
    } Be friendly, professional, and close deals within the stated price ranges.`;

    return {
      message: `Your Relay is ready. Here's your link — share it anywhere.`,
      finalized: {
        displayName: args.display_name,
        services,
        rules: args.rules || "",
        personaPrompt,
        notifyEmail: args.notify_email || null,
        deliveryInstructions: args.delivery_instructions || null,
      },
    };
  }

  return { message: msg.content || "" };
}
