/**
 * ArbitrAI CRE Workflow — On-Chain Submission
 *
 * Submits the signed verdict to CREVerifier.sol via direct JSON-RPC call.
 * Uses the CRE HTTP capability (no ethers.js dependency for WASM compatibility).
 *
 * In the CRE workflow deployment, this is handled by the Ethereum Transaction
 * Writer capability defined in workflow.yaml. This module is the fallback /
 * local simulation path used for testing and demos.
 */

import type { HttpFetchFn } from './models.js';
import type { WorkflowVerdict, WorkflowOutput } from './types.js';
import { encodeSubmitVerdictCalldata, signVerdict } from './signer.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { keccak_256 } from '@noble/hashes/sha3';
import { secp256k1 } from '@noble/curves/secp256k1';

// ─────────────────────────────────────────────────────────────────────────────
// Transaction Building
// ─────────────────────────────────────────────────────────────────────────────

interface UnsignedTx {
  nonce: number;
  gasPrice: bigint;
  gasLimit: bigint;
  to: string;
  data: string;
  chainId: number;
}

async function getNonce(address: string, rpcUrl: string, httpFetch: HttpFetchFn): Promise<number> {
  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'eth_getTransactionCount',
    params: [address, 'pending'],
  });

  const response = await httpFetch({
    method: 'POST',
    url: rpcUrl,
    headers: { 'content-type': 'application/json' },
    body: Buffer.from(body).toString('base64'),
  });

  const text = Buffer.from(response.body).toString('utf-8');
  const json = JSON.parse(text) as { result: string };
  return parseInt(json.result, 16);
}

async function getGasPrice(rpcUrl: string, httpFetch: HttpFetchFn): Promise<bigint> {
  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'eth_gasPrice',
    params: [],
  });

  const response = await httpFetch({
    method: 'POST',
    url: rpcUrl,
    headers: { 'content-type': 'application/json' },
    body: Buffer.from(body).toString('base64'),
  });

  const text = Buffer.from(response.body).toString('utf-8');
  const json = JSON.parse(text) as { result: string };
  return BigInt(json.result) * 120n / 100n; // +20% buffer
}

/**
 * Simple RLP encoder for Ethereum transactions.
 * Pure JS — no Node.js dependencies, WASM-compatible.
 */
function rlpEncode(input: unknown): Uint8Array {
  if (typeof input === 'bigint' || typeof input === 'number') {
    const n = BigInt(input);
    if (n === 0n) return new Uint8Array([0x80]);
    const hex = n.toString(16);
    const padded = hex.length % 2 === 0 ? hex : '0' + hex;
    const bytes = hexToBytes(padded);
    return rlpEncodeBytes(bytes);
  }

  if (typeof input === 'string') {
    const bytes = hexToBytes(input.replace('0x', ''));
    return rlpEncodeBytes(bytes);
  }

  if (Array.isArray(input)) {
    const encodedParts = input.map(rlpEncode);
    const totalLength = encodedParts.reduce((sum, p) => sum + p.length, 0);
    const prefix = rlpLengthPrefix(totalLength, 0xc0);
    const result = new Uint8Array(prefix.length + totalLength);
    result.set(prefix);
    let offset = prefix.length;
    for (const part of encodedParts) {
      result.set(part, offset);
      offset += part.length;
    }
    return result;
  }

  throw new Error(`Unsupported RLP input type: ${typeof input}`);
}

function rlpEncodeBytes(bytes: Uint8Array): Uint8Array {
  if (bytes.length === 1 && bytes[0] < 0x80) return bytes;
  const prefix = rlpLengthPrefix(bytes.length, 0x80);
  const result = new Uint8Array(prefix.length + bytes.length);
  result.set(prefix);
  result.set(bytes, prefix.length);
  return result;
}

function rlpLengthPrefix(length: number, offset: number): Uint8Array {
  if (length < 56) return new Uint8Array([offset + length]);
  const lengthHex = length.toString(16);
  const padded = lengthHex.length % 2 === 0 ? lengthHex : '0' + lengthHex;
  const lengthBytes = hexToBytes(padded);
  return new Uint8Array([offset + 55 + lengthBytes.length, ...lengthBytes]);
}

/**
 * Sign and RLP-encode an Ethereum transaction.
 */
function signTransaction(tx: UnsignedTx, privateKeyHex: string): string {
  // EIP-155 signing
  const rlpForSigning = rlpEncode([
    tx.nonce,
    tx.gasPrice,
    tx.gasLimit,
    tx.to,
    0n,          // value = 0
    tx.data,
    BigInt(tx.chainId),
    0n,          // r
    0n,          // s
  ]);

  const msgHash = keccak_256(rlpForSigning);
  const privKey = hexToBytes(privateKeyHex.replace('0x', ''));
  const sig = secp256k1.sign(msgHash, privKey);

  const v = BigInt(sig.recovery! + 27 + tx.chainId * 2 + 8);
  const r = sig.r;
  const s = sig.s;

  const signedRlp = rlpEncode([
    tx.nonce,
    tx.gasPrice,
    tx.gasLimit,
    tx.to,
    0n,
    tx.data,
    v,
    r,
    s,
  ]);

  return '0x' + bytesToHex(signedRlp);
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Submit a signed verdict to CREVerifier.sol on-chain.
 *
 * In CRE workflow deployment: the Ethereum Transaction Writer capability
 * handles this automatically using the calldata from the compute step.
 *
 * In local/demo mode: this function builds and broadcasts the transaction directly.
 */
export async function submitVerdictOnChain(
  verdict: WorkflowVerdict,
  verifierContract: string,
  operatorPrivKey: string,
  rpcUrl: string,
  chainId: number,
  httpFetch: HttpFetchFn
): Promise<string> {
  console.log(`[chain] Submitting verdict for dispute ${verdict.disputeId} on-chain...`);

  // 1. Sign the verdict
  const signature = signVerdict(verdict, operatorPrivKey);
  console.log(`[chain] Verdict signed. Sig prefix: ${signature.slice(0, 12)}...`);

  // 2. Encode calldata
  const calldata = encodeSubmitVerdictCalldata(verdict, signature);

  // 3. Get operator address from private key
  const privKeyBytes = hexToBytes(operatorPrivKey.replace('0x', ''));
  const pubKey = secp256k1.getPublicKey(privKeyBytes, false);
  const pubKeyHash = keccak_256(pubKey.slice(1)); // Remove 0x04 prefix
  const operatorAddress = '0x' + bytesToHex(pubKeyHash).slice(24);

  // 4. Get nonce and gas price
  const [nonce, gasPrice] = await Promise.all([
    getNonce(operatorAddress, rpcUrl, httpFetch),
    getGasPrice(rpcUrl, httpFetch),
  ]);

  // 5. Build transaction
  const tx: UnsignedTx = {
    nonce,
    gasPrice,
    gasLimit: 500_000n,
    to: verifierContract,
    data: calldata,
    chainId,
  };

  // 6. Sign and broadcast
  const rawTx = signTransaction(tx, operatorPrivKey);

  const broadcastBody = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'eth_sendRawTransaction',
    params: [rawTx],
  });

  const response = await httpFetch({
    method: 'POST',
    url: rpcUrl,
    headers: { 'content-type': 'application/json' },
    body: Buffer.from(broadcastBody).toString('base64'),
  });

  const text = Buffer.from(response.body).toString('utf-8');
  const json = JSON.parse(text) as { result?: string; error?: { message: string } };

  if (json.error) {
    throw new Error(`Broadcast failed: ${json.error.message}`);
  }

  const txHash = json.result!;
  console.log(`[chain] Verdict submitted! TxHash: ${txHash}`);
  console.log(`[chain] Etherscan: https://sepolia.etherscan.io/tx/${txHash}`);

  return txHash;
}

/**
 * Build WorkflowOutput for the CRE Ethereum Transaction Writer.
 * The CRE runtime uses the calldata from this output to submit the transaction.
 */
export function buildWorkflowOutput(
  verdict: WorkflowVerdict,
  signature: string
): WorkflowOutput {
  const calldata = encodeSubmitVerdictCalldata(verdict, signature);

  const verdictSummary = [
    `Dispute: ${verdict.disputeId.slice(0, 10)}...`,
    `Outcome: ${verdict.finalOutcome}`,
    `Consensus: ${verdict.consensusCount}/3`,
    `Models: ${verdict.modelVotes.map((v) => `${v.modelId}→${v.vote}(${(v.confidenceBps / 100).toFixed(0)}%)`).join(', ')}`,
    `RunId: ${verdict.workflowRunId.slice(0, 10)}...`,
  ].join(' | ');

  return {
    disputeId: verdict.disputeId,
    calldata,
    verdictSummary,
    signature,
  };
}
