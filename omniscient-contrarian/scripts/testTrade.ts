/**
 * One controlled live trade through the real executor.
 *   BUY:  npx ts-node scripts/testTrade.ts BUY CAKE 1
 *   SELL: npx ts-node scripts/testTrade.ts SELL CAKE
 */
import { twakExecutor } from "../src/twak/twakExecutor";

(async () => {
    const side = (process.argv[2] || "BUY").toUpperCase() as "BUY" | "SELL";
    const token = process.argv[3] || "CAKE";
    const usd = Number(process.argv[4] || "1");
    console.log(`Attempting ${side} ${token}${side === "BUY" ? ` for $${usd} USDT` : " (full balance)"}...`);

    const result = await twakExecutor.executeTrade(token, side, usd);

    if (result.success) {
        console.log(`✅ ${side} LANDED. Tx: https://bscscan.com/tx/${result.txHash}`);
        console.log(`   Notional: ~$${result.amountUsd}`);
    } else {
        console.log(`❌ ${side} FAILED: ${result.reason}`);
        process.exit(1);
    }
})();
