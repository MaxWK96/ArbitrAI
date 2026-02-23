/**
 * Contract ABIs and addresses for ArbitrAI frontend
 * Update ADDRESSES after deploying with: forge script script/Deploy.s.sol --broadcast
 */

export const ADDRESSES = {
  escrow: import.meta.env.VITE_ESCROW_ADDRESS ?? '0x0000000000000000000000000000000000000000',
  registry: import.meta.env.VITE_REGISTRY_ADDRESS ?? '0x0000000000000000000000000000000000000000',
  verifier: import.meta.env.VITE_VERIFIER_ADDRESS ?? '0x0000000000000000000000000000000000000000',
  chainId: parseInt(import.meta.env.VITE_CHAIN_ID ?? '11155111', 10),
};

export const SEPOLIA_CONFIG = {
  chainId: '0xaa36a7',
  chainName: 'Sepolia',
  rpcUrls: ['https://rpc.sepolia.org'],
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  blockExplorerUrls: ['https://sepolia.etherscan.io'],
};

// ─────────────────────────────────────────────────────────────────────────────
// DisputeEscrow ABI (relevant functions only)
// ─────────────────────────────────────────────────────────────────────────────

export const ESCROW_ABI = [
  {
    name: 'createDispute',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'partyB', type: 'address' },
      { name: 'description', type: 'string' },
    ],
    outputs: [{ name: 'disputeId', type: 'bytes32' }],
  },
  {
    name: 'depositAndActivate',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{ name: 'disputeId', type: 'bytes32' }],
    outputs: [],
  },
  {
    name: 'getEscrow',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'disputeId', type: 'bytes32' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'partyA', type: 'address' },
          { name: 'partyB', type: 'address' },
          { name: 'depositA', type: 'uint256' },
          { name: 'depositB', type: 'uint256' },
          { name: 'partyADeposited', type: 'bool' },
          { name: 'partyBDeposited', type: 'bool' },
          { name: 'settled', type: 'bool' },
        ],
      },
    ],
  },
  {
    name: 'MIN_DEPOSIT',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  // Events
  {
    name: 'DisputeCreated',
    type: 'event',
    inputs: [
      { name: 'disputeId', type: 'bytes32', indexed: true },
      { name: 'partyA', type: 'address', indexed: true },
      { name: 'partyB', type: 'address', indexed: true },
      { name: 'depositAmount', type: 'uint256', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'PartyBDeposited',
    type: 'event',
    inputs: [
      { name: 'disputeId', type: 'bytes32', indexed: true },
      { name: 'partyB', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'VerdictExecuted',
    type: 'event',
    inputs: [
      { name: 'disputeId', type: 'bytes32', indexed: true },
      { name: 'winner', type: 'address', indexed: true },
      { name: 'payoutAmount', type: 'uint256', indexed: false },
      { name: 'feeAmount', type: 'uint256', indexed: false },
      { name: 'proofHash', type: 'bytes32', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'RefundExecuted',
    type: 'event',
    inputs: [
      { name: 'disputeId', type: 'bytes32', indexed: true },
      { name: 'amountA', type: 'uint256', indexed: false },
      { name: 'amountB', type: 'uint256', indexed: false },
      { name: 'reason', type: 'string', indexed: false },
      { name: 'proofHash', type: 'bytes32', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'CircuitBreakerActivated',
    type: 'event',
    inputs: [
      { name: 'disputeId', type: 'bytes32', indexed: true },
      { name: 'reason', type: 'string', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// ArbitrationRegistry ABI
// ─────────────────────────────────────────────────────────────────────────────

export const REGISTRY_ABI = [
  {
    name: 'submitEvidence',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'disputeId', type: 'bytes32' },
      { name: 'evidenceHash', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    name: 'getDispute',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'disputeId', type: 'bytes32' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'id', type: 'bytes32' },
          { name: 'partyA', type: 'address' },
          { name: 'partyB', type: 'address' },
          { name: 'amount', type: 'uint256' },
          { name: 'status', type: 'uint8' },
          { name: 'evidenceHashA', type: 'bytes32' },
          { name: 'evidenceHashB', type: 'bytes32' },
          { name: 'workflowOutputHash', type: 'bytes32' },
          { name: 'createdAt', type: 'uint256' },
          { name: 'settledAt', type: 'uint256' },
          { name: 'winner', type: 'address' },
          { name: 'description', type: 'string' },
        ],
      },
    ],
  },
  {
    name: 'getPartyDisputes',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'party', type: 'address' }],
    outputs: [{ type: 'bytes32[]' }],
  },
  {
    name: 'disputeCount',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  // Events
  {
    name: 'EvidenceSubmitted',
    type: 'event',
    inputs: [
      { name: 'disputeId', type: 'bytes32', indexed: true },
      { name: 'party', type: 'address', indexed: true },
      { name: 'evidenceHash', type: 'bytes32', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'StatusUpdated',
    type: 'event',
    inputs: [
      { name: 'disputeId', type: 'bytes32', indexed: true },
      { name: 'oldStatus', type: 'uint8', indexed: false },
      { name: 'newStatus', type: 'uint8', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// CREVerifier ABI
// ─────────────────────────────────────────────────────────────────────────────

export const VERIFIER_ABI = [
  {
    name: 'getVerdict',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'disputeId', type: 'bytes32' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'disputeId', type: 'bytes32' },
          { name: 'finalOutcome', type: 'uint8' },
          {
            name: 'modelVotes',
            type: 'tuple[3]',
            components: [
              { name: 'modelId', type: 'string' },
              { name: 'vote', type: 'uint8' },
              { name: 'confidenceBps', type: 'uint16' },
              { name: 'reasoningHash', type: 'bytes32' },
            ],
          },
          { name: 'consensusCount', type: 'uint8' },
          { name: 'evidenceHashA', type: 'bytes32' },
          { name: 'evidenceHashB', type: 'bytes32' },
          { name: 'executedAt', type: 'uint256' },
          { name: 'workflowRunId', type: 'bytes32' },
        ],
      },
    ],
  },
  // Events
  {
    name: 'ModelVoteRecorded',
    type: 'event',
    inputs: [
      { name: 'disputeId', type: 'bytes32', indexed: true },
      { name: 'modelId', type: 'string', indexed: false },
      { name: 'vote', type: 'uint8', indexed: false },
      { name: 'confidenceBps', type: 'uint16', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'ConsensusReached',
    type: 'event',
    inputs: [
      { name: 'disputeId', type: 'bytes32', indexed: true },
      { name: 'outcome', type: 'uint8', indexed: false },
      { name: 'winner', type: 'address', indexed: true },
      { name: 'consensusCount', type: 'uint8', indexed: false },
      { name: 'workflowRunId', type: 'bytes32', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'ConsensusFailure',
    type: 'event',
    inputs: [
      { name: 'disputeId', type: 'bytes32', indexed: true },
      { name: 'outcome', type: 'uint8', indexed: false },
      { name: 'consensusCount', type: 'uint8', indexed: false },
      { name: 'required', type: 'uint8', indexed: false },
      { name: 'workflowRunId', type: 'bytes32', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'CircuitBreakerActivated',
    type: 'event',
    inputs: [
      { name: 'disputeId', type: 'bytes32', indexed: true },
      { name: 'reason', type: 'string', indexed: false },
      { name: 'workflowRunId', type: 'bytes32', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

export const DISPUTE_STATUS: Record<number, string> = {
  0: 'None',
  1: 'Pending',
  2: 'Active',
  3: 'In Arbitration',
  4: 'Settled',
  5: 'Refunded',
  6: 'Escalated',
};

export const VERDICT_OUTCOME: Record<number, string> = {
  0: 'Party A Wins',
  1: 'Party B Wins',
  2: 'Insufficient Evidence',
  3: 'No Consensus',
  4: 'Circuit Breaker',
};

export const MODEL_NAMES: Record<string, string> = {
  'claude-opus-4-6': 'Claude Opus 4.6',
  'gpt-4o': 'GPT-4o',
  'mistral-large-2411': 'Mistral Large 2',
};
