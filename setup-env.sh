#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# ArbitrAI — post-deployment environment setup
# Reads deployments.json and writes .env files for frontend, CRE workflow,
# and evidence server so nothing needs to be copy-pasted manually.
#
# Usage: bash setup-env.sh
# Run after: forge script script/Deploy.s.sol --broadcast
# ─────────────────────────────────────────────────────────────────────────────

set -e

DEPLOY_FILE="$(dirname "$0")/deployments.json"

if [ ! -f "$DEPLOY_FILE" ]; then
  echo "ERROR: deployments.json not found. Run deploy first."
  exit 1
fi

# Parse JSON without jq (pure bash)
ESCROW=$(grep -o '"DisputeEscrow": *"[^"]*"' "$DEPLOY_FILE" | grep -o '0x[0-9a-fA-F]*')
REGISTRY=$(grep -o '"ArbitrationRegistry": *"[^"]*"' "$DEPLOY_FILE" | grep -o '0x[0-9a-fA-F]*')
VERIFIER=$(grep -o '"CREVerifier": *"[^"]*"' "$DEPLOY_FILE" | grep -o '0x[0-9a-fA-F]*')
OPERATOR=$(grep -o '"creOperator": *"[^"]*"' "$DEPLOY_FILE" | grep -o '0x[0-9a-fA-F]*')

if [ -z "$ESCROW" ] || [ -z "$REGISTRY" ] || [ -z "$VERIFIER" ]; then
  echo "ERROR: Could not parse contract addresses from deployments.json"
  cat "$DEPLOY_FILE"
  exit 1
fi

echo "Parsed addresses:"
echo "  DisputeEscrow:       $ESCROW"
echo "  ArbitrationRegistry: $REGISTRY"
echo "  CREVerifier:         $VERIFIER"
echo "  CRE Operator:        $OPERATOR"

# ── Load existing root .env (for API keys etc) ───────────────────────────────
ROOT_ENV="$(dirname "$0")/.env"
if [ ! -f "$ROOT_ENV" ]; then
  echo ""
  echo "WARNING: No root .env found. Creating from .env.example"
  cp "$(dirname "$0")/.env.example" "$ROOT_ENV"
  echo "Fill in API keys in .env before continuing."
fi

# Source root env to inherit API keys
set -a
source "$ROOT_ENV" 2>/dev/null || true
set +a

# ── frontend/.env ─────────────────────────────────────────────────────────────
cat > "$(dirname "$0")/frontend/.env" << EOF
VITE_ESCROW_ADDRESS=$ESCROW
VITE_REGISTRY_ADDRESS=$REGISTRY
VITE_VERIFIER_ADDRESS=$VERIFIER
VITE_CHAIN_ID=11155111
VITE_EVIDENCE_SERVER_URL=${EVIDENCE_SERVER_URL:-http://localhost:3002}
VITE_EVIDENCE_SERVER_KEY=${EVIDENCE_SERVER_KEY:-arbitrai-dev-key-change-in-production}
EOF
echo "Written: frontend/.env"

# ── cre-workflow/.env ─────────────────────────────────────────────────────────
cat > "$(dirname "$0")/cre-workflow/.env" << EOF
# AI APIs
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}
OPENAI_API_KEY=${OPENAI_API_KEY:-}
MISTRAL_API_KEY=${MISTRAL_API_KEY:-}

# CRE Operator
OPERATOR_PRIVATE_KEY=${CRE_OPERATOR_PRIVATE_KEY:-}

# Evidence Server
EVIDENCE_SERVER_KEY=${EVIDENCE_SERVER_KEY:-arbitrai-dev-key-change-in-production}
EVIDENCE_SERVER_URL=${EVIDENCE_SERVER_URL:-http://localhost:3002}

# Ethereum
RPC_URL=${SEPOLIA_RPC_URL:-}
CHAIN_ID=11155111

# Contracts
REGISTRY_CONTRACT=$REGISTRY
VERIFIER_CONTRACT=$VERIFIER

# Testing
DISPUTE_ID=
SUBMIT_ONCHAIN=false
EOF
echo "Written: cre-workflow/.env"

# ── contracts/.env ────────────────────────────────────────────────────────────
cat > "$(dirname "$0")/contracts/.env" << EOF
SEPOLIA_RPC_URL=${SEPOLIA_RPC_URL:-}
DEPLOYER_PRIVATE_KEY=${DEPLOYER_PRIVATE_KEY:-}
ETHERSCAN_API_KEY=${ETHERSCAN_API_KEY:-}
CRE_OPERATOR_ADDRESS=$OPERATOR
CRE_OPERATOR_PRIVATE_KEY=${CRE_OPERATOR_PRIVATE_KEY:-}

# Deployed addresses
ESCROW_ADDRESS=$ESCROW
REGISTRY_ADDRESS=$REGISTRY
VERIFIER_ADDRESS=$VERIFIER
EOF
echo "Written: contracts/.env"

# ── evidence-server/.env ──────────────────────────────────────────────────────
cat > "$(dirname "$0")/evidence-server/.env" << EOF
PORT=3002
EVIDENCE_SERVER_KEY=${EVIDENCE_SERVER_KEY:-arbitrai-dev-key-change-in-production}
SERVER_SECRET=${SERVER_SECRET:-$(openssl rand -hex 32 2>/dev/null || echo "change-this-secret")}
EOF
echo "Written: evidence-server/.env"

echo ""
echo "All .env files configured."
echo ""
echo "Next steps:"
echo "  1. cd evidence-server && npm start"
echo "  2. cd cre-workflow && DISPUTE_ID=<id> npm run simulate"
echo "  3. cd frontend && npm run dev"
