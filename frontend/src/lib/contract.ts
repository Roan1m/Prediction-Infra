import { CONTRACT_ADDRESS, getReadClient, getWriteClient, normalizeMarket, type Market, TransactionStatus } from "./genlayer";

async function readContract(functionName: string, args: any[] = []) {
  const client = getReadClient();
  return client.readContract({
    address: CONTRACT_ADDRESS,
    functionName,
    args,
  } as any);
}

async function writeAndWait(functionName: string, args: any[]) {
  const client = getWriteClient();
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName,
    args,
    value: BigInt(0),
  } as any);
  await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
  });
  return hash;
}

export async function fetchMarkets(): Promise<Market[]> {
  try {
    const raw: any = await readContract("get_markets");
    if (!Array.isArray(raw)) return [];
    return raw.map((m, i) => normalizeMarket(m, i));
  } catch (e) {
    console.error("fetchMarkets failed", e);
    return [];
  }
}

export async function fetchMarket(id: number): Promise<Market | null> {
  try {
    const raw: any = await readContract("get_market", [id]);
    return normalizeMarket(raw, id);
  } catch (e) {
    console.error("fetchMarket failed", e);
    return null;
  }
}

export async function fetchPlayerPoints(address: string): Promise<number> {
  try {
    const r: any = await readContract("get_player_points", [address]);
    return Number(r ?? 0);
  } catch {
    return 0;
  }
}

export async function createMarket(question: string, resolution_url: string, outcomes_csv: string) {
  return writeAndWait("create_market", [question, resolution_url, outcomes_csv]);
}

export async function predict(marketId: number, outcome: string) {
  return writeAndWait("predict", [marketId, outcome]);
}

export async function resolveMarket(marketId: number) {
  return writeAndWait("resolve", [marketId]);
}