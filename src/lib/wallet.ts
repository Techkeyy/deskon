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
