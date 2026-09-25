#!/bin/bash
# deploy.sh — Deploy NIKO SUN contract to Stellar Testnet
# Usage: ./scripts/deploy.sh [network]
#   network: testnet (default) | mainnet

set -e

NETWORK=${1:-testnet}
CONTRACT_NAME="niko_project"
WASM_PATH="target/wasm32v1-none/release/${CONTRACT_NAME}.wasm"

echo "🌞 NIKO SUN — Stellar Contract Deployment"
echo "=========================================="
echo "Network: $NETWORK"
echo ""

# Check stellar CLI
if ! command -v stellar &> /dev/null; then
    echo "❌ stellar CLI not found. Install it:"
    echo "   cargo install --locked stellar-cli"
    exit 1
fi

# Check WASM file
if [ ! -f "$WASM_PATH" ]; then
    echo "📦 Building contract..."
    stellar contract build
fi

if [ ! -f "$WASM_PATH" ]; then
    echo "❌ WASM not found at $WASM_PATH"
    exit 1
fi

# Generate or use existing deployer key
DEPLOYER="niko_deployer"
if ! stellar keys address $DEPLOYER --network $NETWORK 2>/dev/null; then
    echo "🔑 Generating deployer keypair..."
    stellar keys generate $DEPLOYER --network $NETWORK --fund
fi

DEPLOYER_ADDR=$(stellar keys address $DEPLOYER --network $NETWORK)
echo "📋 Deployer: $DEPLOYER_ADDR"

# Deploy contract with constructor arguments
# The native XLM Stellar Asset Contract is the payment token.
echo ""
echo "🚀 Deploying $CONTRACT_NAME..."
NATIVE_TOKEN=$(stellar contract id asset --asset native --network "$NETWORK")
CONTRACT_ID=$(stellar contract deploy \
    --wasm "$WASM_PATH" \
    --source-account $DEPLOYER \
    --network $NETWORK \
    --alias niko_sun \
    -- \
    --admin "$DEPLOYER_ADDR" \
    --token "$NATIVE_TOKEN")

echo ""
echo "✅ Contract deployed with constructor!"
echo "   Contract ID: $CONTRACT_ID"
echo "   Alias: niko_sun"
echo ""
echo "📝 Save this Contract ID for frontend:"
echo "   $CONTRACT_ID"
echo ""
echo "💡 Update frontend/.env.local:"
echo "   NEXT_PUBLIC_CONTRACT_ID=$CONTRACT_ID"
echo "   NEXT_PUBLIC_STELLAR_NETWORK=$NETWORK"
