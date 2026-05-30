/**
 * EVM Wallet Adapter for GenLayer
 *
 * Connects to MetaMask (or any injected EVM wallet) and creates a GenLayer
 * client that signs transactions through the wallet. The wallet is switched to
 * the correct GenLayer network automatically via `client.connect(...)`.
 */

import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { NETWORK } from "./config";

// ---------- Types ----------
export interface WalletState {
  connected: boolean;
  address: string | null;
  chainId: string | null;
  error: string | null;
}

// ---------- Helpers ----------

/** Check if an EVM wallet (MetaMask etc.) is injected */
export function hasInjectedWallet(): boolean {
  return typeof window !== "undefined" && typeof (window as any).ethereum !== "undefined";
}

/** Request accounts from the injected wallet */
export async function requestAccounts(): Promise<string[]> {
  if (!hasInjectedWallet()) throw new Error("No EVM wallet detected (install MetaMask)");
  const ethereum = (window as any).ethereum;
  const accounts: string[] = await ethereum.request({ method: "eth_requestAccounts" });
  return accounts;
}

/** Get current chain id */
export async function getChainId(): Promise<string> {
  const ethereum = (window as any).ethereum;
  return ethereum.request({ method: "eth_chainId" });
}

/** Create a GenLayer client from the connected wallet address */
export function createGenLayerClient(walletAddress: string) {
  return createClient({
    chain: studionet,
    account: walletAddress as `0x${string}`,
  });
}

/**
 * Full connect flow:
 * 1. Request accounts from MetaMask
 * 2. Create a GenLayer client
 * 3. Switch wallet to the correct GenLayer network
 * Returns { client, address }
 */
export async function connectWallet() {
  const accounts = await requestAccounts();
  if (!accounts || accounts.length === 0) {
    throw new Error("No accounts returned from wallet");
  }
  const address = accounts[0];
  const client = createGenLayerClient(address);

  // Switch the wallet to the GenLayer network (prompts the user if needed)
  await client.connect(NETWORK as any);

  return { client, address };
}

/** Listen for account/chain changes */
export function onAccountsChanged(cb: (accounts: string[]) => void) {
  if (!hasInjectedWallet()) return;
  (window as any).ethereum.on("accountsChanged", cb);
}

export function onChainChanged(cb: (chainId: string) => void) {
  if (!hasInjectedWallet()) return;
  (window as any).ethereum.on("chainChanged", cb);
}
