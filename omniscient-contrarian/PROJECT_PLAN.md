# Project Plan: The Omniscient Contrarian

## The "Why"
The Contrarian strategy works by finding divergences between social hype and actual on-chain flow. By combining four distinct data layers, the agent identifies when retail sentiment is irrationally exuberant while whales are exiting, allowing it to fade the crowd effectively.

## Winning Strategy
- **Track 1 Grand Prize**: Uses strict risk management (max 10% daily loss, 20% position size) to keep max drawdown < 30% while securing consistent PnL.
- **Track 2 Strategy Skill**: Exposes the Composite Conviction Score via CMC Skill.
- **TWAK Special**: Dual-mode custody with autonomous execution and a WalletConnect heartbeat veto.
- **Agent Hub Special**: Aggregates Social, On-Chain Flow, Derivatives Funding, and News using CMC Agent Hub.
- **BNB SDK Special**: Registers via ERC-8004 and monetizes the signal through an ERC-8183 skill contract.

## Timeline
- **Week 1**: Set up CMC data fusion, x402 micropayments, and Conviction Score logic.
- **Week 2**: Integrate TWAK for local signing, build risk manager and heartbeat veto. Deploy ERC-8183.
- **Week 3**: Final integration, backtesting, tuning weights, and executing registration before June 22.
