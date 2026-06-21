import { fetchAllMetrics } from "../cmc/dataFusion";
import { fetchFearGreed } from "../cmc/cmcPro";
import { calculateScore, computeFactors } from "./convictionScore";
import { recordEntry, clearEntry, getOpenPositions } from "./positions";
import { monitorDrawdown, canExecuteTrade, recordTrade, getDailyTradeCount } from "./riskManager";
import { twakExecutor } from "../twak/twakExecutor";
import { logger } from "../utils/logger";
import { publishSignal } from "../sdk/skillMarketplace";
import { SCAN_TOKENS } from "./tokens";
import {
    setAgentStatus, setInitialPortfolio, updatePortfolio,
    updateConviction, updateDrawdown, setBestSignal, setLastScanResults,
    addTrade, updateHeartbeat, incrementEpoch, updateGuardrails,
    addLogEntry, setMarketRegime, ScanResult
} from "./agentState";

// Read a numeric env var, honoring an explicit 0 (plain `Number(x) || default`
// would wrongly fall back to the default when x is "0").
const envNum = (key: string, def: number): number => {
    const v = process.env[key];
    if (v === undefined || v === "") return def;
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
};

// All tunable via env so a fast verification run is possible without code changes.
const SLEEP_INTERVAL = envNum("SCAN_INTERVAL_MS", 60 * 60 * 1000);   // 1h default
// Position sizing: by default each trade is POSITION_SIZE_PCT of the live USDT balance
// (scales with capital). Set POSITION_SIZE_PCT=0 to use a fixed TRADE_SIZE_USD instead.
const POSITION_SIZE_PCT = envNum("POSITION_SIZE_PCT", 10);           // % of USDT per new position
const MIN_TRADE_USD = envNum("MIN_TRADE_USD", 2);                    // floor (avoid dust/high-impact trades)
const TRADE_SIZE_USD = envNum("TRADE_SIZE_USD", 3);                  // fixed size when POSITION_SIZE_PCT=0
// Guarantee the competition's >=1 trade/day: force a heartbeat trade early each UTC day
// if nothing has traded yet (HEARTBEAT_UTC_HOUR = hour by which the daily trade must exist).
const HEARTBEAT_UTC_HOUR = envNum("HEARTBEAT_UTC_HOUR", 1);
const BUY_THRESHOLD = envNum("BUY_THRESHOLD", 70);                   // score > => BUY
const SELL_THRESHOLD = envNum("SELL_THRESHOLD", 30);                 // score < => SELL
const PUBLISH_SIGNALS = process.env.PUBLISH_SIGNALS !== "false";     // on-chain ERC-8183 publish
const MAX_TRADES_PER_EPOCH = envNum("MAX_TRADES_PER_EPOCH", 3);      // diversify across top-N signals
const TAKE_PROFIT_PCT = envNum("TAKE_PROFIT_PCT", 4);               // sell a position up >= this %
const STOP_LOSS_PCT = envNum("STOP_LOSS_PCT", 5);                   // sell a position down >= this %
const MARKET_CRASH_PCT = envNum("MARKET_CRASH_PCT", -8);            // pause new buys if avg 24h below this AND still falling

// Default heartbeat token: CAKE is highly liquid on PancakeSwap
const HEARTBEAT_TOKEN = "CAKE";

// We additionally fetch BNB so we can value the portfolio at a real price.
const FETCH_SYMBOLS = [...SCAN_TOKENS, "BNB"];

export async function startAgentLoop() {
    setAgentStatus("RUNNING");
    addLogEntry("Agent loop initializing...");

    // Baseline is set on the first epoch using the SAME metrics-based valuation as
    // every subsequent epoch (so held tokens are counted identically and the change %
    // starts at ~0 instead of jumping).
    let initialPortfolioValue = 0;
    let baselineSet = false;

    logger.info(`Agent started. Scanning ${SCAN_TOKENS.length} tokens per epoch: ${SCAN_TOKENS.join(", ")}`);
    addLogEntry(`Scanning ${SCAN_TOKENS.length} tokens: ${SCAN_TOKENS.join(", ")}`);

    while (true) {
        try {
            incrementEpoch();
            updateHeartbeat();
            addLogEntry("═══ New epoch started ═══");

            logger.info("═══════════════════════════════════════");
            logger.info("  Starting new epoch");
            logger.info("═══════════════════════════════════════");

            // ── Step 1: One batched x402 data fetch for the whole epoch ──
            let metrics;
            try {
                metrics = await fetchAllMetrics(FETCH_SYMBOLS);
            } catch (err: any) {
                logger.error(`Data fetch failed this epoch: ${err.message}`);
                addLogEntry(`ERROR: data fetch failed (${err.message}). Skipping epoch.`);
                await new Promise(resolve => setTimeout(resolve, SLEEP_INTERVAL));
                continue;
            }
            const bnbPrice = metrics.get("BNB")?.price ?? 600;

            // Market-wide contrarian gauge (Pro key). Tilts every token's score.
            const fg = await fetchFearGreed();
            const marketCtx = { fearGreed: fg?.value };
            if (fg) {
                setMarketRegime(fg.value, fg.classification);
                addLogEntry(`Market regime: Fear & Greed ${fg.value} (${fg.classification})`);
            }

            // ── Step 2: Risk Check (real portfolio valuation) ──
            const currentValue = await twakExecutor.getPortfolioValue(metrics, bnbPrice);

            // Set the baseline on the first epoch (same valuation basis as ongoing).
            if (!baselineSet) {
                initialPortfolioValue = currentValue > 0 ? currentValue : 10000;
                setInitialPortfolio(initialPortfolioValue);
                baselineSet = true;
                logger.info(`Baseline portfolio value: $${initialPortfolioValue.toFixed(2)}`);
                addLogEntry(`Baseline portfolio: $${initialPortfolioValue.toFixed(2)}`);
            }

            updatePortfolio(currentValue);

            // Position size for this epoch: % of live USDT balance (or fixed if pct = 0).
            const usdtBalance = await twakExecutor.getUsdtBalance();
            const tradeSize = POSITION_SIZE_PCT > 0
                ? Math.max(MIN_TRADE_USD, Math.min(usdtBalance, (usdtBalance * POSITION_SIZE_PCT) / 100))
                : TRADE_SIZE_USD;

            const drawdown = initialPortfolioValue > 0
                ? ((initialPortfolioValue - currentValue) / initialPortfolioValue) * 100
                : 0;
            updateDrawdown(Math.max(0, drawdown));

            await monitorDrawdown(initialPortfolioValue, currentValue);
            addLogEntry(`Portfolio: $${currentValue.toFixed(2)} | Drawdown: ${drawdown.toFixed(2)}%`);

            // ── Step 3: Score every token from the batched metrics ──
            let bestSymbol = "";
            let bestScore = 50;
            let bestSide: "BUY" | "SELL" | "HOLD" = "HOLD";
            const scanResults: ScanResult[] = [];
            let bestFactors = { social: 50, flow: 50, funding: 50, news: 50 };

            for (const symbol of SCAN_TOKENS) {
                const m = metrics.get(symbol);
                if (!m) {
                    addLogEntry(`WARN: no data for ${symbol}`);
                    continue;
                }
                const score = calculateScore(m, marketCtx);
                logger.info(`  ${symbol} → Conviction Score: ${score}`);

                const action: "BUY" | "SELL" | "HOLD" = score > BUY_THRESHOLD ? "BUY" : score < SELL_THRESHOLD ? "SELL" : "HOLD";
                scanResults.push({ symbol, score, action });

                const deviation = Math.abs(score - 50);
                if (deviation > Math.abs(bestScore - 50)) {
                    bestSymbol = symbol;
                    bestScore = score;
                    bestSide = action;
                    bestFactors = computeFactors(m);
                }
            }

            setLastScanResults(scanResults);
            setBestSignal(bestSymbol ? { symbol: bestSymbol, score: bestScore, action: bestSide } : null);
            updateConviction(bestFactors.social, bestFactors.flow, bestFactors.funding, bestFactors.news, bestScore);

            logger.info(`  Best signal: ${bestSymbol} (score=${bestScore}, action=${bestSide})`);
            addLogEntry(`Best signal: ${bestSymbol || "NONE"} → Score ${bestScore} → ${bestSide}`);

            // ── Trend filter: pause NEW buys during a broad market freefall ──
            // Average 24h across the universe is deeply negative AND it's still dropping
            // (avg 1h < 0) → don't catch the falling market. Exits/stop-losses still run.
            const scanned = SCAN_TOKENS.map(s => metrics.get(s)).filter(Boolean) as { change24h: number; change1h: number }[];
            const avg = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
            const marketAvg24h = avg(scanned.map(m => m.change24h));
            const marketAvg1h = avg(scanned.map(m => m.change1h));
            const marketCrashing = marketAvg24h < MARKET_CRASH_PCT && marketAvg1h < 0;
            if (marketCrashing) {
                logger.warn(`  TREND FILTER: market in freefall (24h avg ${marketAvg24h.toFixed(1)}%, 1h ${marketAvg1h.toFixed(1)}%) — pausing new buys.`);
                addLogEntry(`⚠ Trend filter: market freefall (${marketAvg24h.toFixed(1)}% 24h) — new buys paused, exits still active.`);
            }

            // ── Step 4: Publish the best signal on-chain (ERC-8183) ──
            if (PUBLISH_SIGNALS) {
                await publishSignal(bestScore);
                addLogEntry(`Signal ${bestScore} published to ERC-8183 contract`);
            }

            // ── Step 4.5: Manage open positions — take profit / stop loss ──
            // This is what realizes the mean-reversion bounce and recycles capital.
            for (const { symbol, pos } of getOpenPositions()) {
                const m = metrics.get(symbol);
                if (!m || !m.price) continue;
                const pnlPct = ((m.price - pos.entryPrice) / pos.entryPrice) * 100;
                const hitTP = pnlPct >= TAKE_PROFIT_PCT;
                const hitSL = pnlPct <= -STOP_LOSS_PCT;
                if (!hitTP && !hitSL) continue;

                const tag = hitTP ? "TAKE-PROFIT" : "STOP-LOSS";
                logger.info(`  ${tag} ${symbol} at ${pnlPct.toFixed(1)}% — selling`);
                addLogEntry(`${tag} ${symbol} @ ${pnlPct.toFixed(1)}% → closing`);
                const r = await twakExecutor.executeTrade(symbol, "SELL", 0, m.price);
                if (r.success) {
                    recordTrade(r.amountUsd || tradeSize);
                    addTrade({
                        time: new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" }),
                        token: symbol, side: "SELL", amount: r.amountUsd, price: m.price, txHash: r.txHash,
                    });
                    addLogEntry(`✓ ${tag} ${symbol} closed (${pnlPct.toFixed(1)}%). Tx: ${r.txHash.slice(0, 10)}...`);
                    clearEntry(symbol);
                } else if ((r.reason || "").toLowerCase().includes("balance")) {
                    clearEntry(symbol); // position no longer in wallet — forget it
                } else {
                    addLogEntry(`✗ ${tag} ${symbol} sell failed: ${r.reason}`);
                }
            }

            // ── Step 5: Execute the top-N actionable signals (diversified) ──
            // Sort actionable signals by conviction extremity; trade up to MAX_TRADES_PER_EPOCH,
            // skipping any BUY for a token we already hold (so we build a basket, not a pile).
            const actionable = scanResults
                .filter(r => r.action !== "HOLD")
                .sort((a, b) => Math.abs(b.score - 50) - Math.abs(a.score - 50));

            let executed = 0;
            if (actionable.length > 0) {
                for (const sig of actionable) {
                    if (executed >= MAX_TRADES_PER_EPOCH) break;
                    if (!canExecuteTrade(tradeSize)) {
                        addLogEntry(`Guardrails blocked further trades this epoch.`);
                        break;
                    }
                    const price = metrics.get(sig.symbol)?.price ?? 0;
                    const side = sig.action as "BUY" | "SELL";

                    if (side === "BUY" && marketCrashing) {
                        continue; // trend filter: no new entries while the market is in freefall
                    }
                    if (side === "BUY" && await twakExecutor.hasPosition(sig.symbol, price, tradeSize * 0.5)) {
                        addLogEntry(`Already holding ${sig.symbol} — skipping re-buy`);
                        continue;
                    }

                    logger.info(`  Executing ${side} on ${sig.symbol} (score ${sig.score})...`);
                    addLogEntry(`Executing ${side} on ${sig.symbol} ($${tradeSize.toFixed(2)} USDT)...`);
                    const result = await twakExecutor.executeTrade(sig.symbol, side, tradeSize, price);

                    if (result.success) {
                        recordTrade(tradeSize);
                        addTrade({
                            time: new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" }),
                            token: sig.symbol,
                            side,
                            amount: result.amountUsd,
                            price,
                            txHash: result.txHash,
                        });
                        if (side === "BUY") recordEntry(sig.symbol, price, tradeSize);
                        else clearEntry(sig.symbol);
                        addLogEntry(`✓ ${side} ${sig.symbol} confirmed. Tx: ${result.txHash.slice(0, 10)}...`);
                        executed++;
                    } else {
                        addLogEntry(`✗ ${side} ${sig.symbol} FAILED: ${result.reason}`);
                    }
                }
            }

            if (executed === 0) {
                logger.info("  No new trades this epoch.");
                addLogEntry("No new trades this epoch (no fresh signals or already positioned).");
            }

            // ── Step 6: Heartbeat — GUARANTEE the competition's ≥1 trade/day ──
            // If nothing has traded yet this UTC day and we're past HEARTBEAT_UTC_HOUR,
            // force a small buy on a deep-liquid token (CAKE) so the daily minimum is met.
            const hbPrice = metrics.get(HEARTBEAT_TOKEN)?.price ?? 0;
            if (getDailyTradeCount() === 0 && new Date().getUTCHours() >= HEARTBEAT_UTC_HOUR) {
                logger.warn("  HEARTBEAT: no trade yet today — forcing the daily minimum trade...");
                addLogEntry("⚠ HEARTBEAT: forcing daily minimum trade (CAKE) to stay qualified...");
                if (canExecuteTrade(tradeSize)) {
                    const hbResult = await twakExecutor.executeTrade(HEARTBEAT_TOKEN, "BUY", tradeSize, hbPrice);
                    if (hbResult.success) {
                        recordTrade(tradeSize);
                        addTrade({
                            time: new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" }),
                            token: HEARTBEAT_TOKEN, side: "BUY", amount: hbResult.amountUsd, price: hbPrice, txHash: hbResult.txHash,
                        });
                        recordEntry(HEARTBEAT_TOKEN, hbPrice, tradeSize);
                        addLogEntry(`✓ Heartbeat CAKE BUY confirmed. Tx: ${hbResult.txHash.slice(0, 10)}...`);
                    } else {
                        addLogEntry(`✗ Heartbeat CAKE BUY FAILED: ${hbResult.reason}`);
                    }
                }
            }

            // Update guardrail counters in state
            updateGuardrails(getDailyTradeCount(), tradeSize * getDailyTradeCount());

            logger.info(`  Epoch complete. Daily trades: ${getDailyTradeCount()}. Sleeping ${SLEEP_INTERVAL / 1000 / 60} min.`);
            addLogEntry(`Epoch complete. Daily trades: ${getDailyTradeCount()}. Next epoch in 60 min.`);
            logger.info("═══════════════════════════════════════\n");

            await new Promise(resolve => setTimeout(resolve, SLEEP_INTERVAL));
        } catch (error: any) {
            logger.error("Error in agent loop:", error);
            addLogEntry(`ERROR: ${error.message}`);
            setAgentStatus("ERROR");
            await new Promise(resolve => setTimeout(resolve, 60000));
            setAgentStatus("RUNNING");
        }
    }
}
