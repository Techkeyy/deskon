import { NextRequest, NextResponse } from "next/server";
import { resolveSellerAuth } from "@/lib/auth";
import {
  getSellerLedger,
  createWithdrawal,
  updateWithdrawal,
  getPayoutVolumeSince,
} from "@/lib/db";
import { treasuryConfigured, sendUsdc } from "@/lib/treasury";

const DAILY_PAYOUT_CAP = Number(process.env.DESKON_DAILY_PAYOUT_CAP || 50);

export async function POST(req: NextRequest) {
  try {
    const { wallet, message, signature, googleToken, amount } =
      await req.json();

    const auth = await resolveSellerAuth({
      wallet,
      message,
      signature,
      googleToken,
    });
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

    // Daily payout cap — bounds worst-case treasury drain.
    const utcMidnight = new Date();
    utcMidnight.setUTCHours(0, 0, 0, 0);
    const paidToday = await getPayoutVolumeSince(utcMidnight.toISOString());
    if (paidToday + amt > DAILY_PAYOUT_CAP) {
      return NextResponse.json(
        {
          ok: false,
          error: "Daily payout cap reached — try again tomorrow.",
        },
        { status: 429 }
      );
    }

    const withdrawal = await createWithdrawal({
      sellerId: auth.seller.id,
      amount: amt,
      toWallet: auth.seller.payoutWallet,
      status: "requested",
    });

    // Execute on-chain if the treasury is configured; otherwise the request
    // stays queued for manual payout.
    if (!treasuryConfigured()) {
      return NextResponse.json({
        ok: true,
        withdrawal,
        note: "Payout request recorded — processed manually while the treasury is offline.",
      });
    }

    const payout = await sendUsdc(auth.seller.payoutWallet, amt);
    if (!payout.ok) {
      // Mark failed so the amount returns to the seller's available balance.
      await updateWithdrawal(withdrawal.id, { status: "failed" });
      return NextResponse.json(
        { ok: false, error: payout.error || "Payout failed — balance restored." },
        { status: 502 }
      );
    }

    const sent = await updateWithdrawal(withdrawal.id, {
      status: "sent",
      tx: payout.tx,
    });

    return NextResponse.json({ ok: true, withdrawal: sent ?? withdrawal, tx: payout.tx });
  } catch (err: any) {
    console.error("Withdraw error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
