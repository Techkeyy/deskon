/**
 * Ops utility: send USDC from the Deskon treasury to any address.
 * Usage: npx tsx scripts/treasury-send.ts <0xrecipient> <amount>
 * Reads TREASURY_PRIVATE_KEY from .env.local — the key never leaves the env.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { sendUsdc, treasuryAddress, treasuryConfigured } from "../src/lib/treasury";

const [to, amountArg] = process.argv.slice(2);
const amount = Number(amountArg);

async function main() {
  if (!treasuryConfigured()) throw new Error("TREASURY_PRIVATE_KEY not set");
  if (!/^0x[a-fA-F0-9]{40}$/.test(to || "") || !Number.isFinite(amount) || amount <= 0) {
    console.log("usage: npx tsx scripts/treasury-send.ts <0xrecipient> <amount>");
    process.exit(1);
  }
  console.log(`treasury ${treasuryAddress()} → ${to}: $${amount} USDC`);
  const r = await sendUsdc(to, amount);
  console.log(r.ok ? `✓ sent — tx ${r.tx}` : `✗ ${r.error}`);
}
main();
