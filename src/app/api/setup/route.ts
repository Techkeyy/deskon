import { NextRequest, NextResponse } from "next/server";
import { runOnboardingTurn } from "@/lib/onboarding";
import { createSeller, generateSlug } from "@/lib/store";
import { ChatMessage } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    if (!Array.isArray(messages)) {
      return NextResponse.json({ error: "messages array required" }, { status: 400 });
    }

    const history: ChatMessage[] = messages.map((m: any, i: number) => ({
      id: String(i),
      role: m.role,
      content: m.content,
      timestamp: new Date().toISOString(),
    }));

    const result = await runOnboardingTurn(history);

    if (result.finalized) {
      const slug = generateSlug(result.finalized.displayName);
      const seller = createSeller({
        walletAddress: "0x0000000000000000000000000000000000000000",
        crooAgentId: "",
        crooApiKey: "",
        displayName: result.finalized.displayName,
        slug,
        services: result.finalized.services,
        personaPrompt: result.finalized.personaPrompt,
      });

      return NextResponse.json({
        message: result.message,
        finalized: true,
        slug: seller.slug,
        displayName: seller.displayName,
        services: seller.services,
      });
    }

    return NextResponse.json({ message: result.message, finalized: false });
  } catch (err: any) {
    console.error("Setup error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
