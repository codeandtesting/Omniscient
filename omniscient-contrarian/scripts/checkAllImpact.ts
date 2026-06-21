/** Check price impact across ALL eligible (mapped) tokens to build the widest safe scan list. */
import { ethers } from "ethers";
import { fetchQuotesPro } from "../src/cmc/cmcPro";
import { ELIGIBLE_TOKENS, getTokenAddress } from "../src/core/tokens";

const ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
const ABI = ["function getAmountsOut(uint amountIn, address[] path) view returns (uint[])"];
const ERC = ["function decimals() view returns (uint8)"];
const TRADE = 1.5;
const MAX_IMPACT = Number(process.env.MAX_PRICE_IMPACT ?? 2);
const SKIP = new Set(["USDT", "USDC", "WBNB", "DAI", "TUSD", "FDUSD"]);

(async () => {
    const provider = new ethers.JsonRpcProvider("https://bsc-dataseed1.binance.org");
    const router = new ethers.Contract(ROUTER, ABI, provider);
    const usdt = getTokenAddress("USDT"), wbnb = getTokenAddress("WBNB");
    const amountIn = ethers.parseUnits(TRADE.toString(), 18);

    const symbols = Object.keys(ELIGIBLE_TOKENS).filter((s) => !SKIP.has(s));
    const prices = await fetchQuotesPro(symbols);

    const ok: { sym: string; impact: number }[] = [];
    for (const sym of symbols) {
        const px = prices.get(sym)?.price;
        if (!px) continue;
        try {
            const tokenAddr = getTokenAddress(sym);
            const dec = await new ethers.Contract(tokenAddr, ERC, provider).decimals();
            const out = (await router.getAmountsOut(amountIn, [usdt, wbnb, tokenAddr]))[2];
            const outUsd = Number(ethers.formatUnits(out, dec)) * px;
            const impact = ((TRADE - outUsd) / TRADE) * 100;
            if (impact <= MAX_IMPACT) ok.push({ sym, impact });
        } catch { /* no route */ }
    }
    ok.sort((a, b) => a.impact - b.impact);
    console.log(`Deep-liquidity eligible tokens (impact <= ${MAX_IMPACT}% on $${TRADE}):\n`);
    for (const r of ok) console.log(`  ${r.sym.padEnd(7)} ${r.impact.toFixed(2)}%`);
    console.log(`\nScan list (${ok.length}): ${ok.map((r) => `"${r.sym}"`).join(", ")}`);
})();
