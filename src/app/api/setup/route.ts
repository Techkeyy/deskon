import { NextRequest, NextResponse } from "next/server";
import { runOnboardingTurn } from "@/lib/onboarding";
import { createSeller, generateSlug } from "@/lib/db";
import { googleEmailFromToken } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { ChatMessage } from "@/types";

export async function POST(req: NextRequest) {
  try {
    // Onboarding turns are paid DeepSeek calls too.
    if (!rateLimit(`setup:${clientIp(req)}`, 12, 60_000)) {
      return NextResponse.json(
        { error: "Too many messages — slow down for a minute." },
        { status: 429 }
      );
    }

    const { messages, payoutWallet, googleToken } = await req.json();

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
      // A payout wallet is required to finalize — it's the seller's identity + payout.
      if (!payoutWallet || !/^0x[a-fA-F0-9]{40}$/.test(payoutWallet)) {
        return NextResponse.json({
          message:
            "Almost there — connect your Base wallet above so I know where to send your earnings, then send your last message again.",
          finalized: false,
          needsWallet: true,
        });
      }

      // The linked email comes from the verified Google session, never from
      // a client-claimed string.
      const authEmail = await googleEmailFromToken(googleToken);

      const slug = await generateSlug(result.finalized.displayName);
      const seller = await createSeller({
        slug,
        displayName: result.finalized.displayName,
        personaPrompt: result.finalized.personaPrompt,
        services: result.finalized.services,
        payoutWallet,
        authEmail,
        notifyEmail: result.finalized.notifyEmail,
        deliveryInstructions: result.finalized.deliveryInstructions,
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
