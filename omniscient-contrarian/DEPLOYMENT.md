# Deployment Guide

## 1. Environment Configuration
Ensure your `.env` is fully populated.
- `TWAK_PRIVATE_KEY`: Your local wallet key (NEVER COMMIT THIS).
- `CMC_API_KEY`: Key for CoinMarketCap Agent Hub.

## 2. Deploy ERC-8183 Contract
Deploy the skill contract to the BSC network:
```bash
npx hardhat run scripts/deploy_erc8183.ts --network bscMainnet
```
Copy the deployed address to your `.env` as `ERC_8183_CONTRACT_ADDRESS`.

## 3. Register Agent On-Chain
Register the agent to officially enter the competition:
```bash
npx hardhat run scripts/register_agent.ts --network bscMainnet
```
*Note: This effectively calls `twak compete register` on-chain.*

## 4. Run the Agent
```bash
npm start
```
