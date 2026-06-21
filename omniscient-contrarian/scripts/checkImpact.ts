/** Free: show real price impact of a $TRADE buy for each scan token (USDT->WBNB->token). */
import { ethers } from "ethers";
import { fetchQuotesPro } from "../src/cmc/cmcPro";
import { SCAN_TOKENS, getTokenAddress } from "../src/core/tokens";

const ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
const ABI = ["function getAmountsOut(uint amountIn, address[] path) view returns (uint[])"];
const ERC = ["function decimals() view returns (uint8)"];
const TRADE = 1.5;
const MAX_IMPACT = Number(process.env.MAX_PRICE_IMPACT ?? 2);

(async () => {
    const provider = new ethers.JsonRpcProvider("https://bsc-dataseed1.binance.org");
    const router = new ethers.Contract(ROUTER, ABI, provider);
    const usdt = getTokenAddress("USDT"), wbnb = getTokenAddress("WBNB");
    const amountIn = ethers.parseUnits(TRADE.toString(), 18);
    const prices = await fetchQuotesPro(SCAN_TOKENS);

    const rows: { sym: string; impact: number; ok: boolean }[] = [];
    for (const sym of SCAN_TOKENS) {
        const px = prices.get(sym)?.price;
        if (!px) { rows.push({ sym, impact: 999, ok: false }); continue; }
        try {
            const tokenAddr = getTokenAddress(sym);
            const dec = await new ethers.Contract(tokenAddr, ERC, provider).decimals();
            const out = (await router.getAmountsOut(amountIn, [usdt, wbnb, tokenAddr]))[2];
            const outUsd = Number(ethers.formatUnits(out, dec)) * px;
            const impact = ((TRADE - outUsd) / TRADE) * 100;
            rows.push({ sym, impact, ok: impact <= MAX_IMPACT });
        } catch {
            rows.push({ sym, impact: 999, ok: false });
        }
    }
    rows.sort((a, b) => a.impact - b.impact);
    console.log(`Price impact for a $${TRADE} buy (guard rejects > ${MAX_IMPACT}%):\n`);
    for (const r of rows) {
        const tag = r.ok ? "✅ TRADE" : "⛔ SKIP ";
        const imp = r.impact === 999 ? "no route" : r.impact.toFixed(2) + "%";
        console.log(`  ${tag}  ${r.sym.padEnd(6)} impact=${imp}`);
    }
    console.log(`\nTradeable (deep liquidity): ${rows.filter(r => r.ok).map(r => r.sym).join(", ")}`);
})();
