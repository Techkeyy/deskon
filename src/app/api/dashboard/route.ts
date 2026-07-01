import { NextRequest, NextResponse } from "next/server";
import { resolveSellerAuth } from "@/lib/auth";
import { getSellerLedger } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { wallet, message, signature, googleToken } = await req.json();

    const auth = await resolveSellerAuth({
      wallet,
      message,
      signature,
      googleToken,
    });
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
    }

    const ledger = await getSellerLedger(auth.seller.id);

    return NextResponse.json({
      ok: true,
      seller: {
        displayName: auth.seller.displayName,
        slug: auth.seller.slug,
        payoutWallet: auth.seller.payoutWallet,
        authEmail: auth.seller.authEmail,
        services: auth.seller.services,
      },
      ledger,
    });
  } catch (err: any) {
    console.error("Dashboard error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
