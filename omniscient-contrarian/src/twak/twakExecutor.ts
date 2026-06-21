import { ethers } from "ethers";
import { logger } from "../utils/logger";
import { getTokenAddress, isTokenEligible, SCAN_TOKENS } from "../core/tokens";
import { MarketMetrics } from "../cmc/cmcClient";
import { isTwakAvailable, twakSwap } from "./twakCli";
import * as dotenv from "dotenv";

dotenv.config();

// PancakeSwap V2 Router on BSC Mainnet
const PANCAKE_ROUTER_ADDRESS = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
const ROUTER_ABI = [
  "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
  // Fee-on-transfer-safe variant: required for tokens that take a tax on transfer
  // (e.g. some meme tokens) where the plain swap reverts on the router's K-check.
  "function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external",
  "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)"
];

const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function decimals() view returns (uint8)"
];

// ── Base currency = USDT (an in-scope BEP-20). The agent trades USDT -> token -> USDT
// so its capital always sits in a competition-counted asset, never in uncounted native BNB.
// BNB is held only to pay gas.
const BASE = "USDT";

// Minimum native BNB to keep for gas so a swap never fails for lack of gas.
const GAS_RESERVE_BNB = ethers.parseEther("0.0008");

// Execution quality controls (env-tunable):
//   SLIPPAGE_PCT     — tight MEV slippage around the pool quote (default 1.5%)
//   MAX_PRICE_IMPACT — reject a trade if the pool fills worse than this vs the real
//                      CMC market price (default 2%). This is what keeps us out of
//                      thin/illiquid pools that bleed value.
const SLIPPAGE_BPS = BigInt(Math.round(Number(process.env.SLIPPAGE_PCT ?? 1.5) * 100)); // 1.5% -> 150
const MAX_PRICE_IMPACT = Number(process.env.MAX_PRICE_IMPACT ?? 2) / 100;                // 2%
const LIQUIDATION_SLIPPAGE_BPS = 800n; // 8% — only used for forced exits with no reference price
const applySlippage = (amount: bigint, bps: bigint) => (amount * (10000n - bps)) / 10000n;

export interface TradeResult {
    success: boolean;
    txHash: string;
    amountUsd: number;   // USD notional traded (populated on success)
    reason?: string;     // populated on failure so the loop can log WHY
}

export const twakExecutor = {
    _getWallet(): ethers.Wallet {
        if (!process.env.BSC_RPC_URL || !process.env.TWAK_PRIVATE_KEY) {
            throw new Error("Missing BSC_RPC_URL or TWAK_PRIVATE_KEY in .env");
        }
        const provider = new ethers.JsonRpcProvider(process.env.BSC_RPC_URL);
        return new ethers.Wallet(process.env.TWAK_PRIVATE_KEY, provider);
    },

    _address(): string {
        if (process.env.TWAK_WALLET_ADDRESS) return process.env.TWAK_WALLET_ADDRESS;
        if (process.env.TWAK_PRIVATE_KEY) return new ethers.Wallet(process.env.TWAK_PRIVATE_KEY).address;
        throw new Error("No TWAK_WALLET_ADDRESS or TWAK_PRIVATE_KEY configured");
    },

    /** Current USDT (base currency) balance in USD — used for %-of-balance position sizing. */
    async getUsdtBalance(): Promise<number> {
        try {
            const provider = new ethers.JsonRpcProvider(process.env.BSC_RPC_URL);
            const c = new ethers.Contract(getTokenAddress(BASE), ERC20_ABI, provider);
            const [bal, dec] = await Promise.all([c.balanceOf(this._address()), c.decimals()]);
            return Number(ethers.formatUnits(bal, dec));
        } catch {
            return 0;
        }
    },

    /** True if we already hold a position in `symbol` worth at least `minUsd`. */
    async hasPosition(symbol: string, price: number, minUsd = 1): Promise<boolean> {
        try {
            const provider = new ethers.JsonRpcProvider(process.env.BSC_RPC_URL);
            const c = new ethers.Contract(getTokenAddress(symbol), ERC20_ABI, provider);
            const [bal, dec] = await Promise.all([c.balanceOf(this._address()), c.decimals()]);
            return Number(ethers.formatUnits(bal, dec)) * (price || 0) >= minUsd;
        } catch {
            return false;
        }
    },

    /** Real portfolio valuation in USD: in-scope stables + held tokens + (gas) BNB. */
    async getPortfolioValue(metrics?: Map<string, MarketMetrics>, bnbPrice?: number): Promise<number> {
        try {
            const provider = new ethers.JsonRpcProvider(process.env.BSC_RPC_URL);
            const address = this._address();
            let total = 0;

            // Stablecoins (in-scope, counted at $1) — this is the agent's base capital.
            for (const stable of ["USDT", "USDC"]) {
                try {
                    const addr = getTokenAddress(stable);
                    const c = new ethers.Contract(addr, ERC20_ABI, provider);
                    const [bal, dec] = await Promise.all([c.balanceOf(address), c.decimals()]);
                    total += Number(ethers.formatUnits(bal, dec));
                } catch { /* skip */ }
            }

            // Held scan tokens valued at live CMC price.
            if (metrics) {
                for (const sym of SCAN_TOKENS) {
                    const px = metrics.get(sym)?.price;
                    if (!px) continue;
                    try {
                        const addr = getTokenAddress(sym);
                        const c = new ethers.Contract(addr, ERC20_ABI, provider);
                        const [bal, dec] = await Promise.all([c.balanceOf(address), c.decimals()]);
                        const amt = Number(ethers.formatUnits(bal, dec));
                        if (amt > 0) total += amt * px;
                    } catch { /* skip */ }
                }
            }

            // Native BNB (gas reserve — not an in-scope asset, but part of wallet value).
            const priceOfBnb = bnbPrice ?? metrics?.get("BNB")?.price ?? 600;
            total += Number(ethers.formatEther(await provider.getBalance(address))) * priceOfBnb;

            return total;
        } catch (e) {
            logger.error("Failed to fetch portfolio value", e);
            return 0;
        }
    },

    /**
     * Pick the best swap route: try the direct pair (1 hop) and the WBNB route (2 hops),
     * return whichever yields more output. Saves a 0.25% hop fee when a direct pool exists,
     * and finds the better price when it doesn't.
     */
    async _bestRoute(router: ethers.Contract, amountIn: bigint, fromAddr: string, toAddr: string): Promise<{ path: string[]; out: bigint }> {
        const wbnb = getTokenAddress("WBNB");
        const candidates: string[][] = [[fromAddr, toAddr]];
        if (fromAddr.toLowerCase() !== wbnb.toLowerCase() && toAddr.toLowerCase() !== wbnb.toLowerCase()) {
            candidates.push([fromAddr, wbnb, toAddr]);
        }
        let best: { path: string[]; out: bigint } = { path: [], out: 0n };
        for (const path of candidates) {
            try {
                const amounts = await router.getAmountsOut(amountIn, path);
                const out: bigint = amounts[amounts.length - 1];
                if (out > best.out) best = { path, out };
            } catch { /* no pool for this path */ }
        }
        if (best.out === 0n) throw new Error("no swap route found");
        return best;
    },

    /** Approve the router to spend `token` if the current allowance is insufficient. */
    async _ensureAllowance(token: ethers.Contract, owner: string, needed: bigint): Promise<void> {
        const current: bigint = await token.allowance(owner, PANCAKE_ROUTER_ADDRESS);
        if (current >= needed) return;
        const tx = await token.approve(PANCAKE_ROUTER_ADDRESS, ethers.MaxUint256);
        await tx.wait();
        logger.info("TWAK Executor: router approval set.");
    },

    /**
     * Trade in USDT base. BUY spends `tradeSizeUsd` USDT for the token; SELL converts
     * the entire token balance back to USDT. Routed via WBNB for deep liquidity.
     */
    async executeTrade(symbol: string, side: "BUY" | "SELL", tradeSizeUsd: number = 3, refPriceUsd: number = 0): Promise<TradeResult> {
        const fail = (reason: string): TradeResult => {
            logger.error(`TWAK Executor: ${side} ${symbol} aborted — ${reason}`);
            return { success: false, txHash: "", amountUsd: 0, reason };
        };

        if (!isTokenEligible(symbol)) return fail(`${symbol} is not in the competition eligible allowlist`);
        if (symbol === BASE) return fail(`cannot trade the base currency ${BASE} against itself`);

        // TWAK is the primary execution layer. If a TWAK swap fails (e.g. transient
        // CLI/credential issue), fall back to direct self-custody ethers signing so a
        // required daily trade still lands — both paths keep custody with our key.
        if (await isTwakAvailable()) {
            const viaTwak = await this._executeViaTwak(symbol, side, tradeSizeUsd, fail);
            if (viaTwak.success) return viaTwak;
            logger.warn(`TWAK Executor: TWAK path failed (${viaTwak.reason}); falling back to ethers signing.`);
        }

        let wallet: ethers.Wallet;
        try {
            wallet = this._getWallet();
        } catch (e: any) {
            return fail(e.message);
        }

        const router = new ethers.Contract(PANCAKE_ROUTER_ADDRESS, ROUTER_ABI, wallet);
        const usdtAddr = getTokenAddress(BASE);
        const tokenAddr = getTokenAddress(symbol);
        const usdt = new ethers.Contract(usdtAddr, ERC20_ABI, wallet);
        const deadline = Math.floor(Date.now() / 1000) + 60 * 10;

        try {
            // Gas preflight (native BNB) applies to either side.
            const gas = await wallet.provider!.getBalance(wallet.address);
            if (gas < GAS_RESERVE_BNB) {
                return fail(`INSUFFICIENT BNB for gas: have ${ethers.formatEther(gas)} BNB. Fund a little BNB.`);
            }

            if (side === "BUY") {
                const dec = await usdt.decimals();
                const amountIn = ethers.parseUnits(tradeSizeUsd.toString(), dec);
                const bal: bigint = await usdt.balanceOf(wallet.address);
                if (bal < amountIn) {
                    return fail(`INSUFFICIENT USDT: have ${ethers.formatUnits(bal, dec)}, need ${tradeSizeUsd}. Fund USDT capital.`);
                }

                await this._ensureAllowance(usdt, wallet.address, amountIn);
                const { path, out: quoteOut } = await this._bestRoute(router, amountIn, usdtAddr, tokenAddr);

                // Price-impact guard: how much worse is the pool fill vs the real CMC price?
                if (refPriceUsd > 0) {
                    const tokenDec = await new ethers.Contract(tokenAddr, ERC20_ABI, wallet.provider!).decimals();
                    const outValueUsd = Number(ethers.formatUnits(quoteOut, tokenDec)) * refPriceUsd;
                    const impact = (tradeSizeUsd - outValueUsd) / tradeSizeUsd;
                    if (impact > MAX_PRICE_IMPACT) {
                        return fail(`${symbol} pool too thin: ${(impact * 100).toFixed(1)}% price impact (max ${(MAX_PRICE_IMPACT * 100).toFixed(0)}%) — skipped`);
                    }
                }
                const amountOutMin = applySlippage(quoteOut, refPriceUsd > 0 ? SLIPPAGE_BPS : LIQUIDATION_SLIPPAGE_BPS);

                // Simulate first — skip cleanly (no gas, no failed tx) if the swap would revert.
                try {
                    await router.swapExactTokensForTokensSupportingFeeOnTransferTokens.staticCall(
                        amountIn, amountOutMin, path, wallet.address, deadline
                    );
                } catch {
                    return fail(`no executable PancakeSwap route for ${symbol} (swap simulation reverted) — skipped`);
                }

                const tx = await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
                    amountIn, amountOutMin, path, wallet.address, deadline
                );
                await tx.wait();
                logger.info(`TWAK Executor: BOUGHT ${symbol} with ${tradeSizeUsd} USDT. Tx: ${tx.hash}`);
                return { success: true, txHash: tx.hash, amountUsd: tradeSizeUsd };
            } else {
                const token = new ethers.Contract(tokenAddr, ERC20_ABI, wallet);
                const [tokBal, tokDec] = await Promise.all([token.balanceOf(wallet.address), token.decimals()]);
                if (tokBal === 0n) return fail(`no ${symbol} balance to sell`);

                await this._ensureAllowance(token, wallet.address, tokBal);
                const { path, out: quoteOut } = await this._bestRoute(router, tokBal, tokenAddr, usdtAddr);
                const usdtDec = await usdt.decimals();
                const estUsd = Number(ethers.formatUnits(quoteOut, usdtDec));

                // Price-impact guard (skipped for forced liquidation, i.e. no refPrice).
                if (refPriceUsd > 0) {
                    const positionUsd = Number(ethers.formatUnits(tokBal, tokDec)) * refPriceUsd;
                    const impact = positionUsd > 0 ? (positionUsd - estUsd) / positionUsd : 0;
                    if (impact > MAX_PRICE_IMPACT) {
                        return fail(`${symbol} pool too thin to sell: ${(impact * 100).toFixed(1)}% price impact — skipped`);
                    }
                }
                const amountOutMin = applySlippage(quoteOut, refPriceUsd > 0 ? SLIPPAGE_BPS : LIQUIDATION_SLIPPAGE_BPS);

                // Simulate first — skip cleanly if the swap would revert.
                try {
                    await router.swapExactTokensForTokensSupportingFeeOnTransferTokens.staticCall(
                        tokBal, amountOutMin, path, wallet.address, deadline
                    );
                } catch {
                    return fail(`no executable PancakeSwap route to sell ${symbol} (swap simulation reverted)`);
                }

                const tx = await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
                    tokBal, amountOutMin, path, wallet.address, deadline
                );
                await tx.wait();
                logger.info(`TWAK Executor: SOLD ${symbol} for ~${estUsd.toFixed(2)} USDT. Tx: ${tx.hash}`);
                return { success: true, txHash: tx.hash, amountUsd: estUsd };
            }
        } catch (error: any) {
            const reason = error.shortMessage || error.reason || error.code || error.message || "unknown error";
            return fail(`on-chain swap failed: ${reason}`);
        }
    },

    /** Execute through the Trust Wallet Agent Kit CLI (self-custody signing in TWAK). */
    async _executeViaTwak(
        symbol: string,
        side: "BUY" | "SELL",
        tradeSizeUsd: number,
        fail: (reason: string) => TradeResult
    ): Promise<TradeResult> {
        const provider = new ethers.JsonRpcProvider(process.env.BSC_RPC_URL);
        const address = this._address();

        if (side === "BUY") {
            const usdt = new ethers.Contract(getTokenAddress(BASE), ERC20_ABI, provider);
            const [bal, dec] = await Promise.all([usdt.balanceOf(address), usdt.decimals()]);
            if (Number(ethers.formatUnits(bal, dec)) < tradeSizeUsd) {
                return fail(`INSUFFICIENT USDT: need ${tradeSizeUsd}. Fund USDT capital.`);
            }
            const r = await twakSwap(tradeSizeUsd, BASE, symbol, "bsc");
            return r.success
                ? { success: true, txHash: r.txHash, amountUsd: tradeSizeUsd }
                : fail(`TWAK swap failed: ${r.error}`);
        }

        const token = new ethers.Contract(getTokenAddress(symbol), ERC20_ABI, provider);
        const [raw, dec] = await Promise.all([token.balanceOf(address), token.decimals()]);
        if (raw === 0n) return fail(`no ${symbol} balance to sell`);
        const amount = Number(ethers.formatUnits(raw, dec));
        const r = await twakSwap(amount, symbol, BASE, "bsc");
        return r.success
            ? { success: true, txHash: r.txHash, amountUsd: 0 }
            : fail(`TWAK swap failed: ${r.error}`);
    },

    /** Real emergency liquidation: sell every held scan-token back to USDT (in-scope, stable). */
    async emergencyLiquidate(): Promise<void> {
        logger.warn("TWAK Executor: EMERGENCY LIQUIDATION — selling all positions to USDT...");
        for (const sym of SCAN_TOKENS) {
            try {
                const result = await this.executeTrade(sym, "SELL");
                if (result.success) logger.info(`TWAK Executor: Liquidated ${sym}. Tx: ${result.txHash}`);
            } catch (e: any) {
                logger.warn(`TWAK Executor: Could not liquidate ${sym}: ${e.message}`);
            }
        }
        logger.info("TWAK Executor: Liquidation complete. Capital moved to USDT.");
    }
};
