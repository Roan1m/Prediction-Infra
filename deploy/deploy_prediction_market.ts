import { readFileSync } from "fs";
import path from "path";
import {
  TransactionHash,
  TransactionStatus,
  GenLayerClient,
  DecodedDeployData,
  GenLayerChain,
} from "genlayer-js/types";
import { testnetBradbury } from "genlayer-js/chains";

// Deploy the PredictionMarket Intelligent Contract.
// Run with: genlayer deploy
export default async function main(client: GenLayerClient<any>) {
  const filePath = path.resolve(process.cwd(), "contracts/prediction_market.py");
  const contractCode = new Uint8Array(readFileSync(filePath));

  await client.initializeConsensusSmartContract();

  const deployTransaction = await client.deployContract({
    code: contractCode,
    args: [], // PredictionMarket constructor takes no arguments
  });

  const receipt = await client.waitForTransactionReceipt({
    hash: deployTransaction as TransactionHash,
    retries: 200,
  });

  if (
    receipt.statusName !== TransactionStatus.ACCEPTED &&
    receipt.statusName !== TransactionStatus.FINALIZED
  ) {
    throw new Error(`Deployment failed. Receipt: ${JSON.stringify(receipt)}`);
  }

  // receipt shape differs between testnet and localnet/studionet
  const deployedContractAddress =
    (client.chain as GenLayerChain).id !== testnetBradbury.id
      ? receipt.data.contract_address
      : (receipt.txDataDecoded as DecodedDeployData)?.contractAddress;

  console.log("PredictionMarket deployed!", {
    "Transaction Hash": deployTransaction,
    "Contract Address": deployedContractAddress,
  });

  return deployedContractAddress;
}
