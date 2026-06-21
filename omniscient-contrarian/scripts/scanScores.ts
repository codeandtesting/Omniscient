/** Show live contrarian scores for all scan tokens (free, Pro key) to pick test thresholds. */
import { fetchFearGreed, fetchQuotesPro } from "../src/cmc/cmcPro";
import { calculateScore } from "../src/core/convictionScore";
import { SCAN_TOKENS } from "../src/core/tokens";

(async () => {
    const fg = await fetchFearGreed();
    const metrics = await fetchQuotesPro(SCAN_TOKENS);
    console.log(`Fear & Greed: ${fg?.value} (${fg?.classification})\n`);
    const rows: { sym: string; score: number; c24: number }[] = [];
    for (const sym of SCAN_TOKENS) {
        const m = metrics.get(sym);
        if (!m) continue;
        rows.push({ sym, score: calculateScore(m, { fearGreed: fg?.value }), c24: m.change24h });
    }
    rows.sort((a, b) => b.score - a.score);
    for (const r of rows) {
        console.log(`  ${r.sym.padEnd(6)} score=${String(r.score).padStart(3)}  24h=${r.c24.toFixed(2)}%`);
    }
    const max = Math.max(...rows.map(r => r.score)), min = Math.min(...rows.map(r => r.score));
    console.log(`\n  range: ${min}..${max}`);
})();
