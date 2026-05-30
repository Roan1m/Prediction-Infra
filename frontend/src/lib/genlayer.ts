import { createClient, createAccount } from "genlayer-js";
import { generatePrivateKey } from "viem/accounts";
import { studionet, testnetBradbury } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

export const CONTRACT_ADDRESS =
  "0xbAA2dfb881476cC9C23975D7A90F2a81f7Dd5dA1" as `0x${string}`;

// Switch to testnetBradbury if your contract is deployed there.
export const CHAIN = studionet;

const ACCOUNT_KEY = "gl_market_account_pk";

export function getOrCreateAccount() {
  let pk = localStorage.getItem(ACCOUNT_KEY) as `0x${string}` | null;
  if (!pk) {
    pk = generatePrivateKey();
    localStorage.setItem(ACCOUNT_KEY, pk);
  }
  return createAccount(pk);
}

export function getReadClient() {
  return createClient({ chain: CHAIN });
}

export function getWriteClient() {
  const account = getOrCreateAccount();
  return createClient({ chain: CHAIN, account });
}

export { TransactionStatus };

export type Market = {
  id: number;
  creator: string;
  question: string;
  resolution_url: string;
  outcomes: string[];
  resolved: boolean;
  winning_outcome: string | null;
  prediction_count: number;
};

// Normalize possible contract return shapes into our Market type.
export function normalizeMarket(raw: any, id?: number): Market {
  const outcomes = Array.isArray(raw.outcomes)
    ? raw.outcomes
    : typeof raw.outcomes === "string"
      ? raw.outcomes.split(",").map((s: string) => s.trim()).filter(Boolean)
      : [];
  return {
    id: Number(raw.id ?? id ?? 0),
    creator: String(raw.creator ?? ""),
    question: String(raw.question ?? ""),
    resolution_url: String(raw.resolution_url ?? raw.url ?? ""),
    outcomes,
    resolved: Boolean(raw.resolved ?? raw.is_resolved ?? false),
    winning_outcome: raw.winning_outcome ?? raw.outcome ?? null,
    prediction_count: Number(raw.prediction_count ?? raw.predictions_count ?? 0),
  };
}