/** Validates the Pro-key smart layer: Fear & Greed regime + its effect on scores. Free (Pro key). */
import { fetchFearGreed, fetchGlobalMetrics, fetchQuotesPro } from "../src/cmc/cmcPro";
import { calculateScore } from "../src/core/convictionScore";

(async () => {
    const fg = await fetchFearGreed();
    const gm = await fetchGlobalMetrics();
    console.log(`Fear & Greed: ${fg?.value} (${fg?.classification})`);
    console.log(`Global: total mcap $${(gm?.totalMarketCap ?? 0 / 1e9).toFixed?.(0)} | BTC dominance ${gm?.btcDominance?.toFixed(1)}%`);

    const metrics = await fetchQuotesPro(["BNB", "CAKE", "ETH"]);
    console.log("\nScore WITHOUT regime  vs  WITH regime tilt:");
    for (const [sym, m] of metrics) {
        const base = calculateScore(m);
        const tilted = calculateScore(m, { fearGreed: fg?.value });
        const action = tilted > 70 ? "BUY" : tilted < 30 ? "SELL" : "HOLD";
        console.log(`  ${sym.padEnd(5)} 24h=${m.change24h.toFixed(2)}%  base=${base}  tilted=${tilted}  → ${action}`);
    }
})();
