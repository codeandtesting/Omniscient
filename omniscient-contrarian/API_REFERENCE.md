# API Reference

## CMC Hub Endpoints Used
- `/social/sentiment`: Fetches social hype metrics.
- `/onchain/flow`: Monitors large wallet movements (whales).
- `/derivatives/funding`: Checks funding rates to gauge over-leverage.
- `/news/latest`: Evaluates news sentiment.

## TWAK Methods
- `twak.signAndSend()`: Used by `twakExecutor` to execute swaps locally.
- `twak.walletConnect.request()`: Used for the daily heartbeat veto.
- `twak.x402.pay()`: Handles x402 micropayments for CMC data.

## BNB SDK Methods
- `sdk.registerIdentity()`: For ERC-8004 registration on BSC.
- `sdk.deploySkill()`: To create the ERC-8183 Skill subscription.
