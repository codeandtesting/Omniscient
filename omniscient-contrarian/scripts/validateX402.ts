/**
 * One-shot validation of the live x402 data path. Costs ~$0.01 USDC on Base.
 * Run: npx ts-node scripts/validateX402.ts
 */
import { fetchMarketData } from "../src/cmc/cmcClient";

(async () => {
    try {
        console.log("Requesting BNB + CAKE from CMC Agent Hub via x402...");
        const data = await fetchMarketData(["BNB", "CAKE"]);
        if (data.size === 0) {
            console.error("❌ No metrics returned — request returned 200 but body was empty/unparsed.");
            process.exit(1);
        }
        for (const [sym, m] of data) {
            console.log(`✅ ${sym}: price=$${m.price?.toFixed(4)} | 24h=${m.change24h?.toFixed(2)}% | 7d=${m.change7d?.toFixed(2)}% | volΔ=${m.volumeChange24h?.toFixed(2)}% | turnover=${m.turnover?.toFixed(4)}`);
        }
        console.log("✅ x402 end-to-end path WORKS.");
        const { getAgentState } = await import("../src/core/agentState");
        const last = getAgentState().x402Transactions[0];
        if (last?.txHash) console.log(`   Base settlement tx: https://basescan.org/tx/${last.txHash}`);
    } catch (e: any) {
        console.error("❌ x402 validation FAILED.");
        console.error("status:", e.response?.status);
        console.error("body:", JSON.stringify(e.response?.data)?.slice(0, 500));
        console.error("message:", e.message);
        process.exit(1);
    }
})();
