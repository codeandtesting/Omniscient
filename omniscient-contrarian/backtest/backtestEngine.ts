import * as fs from "fs";
import * as path from "path";
import { calculateScore } from "../src/core/convictionScore";
import { MarketMetrics } from "../src/cmc/cmcClient";

/**
 * Backtest the CONTRARIAN strategy on a historical price series.
 *
 * For each day we derive the same metrics the live agent uses (24h / 7d price
 * change) from the price column, score them, and take a position. PnL is then the
 * REAL next-day return of that position — not a fixed fake profit.
 */
function buildMetrics(prices: number[], i: number): MarketMetrics {
    const price = prices[i];
    const prev = prices[i - 1] ?? price;
    const weekAgo = prices[i - 7] ?? prices[0];
    const change24h = prev ? ((price - prev) / prev) * 100 : 0;
    const change7d = weekAgo ? ((price - weekAgo) / weekAgo) * 100 : 0;
    return {
        symbol: "BT",
        price,
        change1h: 0,
        change24h,
        change7d,
        volume24h: 0,
        volumeChange24h: 0, // not available in this dataset → divergence rules stay neutral
        marketCap: 0,
        turnover: 0,
    };
}

async function runBacktest() {
    console.log("Starting Backtest Engine (contrarian, price-driven)...");

    const csvPath = path.join(__dirname, "historicalData.csv");
    if (!fs.existsSync(csvPath)) {
        console.error("Historical data CSV not found!");
        return;
    }

    const rows = fs.readFileSync(csvPath, "utf-8").split("\n").slice(1).filter(l => l.trim());
    const dates: string[] = [];
    const prices: number[] = [];
    for (const line of rows) {
        const [date, priceStr] = line.split(",");
        dates.push(date);
        prices.push(parseFloat(priceStr));
    }

    let capital = 10000;
    let position: 0 | 1 | -1 = 0; // flat / long / short
    let episodeStart = capital;   // capital when the current position was opened
    let totalTrades = 0;
    let wins = 0;
    let peak = capital;
    let maxDrawdown = 0;

    const closeEpisode = () => {
        if (position !== 0) {
            totalTrades++;
            if (capital > episodeStart) wins++;
        }
    };

    for (let i = 1; i < prices.length - 1; i++) {
        const metrics = buildMetrics(prices, i);
        const score = calculateScore(metrics);

        // Determine target position from the contrarian signal.
        let target: 0 | 1 | -1 = position;
        if (score > 70) target = 1;
        else if (score < 30) target = -1;

        if (target !== position) {
            closeEpisode();            // realise the prior position as one trade
            position = target;
            episodeStart = capital;
            console.log(`[${dates[i]}] ${position === 1 ? "LONG " : "SHORT"} @ ${prices[i]} (score ${score})`);
        }

        // Mark-to-market the current position on the next day's return.
        const ret = (prices[i + 1] - prices[i]) / prices[i];
        capital *= (1 + position * ret);

        peak = Math.max(peak, capital);
        maxDrawdown = Math.max(maxDrawdown, (peak - capital) / peak);
    }
    closeEpisode(); // realise the final open position

    const totalPnl = ((capital - 10000) / 10000) * 100;
    console.log("=== Backtest Results ===");
    console.log(`Total Trades:  ${totalTrades}`);
    console.log(`Win Rate:      ${totalTrades ? ((wins / totalTrades) * 100).toFixed(2) : "0.00"}%`);
    console.log(`Max Drawdown:  ${(maxDrawdown * 100).toFixed(2)}%`);
    console.log(`Total PnL:     ${totalPnl.toFixed(2)}%`);
    console.log(`Final Capital: $${capital.toFixed(2)}`);
}

runBacktest();
