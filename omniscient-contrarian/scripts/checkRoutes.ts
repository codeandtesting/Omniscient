/** Free: show which route (direct USDT pair vs via WBNB) the smart router picks per token. */
import { ethers } from "ethers";
import { SCAN_TOKENS, getTokenAddress } from "../src/core/tokens";

const ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
const ABI = ["function getAmountsOut(uint amountIn, address[] path) view returns (uint[])"];

(async () => {
    const provider = new ethers.JsonRpcProvider("https://bsc-dataseed1.binance.org");
    const router = new ethers.Contract(ROUTER, ABI, provider);
    const usdt = getTokenAddress("USDT"), wbnb = getTokenAddress("WBNB");
    const amountIn = ethers.parseUnits("1.5", 18);

    for (const sym of SCAN_TOKENS) {
        const token = getTokenAddress(sym);
        let direct = 0n, viaWbnb = 0n;
        try { direct = (await router.getAmountsOut(amountIn, [usdt, token]))[1]; } catch {}
        try { viaWbnb = (await router.getAmountsOut(amountIn, [usdt, wbnb, token]))[2]; } catch {}
        const pick = direct > viaWbnb ? "DIRECT (1 hop, cheaper)" : "via WBNB (2 hops)";
        const saving = direct > viaWbnb && viaWbnb > 0n ? ` (+${(Number(direct - viaWbnb) / Number(viaWbnb) * 100).toFixed(2)}%)` : "";
        console.log(`  ${sym.padEnd(6)} -> ${pick}${saving}`);
    }
})();
