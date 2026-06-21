# The Omniscient Contrarian — DoraHacks Submission

**Track 1: Autonomous Trading Agents** (BNB Hack: AI Trading Agent Edition — CoinMarketCap × Trust Wallet)

- **Agent wallet (on-chain proof):** `0xDcE101fA05df599C5aA3dA43c5588a724A0B9668`
- **Competition registry:** [`0x212c61b9b72c95d95bf29cf032f5e5635629aed5`](https://bsctrace.com/address/0x212c61b9b72c95d95bf29cf032f5e5635629aed5)
- **Chain:** BSC (execution) + Base (x402 data payments)

## The Strategy: Contrarian Mean-Reversion via Hype-vs-Flow Divergence

Most retail flow chases momentum. The Omniscient Contrarian does the opposite: it **fades crowded short-term moves that aren't backed by sustained volume**, and buys capitulation that is.

Each hour the agent pulls live metrics for its token universe from the **CoinMarketCap AI Agent Hub** in a single batched, x402-paid request, and computes a **Composite Conviction Score (0–100)** per token:

1. **Mean-reversion core** — fade the 24h move: a sharp dump pushes the score up (buy), a sharp pump pushes it down (sell).
2. **Hype-vs-flow divergence** (the contrarian edge):
   - Price **up** on **fading** volume → exhaustion → score lowered further (sell harder).
   - Price **down** on **fading** volume → sellers exhausted → score raised further (buy harder).
   - Moves on **surging** volume are faded *less* (don't fight a genuine flush or breakout).
3. **Weekly context + short-term reversal** as lighter adjustments.
4. **Market-regime tilt (Fear & Greed).** A market-wide contrarian gauge from the CMC Pro API tilts every token's score: in **Extreme Fear** the agent leans harder into buying capitulation; in **Extreme Greed** it leans harder into fading euphoria (±10 points at the extremes). This makes the strategy regime-aware, not just token-by-token.

**Score > 70 → BUY, < 30 → SELL, else HOLD.** Each epoch the agent opens up to N positions in the highest-conviction tokens (diversified, never re-buying one it already holds).

### Active exits (where the profit is realized)
Entries are only half the strategy. Every open position is tracked with its cost basis, and each epoch the agent exits on:
- **Take-profit** — close when a position is up ≥ `TAKE_PROFIT_PCT` (default 4%). This *books* the mean-reversion bounce and recycles the capital into the next signal.
- **Stop-loss** — close when down ≥ `STOP_LOSS_PCT` (default 5%), capping losers so no single position can run away.

This turns the contrarian thesis into a complete round-trip trader rather than a buy-and-hold basket.

### Data sources (hybrid)
- **x402 (CMC Agent Hub)** — per-request paid quotes, the in-loop data heartbeat (gasless EIP-3009 USDC on Base).
- **CMC Pro API** — Fear & Greed regime + global metrics (data x402 doesn't expose), and a reliability fallback for quotes if an x402 payment ever fails mid-competition.

## Why It's a Real Self-Custody Agent (not plumbing on an LLM)

- **Execution is self-custody, end-to-end.** Every swap is signed locally by the agent's own key (PancakeSwap V2 on BSC). Keys never leave the process; there is no third-party custody at any step. (A Trust Wallet Agent Kit execution path is also wired in behind `USE_TWAK` as an option.)
- **Native x402 in the trade loop.** Market data is paid for **per request** with x402 — a real EIP-3009 `transferWithAuthorization` (USDC on Base), settled gaslessly by the facilitator. This is the agent's data heartbeat, not a README mention. Routed through TWAK's native `twak x402 request` when enabled.
- **Guardrails the user sets.** Token allowlist (competition-eligible only), 5% slippage protection, per-trade and daily-cumulative caps, and a drawdown monitor.
- **Owner-in-the-loop kill switch.** On a drawdown breach the agent raises an override and waits for explicit owner approval (`POST /heartbeat/approve`); no response → automatic emergency liquidation to USDC. The human keeps the final say.

## Base currency & ranking correctness

The agent trades in a **USDT base** (USDT → token → USDT). USDT is an in-scope BEP-20, so the portfolio always sits in a competition-counted asset — never parked in uncounted native BNB between trades. BNB is held only to pay gas.

## Risk Management (the drawdown gate)

- Max drawdown monitored every epoch; breach triggers the owner-approval veto → emergency liquidation to **USDT** if unanswered.
- Per-trade cap ($15) and daily cumulative cap ($200) on notional.
- Daily heartbeat trade guarantees the ≥1 trade/day qualification without over-trading.

## Backtest

Run on a historical BNB price series (`npm run backtest`): the strategy correctly **faded a euphoric top** (short) and **bought a capitulation low** (long) — see `backtest/backtestEngine.ts`. Reported metrics include trade count, win rate, max drawdown, and total return.

## Stack

| Layer | Tech |
|---|---|
| Data | CoinMarketCap AI Agent Hub (x402 REST, batched) |
| Execution | Trust Wallet Agent Kit (`twak`) — self-custody signing + swaps + x402 |
| Identity / Commerce | BNB AI Agent SDK (ERC-8004 identity) + ERC-8183 signal publishing |
| Chain | BNB Smart Chain (PancakeSwap V2), Base (x402 settlement) |
| Runtime | TypeScript, ethers v6, Express status API |

## Reproduce

See `README.md`. Quick validation of the live x402 data path: `npx ts-node scripts/validateX402.ts` (~$0.01).
