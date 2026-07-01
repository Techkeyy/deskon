import { NextRequest, NextResponse } from "next/server";
import { verifySellerAuth } from "@/lib/auth";
import { getSellerLedger, createWithdrawal } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { wallet, message, signature, amount } = await req.json();

    const auth = await verifySellerAuth({ wallet, message, signature });
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
    }

    if (!auth.seller.payoutWallet) {
      return NextResponse.json(
        { ok: false, error: "No payout wallet on file." },
        { status: 400 }
      );
    }

    const ledger = await getSellerLedger(auth.seller.id);
    const amt = Number(amount);

    if (!Number.isFinite(amt) || amt <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid amount." }, { status: 400 });
    }
    if (amt > ledger.available) {
      return NextResponse.json(
        { ok: false, error: `Only $${ledger.available} available.` },
        { status: 400 }
      );
    }

    const withdrawal = await createWithdrawal({
      sellerId: auth.seller.id,
      amount: amt,
      toWallet: auth.seller.payoutWallet,
      status: "requested",
    });

    return NextResponse.json({ ok: true, withdrawal });
  } catch (err: any) {
    console.error("Withdraw error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
