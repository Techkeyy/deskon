/**
 * Seller notifications via Resend (plain fetch — no SDK dependency).
 * No-ops gracefully when RESEND_API_KEY isn't set, so payments never
 * fail because email did.
 *
 * Note: on Resend's sandbox domain (resend.dev, no verified domain) mail
 * only delivers to the Resend account owner's address — fine for the demo.
 */

const FROM = process.env.NOTIFY_FROM || "Deskon <onboarding@resend.dev>";

export async function sendDealClosedEmail(input: {
  to: string;
  sellerName: string;
  amount: number;
  scope: string | null;
  orderId: string | null;
  payTx: string | null;
}): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key || !input.to) return;

  const basescan = input.payTx
    ? `https://basescan.org/tx/${input.payTx}`
    : null;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [input.to],
        subject: `Deal closed — $${input.amount} USDC${
          input.scope ? ` · ${input.scope.slice(0, 60)}` : ""
        }`,
        text: [
          `Your closer just settled a deal for ${input.sellerName}.`,
          ``,
          `Amount: $${input.amount} USDC (escrow on Base)`,
          input.scope ? `Scope: ${input.scope}` : null,
          input.orderId ? `Order: ${input.orderId}` : null,
          basescan ? `Proof: ${basescan}` : null,
          ``,
          `The buyer has been given your delivery instructions.`,
          `Track everything: https://deskon-delta.vercel.app/dashboard`,
        ]
          .filter((l) => l !== null)
          .join("\n"),
      }),
    });
    if (!res.ok) {
      console.error("notify: resend responded", res.status, await res.text());
    }
  } catch (err) {
    console.error("notify: send failed", err);
  }
}
