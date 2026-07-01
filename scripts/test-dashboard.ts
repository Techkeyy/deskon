/**
 * Validates the full dashboard path without a browser wallet:
 * viem sign → server verifyMessage → getSellerByWallet → ledger → withdraw.
 * Creates a throwaway seller, tests, then deletes it (cascades orders/withdrawals).
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { createClient } from "@supabase/supabase-js";

const supa = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { persistSession: false } }
);

const BASE = "http://localhost:3099";

async function main() {
  const account = privateKeyToAccount(generatePrivateKey());
  const wallet = account.address.toLowerCase();

  const { data: seller, error } = await supa
    .from("sellers")
    .insert({
      slug: "test-dash-" + Date.now(),
      display_name: "Test Dash",
      payout_wallet: wallet,
      services: [],
    })
    .select("*")
    .single();
  if (error) throw error;
  console.log("→ created test seller", seller.id, "wallet", wallet);

  await supa.from("orders").insert([
    { seller_id: seller.id, amount: 200, scope: "Logo — completed", status: "completed" },
    { seller_id: seller.id, amount: 150, scope: "Brand — in escrow", status: "paid" },
  ]);
  console.log("→ inserted 2 orders (1 completed, 1 pending)");

  // 1. dashboard auth + ledger
  const msg1 = `Deskon dashboard access\nWallet: ${wallet}\nTime: ${Date.now()}`;
  const sig1 = await account.signMessage({ message: msg1 });
  const r1 = await fetch(`${BASE}/api/dashboard`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wallet, message: msg1, signature: sig1 }),
  });
  console.log("\nDASHBOARD", r1.status);
  console.log(JSON.stringify(await r1.json(), null, 2));

  // 2. withdraw available balance
  const msg2 = `Deskon dashboard access\nWallet: ${wallet}\nTime: ${Date.now()}`;
  const sig2 = await account.signMessage({ message: msg2 });
  const r2 = await fetch(`${BASE}/api/dashboard/withdraw`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wallet, message: msg2, signature: sig2, amount: 200 }),
  });
  console.log("\nWITHDRAW", r2.status);
  console.log(JSON.stringify(await r2.json(), null, 2));

  // 3. bad signature should 401
  const r3 = await fetch(`${BASE}/api/dashboard`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wallet, message: msg1, signature: "0xdeadbeef" }),
  });
  console.log("\nBAD-SIG (expect 401)", r3.status);

  // cleanup
  await supa.from("sellers").delete().eq("id", seller.id);
  console.log("\n→ cleaned up test seller");
}

main().catch((e) => {
  console.error("TEST FAILED:", e);
  process.exit(1);
});
