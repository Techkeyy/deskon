/**
 * Seller notifications via Resend (plain fetch — no SDK dependency).
 * No-ops gracefully when RESEND_API_KEY isn't set, so payments never
 * fail because email did.
 *
 * Note: on Resend's sandbox domain (resend.dev, no verified domain) mail
 * only delivers to the Resend account owner's address — fine for the demo.
 */

const FROM = process.env.NOTIFY_FROM || "Deskon <onboarding@resend.dev>";

const SITE = "https://deskon-delta.vercel.app";

async function send(
  to: string,
  subject: string,
  lines: (string | null)[]
): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key || !to) return;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        subject,
        text: lines.filter((l) => l !== null).join("\n"),
      }),
    });
    if (!res.ok) {
      console.error("notify: resend responded", res.status, await res.text());
    }
  } catch (err) {
    console.error("notify: send failed", err);
  }
}

export async function sendDealClosedEmail(input: {
  to: string;
  sellerName: string;
  amount: number;
  scope: string | null;
  orderId: string | null;
  payTx: string | null;
  buyerContact: string | null;
}): Promise<void> {
  const basescan = input.payTx ? `${"https://basescan.org/tx/"}${input.payTx}` : null;
  await send(
    input.to,
    `Deal closed — $${input.amount} USDC${
      input.scope ? ` · ${input.scope.slice(0, 60)}` : ""
    }`,
    [
      `Your closer just settled a deal for ${input.sellerName}.`,
      ``,
      `Amount: $${input.amount} USDC (held in escrow on Base)`,
      input.scope ? `Scope: ${input.scope}` : null,
      input.orderId ? `Order: ${input.orderId}` : null,
      basescan ? `Proof: ${basescan}` : null,
      ``,
      input.buyerContact
        ? `Deliver the finished work to the buyer at: ${input.buyerContact}`
        : `No buyer contact was provided — reach out via your usual channel.`,
      `Funds release to you once the buyer confirms delivery (or after 7 days).`,
      `Dashboard: ${SITE}/dashboard`,
    ]
  );
}

/** Buyer receipt: order reference + a device-independent tracking link. */
export async function sendBuyerReceiptEmail(input: {
  to: string;
  sellerName: string;
  amount: number;
  scope: string | null;
  trackUrl: string;
}): Promise<void> {
  await send(input.to, `Your order with ${input.sellerName} — $${input.amount} USDC`, [
    `Thanks — your payment is held in escrow on Base.`,
    ``,
    input.scope ? `Scope: ${input.scope}` : null,
    `Amount: $${input.amount} USDC`,
    ``,
    `Track your order and confirm delivery here (works on any device):`,
    input.trackUrl,
    ``,
    `When the work arrives, open that link and confirm delivery to release`,
    `the funds. If you do nothing, they release automatically after 7 days.`,
  ]);
}
