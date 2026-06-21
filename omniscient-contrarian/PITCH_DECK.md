# Demo Video Storyboard (≈2 min)

Goal: show the **self-custody + autonomous-signing loop end to end**, backed by on-chain proof. Keep it tight; the judges score "demo clearly shows the loop, with a BSC tx hash."

## Scene 1 — Data, paid per request with x402 (~20s)
- **Visual:** terminal running `npx ts-node scripts/validateX402.ts` (or the live agent log).
- **Beat:** log shows `402 → Signed EIP-3009 auth for 0.01 USD Coin on eip155:8453 → x402 payment accepted`, then real metrics (price, 24h%, volume).
- **Say:** "Every data pull is paid per-request with x402 — a gasless EIP-3009 USDC authorization. This is the agent's heartbeat, not a mock."

## Scene 2 — The contrarian brain (≈25s)
- **Visual:** epoch log scoring the token universe; `Best signal: <TOKEN> → Score <n> → BUY/SELL`.
- **Say:** "It fades crowded moves that aren't backed by volume — pump on fading volume = sell; capitulation = buy. Score >70 buys, <30 sells."

## Scene 3 — Self-custody execution via TWAK (≈25s)
- **Visual:** log `TWAK CLI: swap 0.005 BNB <TOKEN> on bsc` → tx submitted. (Or the ethers fallback signing line.)
- **Say:** "Execution is self-custody — the agent signs its own swap through the Trust Wallet Agent Kit. Keys never leave; no third-party custody."

## Scene 4 — On-chain proof (≈20s)
- **Visual:** BscScan open on the agent wallet `0xDcE1…9668` showing the confirmed swap tx hash.
- **Say:** "Here's the trade on BSC — real, signed by the agent."

## Scene 5 — Owner-in-the-loop kill switch (≈25s)
- **Visual:** trigger a drawdown breach; log raises an override; show `GET /heartbeat/status` (pending). Don't approve → log `No owner approval → safe liquidation`. (Or `POST /heartbeat/approve` to show the human keeping it alive.)
- **Say:** "On a drawdown breach the agent asks the owner. No answer means it de-risks to USDC automatically. The human keeps the final say."

## Closing card
- Agent wallet + competition registry address; one line: "Contrarian mean-reversion, self-custody, x402-native. Built on CMC Agent Hub + TWAK + BNB Chain."
