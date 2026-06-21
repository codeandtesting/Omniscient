import { MarketMetrics } from "../cmc/cmcClient";

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

/** Market-wide context that tilts the per-token contrarian signal. */
export interface MarketContext {
    fearGreed?: number; // 0 (extreme fear) .. 100 (extreme greed)
}

/**
 * The Composite Conviction Score — a genuine CONTRARIAN mean-reversion signal.
 *
 *   > 70  → BUY  (the crowd is capitulating / oversold; fade the panic)
 *   < 30  → SELL (the crowd is euphoric / overbought; fade the hype)
 *   ~ 50  → HOLD
 *
 * The core thesis ("hype vs flow divergence"): a price move that is NOT backed by
 * sustained volume is exhaustion, and we fade it harder. A move that IS backed by
 * surging volume gets faded less (don't fight a real flush / real breakout).
 */
export function calculateScore(m: MarketMetrics, ctx?: MarketContext): number {
    let score = 50;

    // 1) Primary mean-reversion: fade the 24h move. Dump -> bullish, pump -> bearish.
    score += -m.change24h * 1.5;

    // 2) Weekly context: lean against an extended 7d trend (lighter weight).
    score += -m.change7d * 0.3;

    // 3) Hype-vs-flow divergence (the contrarian heart of the strategy).
    if (m.change24h > 0 && m.volumeChange24h < 0) score -= 8;  // pump on fading volume = exhaustion → sell harder
    if (m.change24h < 0 && m.volumeChange24h < 0) score += 8;  // dump on fading volume = sellers exhausted → buy harder
    if (m.change24h > 0 && m.volumeChange24h > 50) score += 5; // pump on heavy real inflow → don't fade as hard
    if (m.change24h < 0 && m.volumeChange24h > 50) score -= 5; // dump on heavy volume = distribution → don't catch the knife

    // 4) Short-term reversal nudge.
    score += -m.change1h * 0.5;

    // 5) Market-regime tilt (Fear & Greed): contrarian at the index level too.
    //    Extreme Fear → tilt UP (buy capitulation harder); Extreme Greed → tilt DOWN
    //    (fade euphoria harder). Max ±10 points at the extremes.
    if (ctx?.fearGreed !== undefined) {
        score += ((50 - ctx.fearGreed) / 50) * 10;
    }

    return clamp(Math.round(score));
}

/**
 * Human-readable factor breakdown for the dashboard. These are REAL derived values
 * (not placeholders). Field names are kept for frontend compatibility; their actual
 * meaning is documented here:
 *   social  -> Hype       : how stretched 24h price is (>50 = pumped up)
 *   flow    -> Volume Flow : 24h volume direction (>50 = volume rising)
 *   funding -> Turnover    : daily volume / market cap, scaled (activity intensity)
 *   news    -> Weekly Trend: 7d price direction (>50 = up week)
 */
export interface ConvictionFactors {
    social: number;
    flow: number;
    funding: number;
    news: number;
}

export function computeFactors(m: MarketMetrics): ConvictionFactors {
    return {
        social: Math.round(clamp(50 + m.change24h * 2)),
        flow: Math.round(clamp(50 + m.volumeChange24h / 2)),
        funding: Math.round(clamp(m.turnover * 1000)),
        news: Math.round(clamp(50 + m.change7d)),
    };
}
