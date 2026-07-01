import { NextRequest, NextResponse } from "next/server";
import { verifySellerAuth } from "@/lib/auth";
import { getSellerLedger } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { wallet, message, signature } = await req.json();

    const auth = await verifySellerAuth({ wallet, message, signature });
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
        services: auth.seller.services,
      },
      ledger,
    });
  } catch (err: any) {
    console.error("Dashboard error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
