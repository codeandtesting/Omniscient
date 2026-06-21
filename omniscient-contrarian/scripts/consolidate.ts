/**
 * Sell every held token position back to USDT. Does NOT touch native BNB (gas).
 * Run: npx ts-node scripts/consolidate.ts
 */
import { ethers } from "ethers";
import { twakExecutor } from "../src/twak/twakExecutor";
import { ELIGIBLE_TOKENS, getTokenAddress } from "../src/core/tokens";
import * as dotenv from "dotenv";

dotenv.config();

const ERC = ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"];
const SKIP = new Set(["USDT", "USDC", "WBNB", "DAI", "TUSD", "FDUSD"]); // base/stables — don't sell

(async () => {
    const provider = new ethers.JsonRpcProvider(process.env.BSC_RPC_URL);
    const addr = twakExecutor._address();

    let sold = 0;
    for (const sym of Object.keys(ELIGIBLE_TOKENS)) {
        if (SKIP.has(sym)) continue;
        try {
            const c = new ethers.Contract(getTokenAddress(sym), ERC, provider);
            const bal: bigint = await c.balanceOf(addr);
            if (bal === 0n) continue;
            console.log(`Selling ${sym}...`);
            const r = await twakExecutor.executeTrade(sym, "SELL");
            console.log(r.success ? `  ✓ ${sym} -> ~$${r.amountUsd.toFixed(2)} USDT (${r.txHash})` : `  ✗ ${sym}: ${r.reason}`);
            if (r.success) sold++;
        } catch (e: any) {
            console.log(`  ${sym} error: ${e.message}`);
        }
    }

    const usdt = new ethers.Contract(getTokenAddress("USDT"), ERC, provider);
    const [u, bnb] = await Promise.all([usdt.balanceOf(addr), provider.getBalance(addr)]);
    console.log(`\nDone. Sold ${sold} position(s).`);
    console.log(`Final USDT: ${Number(ethers.formatUnits(u, 18)).toFixed(2)} | BNB kept (gas): ${Number(ethers.formatEther(bnb)).toFixed(5)}`);
})();
