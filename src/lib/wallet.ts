// Client-side wallet helpers — injected provider (MetaMask, Coinbase Wallet, etc.)

export interface EthereumProvider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export function hasWallet(): boolean {
  return typeof window !== "undefined" && !!window.ethereum;
}

export async function connectWallet(): Promise<string> {
  if (!window.ethereum) {
    throw new Error("No wallet found. Install MetaMask or Coinbase Wallet.");
  }
  const accounts = (await window.ethereum.request({
    method: "eth_requestAccounts",
  })) as string[];
  if (!accounts?.length) throw new Error("No account authorized.");
  return accounts[0];
}

export async function signMessage(
  address: string,
  message: string
): Promise<string> {
  if (!window.ethereum) throw new Error("No wallet found.");
  return (await window.ethereum.request({
    method: "personal_sign",
    params: [message, address],
  })) as string;
}

/** Build the message a seller signs to prove wallet ownership for dashboard access. */
export function dashboardAuthMessage(wallet: string): string {
  return `Deskon dashboard access\nWallet: ${wallet.toLowerCase()}\nTime: ${Date.now()}`;
}

// ── buyer-side USDC payment (Base mainnet) ──────────────

const BASE_CHAIN_HEX = "0x2105"; // 8453
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

/** Prompt the wallet onto Base mainnet if it's elsewhere. */
export async function ensureBaseChain(): Promise<void> {
  if (!window.ethereum) throw new Error("No wallet found.");
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: BASE_CHAIN_HEX }],
    });
  } catch (err: any) {
    // 4902 = chain not added to the wallet yet
    if (err?.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: BASE_CHAIN_HEX,
            chainName: "Base",
            nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
            rpcUrls: ["https://mainnet.base.org"],
            blockExplorerUrls: ["https://basescan.org"],
          },
        ],
      });
    } else {
      throw new Error("Switch your wallet to Base mainnet to pay.");
    }
  }
}

/**
 * Send USDC from the buyer's wallet to Deskon's deposit address.
 * Returns the tx hash — the server verifies the transfer on-chain
 * before settling the deal.
 */
export async function payUsdc(to: string, amount: number): Promise<string> {
  if (!window.ethereum) throw new Error("No wallet found.");
  await ensureBaseChain();
  const from = await connectWallet();

  // erc20 transfer(address,uint256) — encoded by hand to avoid pulling viem
  // into the client bundle for one call.
  const units = BigInt(Math.round(amount * 1e6));
  const data =
    "0xa9059cbb" +
    to.toLowerCase().replace("0x", "").padStart(64, "0") +
    units.toString(16).padStart(64, "0");

  return (await window.ethereum.request({
    method: "eth_sendTransaction",
    params: [{ from, to: USDC_BASE, data }],
  })) as string;
}
