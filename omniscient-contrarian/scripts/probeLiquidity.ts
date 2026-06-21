/** Check which eligible tokens actually route USDT->WBNB->token on PancakeSwap V2. */
import { ethers } from "ethers";
import { ELIGIBLE_TOKENS, getTokenAddress } from "../src/core/tokens";

const ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
const ABI = ["function getAmountsOut(uint amountIn, address[] path) view returns (uint[])"];

// Candidate universe: everything mapped in ELIGIBLE_TOKENS except the base/stables.
const SKIP = new Set(["WBNB", "USDT", "USDC", "DAI", "TUSD", "FDUSD"]);

(async () => {
    const provider = new ethers.JsonRpcProvider("https://bsc-dataseed1.binance.org");
    const router = new ethers.Contract(ROUTER, ABI, provider);
    const usdt = getTokenAddress("USDT");
    const wbnb = getTokenAddress("WBNB");
    const oneUsdt = ethers.parseUnits("1", 18);

    const liquid: string[] = [];
    const dead: string[] = [];
    for (const sym of Object.keys(ELIGIBLE_TOKENS)) {
        if (SKIP.has(sym)) continue;
        try {
            const out = await router.getAmountsOut(oneUsdt, [usdt, wbnb, getTokenAddress(sym)]);
            if (out[out.length - 1] > 0n) liquid.push(sym);
            else dead.push(sym);
        } catch {
            dead.push(sym);
        }
    }
    console.log("LIQUID (tradeable):", liquid.join(", "));
    console.log("\nDEAD (no route):  ", dead.join(", "));
})();
