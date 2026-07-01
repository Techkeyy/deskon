import OpenAI from "openai";
import { SellerProfile, ChatMessage } from "@/types";

// DeepSeek is OpenAI-API compatible — point the SDK at its endpoint.
const MODEL = "deepseek-chat";

function getAI(): OpenAI {
  return new OpenAI({
    apiKey: process.env.DEEPSEK_API_KEY || process.env.DEEPSEEK_API_KEY,
    baseURL: "https://api.deepseek.com",
  });
}

const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "check_availability",
      description: "Check if the seller offers a specific type of service",
      parameters: {
        type: "object",
        properties: {
          service_type: { type: "string", description: "The type of service the buyer is asking about" },
        },
        required: ["service_type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_deal",
      description: "Propose a deal to the buyer with specific scope and pricing. Call this when you've understood what the buyer wants and are ready to present a price.",
      parameters: {
        type: "object",
        properties: {
          service_name: { type: "string", description: "Name of the service" },
          scope_summary: { type: "string", description: "Clear summary of what will be delivered" },
          price: { type: "number", description: "Price in USDC" },
          timeline: { type: "string", description: "Estimated delivery timeline" },
        },
        required: ["service_name", "scope_summary", "price", "timeline"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "initiate_payment",
      description: "Trigger the payment flow after buyer agrees to the proposed deal. Only call this after the buyer explicitly confirms they want to proceed.",
      parameters: {
        type: "object",
        properties: {
          amount: { type: "number", description: "Amount in USDC" },
          scope_summary: { type: "string", description: "What the buyer is paying for" },
        },
        required: ["amount", "scope_summary"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "decline_inquiry",
      description: "Politely decline an inquiry that doesn't match the seller's services",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string", description: "Why the inquiry is being declined" },
        },
        required: ["reason"],
      },
    },
  },
];

function buildSystemPrompt(seller: SellerProfile): string {
  const serviceList = seller.services
    .map(
      (s) =>
        `- ${s.name}: ${s.description} (Price range: $${s.minPrice}-$${s.maxPrice} USDC). Examples: ${s.examples.join(", ")}`
    )
    .join("\n");

  return `You are Deskon Relay — an AI deal closer working on behalf of "${seller.displayName}".

${seller.personaPrompt}

SERVICES OFFERED:
${serviceList}

YOUR JOB:
1. QUALIFY — Understand what the visitor wants. Ask clarifying questions if needed.
2. SCOPE — Define exactly what will be delivered, when, and for how much. Stay within the price ranges above.
3. CLOSE — When scope and price are agreed, use the initiate_payment function to trigger payment.

RULES:
- Never agree to a price below the minimum for any service.
- Never promise deliverables outside what the seller offers.
- Be conversational and warm, not robotic. Keep messages concise.
- Never use emojis or exclamation marks. Write like a calm, competent professional.
- If someone asks for something you don't offer, use decline_inquiry.
- When you have enough info to propose a deal, use propose_deal. Don't wait for the buyer to ask for a price.
- CRITICAL: If a deal has ALREADY been proposed (you can see a previous message with a price and scope), and the buyer says yes/confirms/agrees/wants to proceed/says "let's go"/"do it"/"pay", you MUST call initiate_payment immediately. Do NOT re-propose the same deal. Do NOT ask for confirmation again.
- Only call initiate_payment AFTER the buyer explicitly agrees to the proposed deal.
- All prices are in USDC.
- You represent the seller. Act in their best interest while being fair to the buyer.`;
}

export interface AIResponse {
  message: string;
  functionCall?: {
    name: string;
    args: Record<string, any>;
  };
}

export async function generateResponse(
  seller: SellerProfile,
  messages: ChatMessage[],
  conversationStatus?: string,
): Promise<AIResponse> {
  const systemContent = conversationStatus === "negotiating"
    ? buildSystemPrompt(seller) + "\n\nIMPORTANT: A deal has ALREADY been proposed in this conversation. If the buyer confirms or agrees, call initiate_payment immediately. Do NOT call propose_deal again."
    : buildSystemPrompt(seller);

  const chatMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemContent },
    ...messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  const toolChoice = conversationStatus === "negotiating"
    ? { type: "function" as const, function: { name: "initiate_payment" } }
    : "auto" as const;

  const completion = await getAI().chat.completions.create({
    model: MODEL,
    messages: chatMessages,
    tools: TOOLS,
    tool_choice: toolChoice,
    temperature: 0.7,
    max_tokens: 500,
  });

  const choice = completion.choices[0];
  const responseMessage = choice.message;

  if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
    const toolCall = responseMessage.tool_calls[0] as any;
    const args = JSON.parse(toolCall.function.arguments);

    let followUpContent = "";

    if (toolCall.function.name === "check_availability") {
      const match = seller.services.find(
        (s) =>
          s.name.toLowerCase().includes(args.service_type.toLowerCase()) ||
          s.description.toLowerCase().includes(args.service_type.toLowerCase())
      );
      followUpContent = match
        ? `Service available: ${match.name} — ${match.description}. Price range: $${match.minPrice}-$${match.maxPrice} USDC.`
        : `No matching service found for "${args.service_type}".`;
    } else if (toolCall.function.name === "propose_deal") {
      return {
        message: `Here's what I'm proposing:\n\n**${args.service_name}**\n${args.scope_summary}\n\n**Price:** $${args.price} USDC\n**Timeline:** ${args.timeline}\n\nWould you like to go ahead with this?`,
        functionCall: { name: "propose_deal", args },
      };
    } else if (toolCall.function.name === "initiate_payment") {
      return {
        message: `Great — let's lock this in.`,
        functionCall: { name: "initiate_payment", args },
      };
    } else if (toolCall.function.name === "decline_inquiry") {
      return {
        message: args.reason,
        functionCall: { name: "decline_inquiry", args },
      };
    }

    // For check_availability, do a follow-up call with the result
    if (followUpContent) {
      chatMessages.push(responseMessage as any);
      chatMessages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: followUpContent,
      } as any);

      const followUp = await getAI().chat.completions.create({
        model: MODEL,
        messages: chatMessages,
        tools: TOOLS,
        temperature: 0.7,
        max_tokens: 500,
      });

      const followUpChoice = followUp.choices[0];
      if (followUpChoice.message.tool_calls?.length) {
        const fc = followUpChoice.message.tool_calls[0] as any;
        return {
          message: followUpChoice.message.content || "",
          functionCall: { name: fc.function.name, args: JSON.parse(fc.function.arguments) },
        };
      }
      return { message: followUpChoice.message.content || "" };
    }
  }

  return { message: responseMessage.content || "" };
}
