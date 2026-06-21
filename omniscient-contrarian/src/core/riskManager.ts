import { requestOverride } from "../twak/twakHeartbeat";
import { twakExecutor } from "../twak/twakExecutor";
import { logger } from "../utils/logger";

// ── Guardrail Configuration (USD-denominated, since the agent trades in USDT base) ──
// Per-trade / daily caps are env-configurable so %-of-balance sizing scales with capital.
const MAX_DRAWDOWN = 0.15;                                                      // 15% max drawdown before veto
const MAX_PER_TRADE_USD = Number(process.env.MAX_PER_TRADE_USD ?? 100);         // max notional per single trade
const MAX_DAILY_CUMULATIVE_USD = Number(process.env.MAX_DAILY_CUMULATIVE_USD ?? 2000); // max total notional per day
const MAX_TRADES_PER_DAY = 1000;       // Hard cap on daily trade count

// ── Daily State Tracker ──
let dailySpentUsd = 0;
let dailyTradeCount = 0;
// Initialize to startup time so the 23h heartbeat counts from launch (not epoch 0),
// otherwise a fresh process would force a "missed daily trade" immediately on every start.
let lastTradeTimestamp = Date.now();
let currentDay = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"

function resetDailyIfNeeded(): void {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== currentDay) {
        logger.info(`Risk Manager: New day detected (${today}). Resetting daily limits.`);
        dailySpentUsd = 0;
        dailyTradeCount = 0;
        currentDay = today;
    }
}

/**
 * Validates whether a trade is allowed under the current guardrails.
 * Returns true if the trade can proceed, false if blocked.
 */
export function canExecuteTrade(tradeSizeUsd: number): boolean {
    resetDailyIfNeeded();

    if (tradeSizeUsd > MAX_PER_TRADE_USD) {
        logger.warn(`Risk Manager: Trade size $${tradeSizeUsd} exceeds per-trade limit of $${MAX_PER_TRADE_USD}. BLOCKED.`);
        return false;
    }

    if (dailySpentUsd + tradeSizeUsd > MAX_DAILY_CUMULATIVE_USD) {
        logger.warn(`Risk Manager: Daily cumulative spend would be $${(dailySpentUsd + tradeSizeUsd).toFixed(2)}, exceeding limit of $${MAX_DAILY_CUMULATIVE_USD}. BLOCKED.`);
        return false;
    }

    if (dailyTradeCount >= MAX_TRADES_PER_DAY) {
        logger.warn(`Risk Manager: Daily trade count (${dailyTradeCount}) has reached limit of ${MAX_TRADES_PER_DAY}. BLOCKED.`);
        return false;
    }

    return true;
}

/**
 * Records a successfully executed trade against the daily counters.
 */
export function recordTrade(tradeSizeUsd: number): void {
    resetDailyIfNeeded();
    dailySpentUsd += tradeSizeUsd;
    dailyTradeCount += 1;
    lastTradeTimestamp = Date.now();
    logger.info(`Risk Manager: Trade recorded. Daily total: $${dailySpentUsd.toFixed(2)} across ${dailyTradeCount} trades.`);
}

/**
 * Returns the timestamp of the last executed trade (for heartbeat checks).
 */
export function getLastTradeTimestamp(): number {
    return lastTradeTimestamp;
}

/**
 * Returns the current daily trade count (for status API).
 */
export function getDailyTradeCount(): number {
    resetDailyIfNeeded();
    return dailyTradeCount;
}

/**
 * Monitors the portfolio drawdown.
 * If drawdown > 15%, trigger WalletConnect override.
 * If not responded to, liquidate to USDC.
 */
export async function monitorDrawdown(initialValue: number, currentValue: number) {
    if (initialValue <= 0) return;
    
    const drawdown = (initialValue - currentValue) / initialValue;
    logger.info(`Current Drawdown: ${(drawdown * 100).toFixed(2)}%`);
    
    if (drawdown > MAX_DRAWDOWN) {
        logger.warn(`DRAWDOWN EXCEEDS ${MAX_DRAWDOWN * 100}%! Triggering heartbeat veto.`);
        
        const approved = await requestOverride();
        
        if (!approved) {
            logger.error("Heartbeat veto missed or rejected! Executing emergency liquidation to USDC.");
            await twakExecutor.emergencyLiquidate();
        } else {
            logger.info("Heartbeat veto approved. Continuing operation despite drawdown.");
        }
    }
}

