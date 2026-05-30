import React, { useState, useEffect, useCallback } from "react";
import {
  connectWallet,
  hasInjectedWallet,
  onAccountsChanged,
  onChainChanged,
  type WalletState,
} from "./wallet";
import { CONTRACT_ADDRESS, NETWORK } from "./config";
import { TransactionStatus } from "genlayer-js/types";

// ─── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [wallet, setWallet] = useState<WalletState>({
    connected: false,
    address: null,
    chainId: null,
    error: null,
  });
  const [client, setClient] = useState<any>(null);
  const [markets, setMarkets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [txStatus, setTxStatus] = useState<string>("");

  // ─── Connect ────────────────────────────────────────────────────────────────
  const handleConnect = useCallback(async () => {
    try {
      setWallet((w) => ({ ...w, error: null }));
      const { client: c, address } = await connectWallet();
      setClient(c);
      setWallet({ connected: true, address, chainId: null, error: null });
    } catch (err: any) {
      setWallet((w) => ({ ...w, error: err.message || "Connection failed" }));
    }
  }, []);

  // ─── Listeners ──────────────────────────────────────────────────────────────
  useEffect(() => {
    onAccountsChanged((accs) => {
      if (accs.length === 0) {
        setWallet({ connected: false, address: null, chainId: null, error: null });
        setClient(null);
      } else {
        setWallet((w) => ({ ...w, address: accs[0] }));
      }
    });
    onChainChanged((chainId) => {
      setWallet((w) => ({ ...w, chainId }));
    });
  }, []);

  // ─── Read markets ───────────────────────────────────────────────────────────
  const loadMarkets = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    try {
      const count = await client.readContract({
        address: CONTRACT_ADDRESS,
        functionName: "get_market_count",
        args: [],
      });
      const list: any[] = [];
      for (let i = 0; i < Number(count); i++) {
        const m = await client.readContract({
          address: CONTRACT_ADDRESS,
          functionName: "get_market",
          args: [i],
        });
        list.push(m);
      }
      setMarkets(list);
    } catch (err: any) {
      console.error("loadMarkets error:", err);
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    if (client) loadMarkets();
  }, [client, loadMarkets]);

  // ─── Create market ──────────────────────────────────────────────────────────
  const [newQ, setNewQ] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newOutcomes, setNewOutcomes] = useState("");
  const [newDeadline, setNewDeadline] = useState("");

  const handleCreateMarket = async () => {
    if (!client) return;
    setTxStatus("Sending create_market...");
    try {
      const txHash = await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "create_market",
        args: [newQ, newUrl, newOutcomes, newDeadline],
        value: BigInt(0),
      });
      setTxStatus(`Tx sent: ${txHash}. Waiting...`);
      await client.waitForTransactionReceipt({
        hash: txHash,
        status: TransactionStatus.ACCEPTED,
      });
      setTxStatus("Market created!");
      setNewQ(""); setNewUrl(""); setNewOutcomes(""); setNewDeadline("");
      loadMarkets();
    } catch (err: any) {
      setTxStatus(`Error: ${err.message}`);
    }
  };

  // ─── Predict ────────────────────────────────────────────────────────────────
  const [predictMarketId, setPredictMarketId] = useState("");
  const [predictOutcome, setPredictOutcome] = useState("");

  const handlePredict = async () => {
    if (!client) return;
    setTxStatus("Sending predict...");
    try {
      const txHash = await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "predict",
        args: [Number(predictMarketId), predictOutcome],
        value: BigInt(0),
      });
      setTxStatus(`Tx sent: ${txHash}. Waiting...`);
      await client.waitForTransactionReceipt({
        hash: txHash,
        status: TransactionStatus.ACCEPTED,
      });
      setTxStatus("Prediction registered!");
      loadMarkets();
    } catch (err: any) {
      setTxStatus(`Error: ${err.message}`);
    }
  };

  // ─── Resolve ────────────────────────────────────────────────────────────────
  const [resolveMarketId, setResolveMarketId] = useState("");

  const handleResolve = async () => {
    if (!client) return;
    setTxStatus("Sending resolve (may take a moment - AI consensus)...");
    try {
      const txHash = await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "resolve",
        args: [Number(resolveMarketId)],
        value: BigInt(0),
      });
      setTxStatus(`Tx sent: ${txHash}. Waiting for finalization...`);
      await client.waitForTransactionReceipt({
        hash: txHash,
        status: TransactionStatus.FINALIZED,
        retries: 60,
        interval: 5000,
      });
      setTxStatus("Market resolved!");
      loadMarkets();
    } catch (err: any) {
      setTxStatus(`Error: ${err.message}`);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      <h1>GenLayer Prediction Market</h1>

      {/* Wallet connection */}
      {!wallet.connected ? (
        <div className="card">
          <div className="status disconnected">Wallet not connected</div>
          {!hasInjectedWallet() ? (
            <p>No EVM wallet detected. Please install <a href="https://metamask.io" target="_blank" style={{color:"#a78bfa"}}>MetaMask</a>.</p>
          ) : (
            <button onClick={handleConnect}>Connect Wallet (MetaMask)</button>
          )}
          {wallet.error && <div className="status error">{wallet.error}</div>}
        </div>
      ) : (
        <div className="status connected">
          Connected: {wallet.address?.slice(0, 6)}...{wallet.address?.slice(-4)} | Network: {NETWORK}
        </div>
      )}

      {/* Tx status */}
      {txStatus && <div className="status" style={{background:"#1a1a2e", border:"1px solid #333", marginBottom:"1rem"}}>{txStatus}</div>}

      {wallet.connected && (
        <div className="grid">
          {/* Left column: actions */}
          <div>
            <h2>Create Market</h2>
            <div className="card">
              <input placeholder="Question" value={newQ} onChange={(e) => setNewQ(e.target.value)} />
              <input placeholder="Resolution URL (public page)" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} />
              <input placeholder="Outcomes (comma-separated)" value={newOutcomes} onChange={(e) => setNewOutcomes(e.target.value)} />
              <input placeholder="Deadline (optional)" value={newDeadline} onChange={(e) => setNewDeadline(e.target.value)} />
              <button onClick={handleCreateMarket} disabled={!newQ || !newUrl || !newOutcomes}>Create</button>
            </div>

            <h2>Predict</h2>
            <div className="card">
              <input placeholder="Market ID" type="number" value={predictMarketId} onChange={(e) => setPredictMarketId(e.target.value)} />
              <input placeholder="Your outcome" value={predictOutcome} onChange={(e) => setPredictOutcome(e.target.value)} />
              <button onClick={handlePredict} disabled={!predictMarketId || !predictOutcome}>Predict</button>
            </div>

            <h2>Resolve</h2>
            <div className="card">
              <input placeholder="Market ID" type="number" value={resolveMarketId} onChange={(e) => setResolveMarketId(e.target.value)} />
              <button onClick={handleResolve} disabled={!resolveMarketId}>Resolve (AI)</button>
            </div>
          </div>

          {/* Right column: markets list */}
          <div>
            <h2>Markets {loading && "(loading...)"}</h2>
            {markets.length === 0 && !loading && <p style={{color:"#666"}}>No markets yet. Create one!</p>}
            {markets.map((m, i) => (
              <div className="card" key={i}>
                <strong>#{m.id}</strong> {m.question}
                <br />
                <small style={{color:"#888"}}>Outcomes: {Array.isArray(m.outcomes) ? m.outcomes.join(", ") : m.outcomes}</small>
                <br />
                {m.resolved ? (
                  <span style={{color:"#4ade80"}}>Resolved: {m.winning_outcome}</span>
                ) : (
                  <span style={{color:"#facc15"}}>Open</span>
                )}
              </div>
            ))}
            <button onClick={loadMarkets} style={{marginTop:"0.5rem"}}>Refresh</button>
          </div>
        </div>
      )}
    </div>
  );
}
