import { execFile } from "child_process";
import { promisify } from "util";
import { logger } from "../utils/logger";
import * as dotenv from "dotenv";

dotenv.config();

const pexec = promisify(execFile);

/**
 * Adapter around the Trust Wallet Agent Kit CLI (`twak`).
 *
 * When USE_TWAK=true and the `twak` binary is installed + credentialed
 * (Access ID / HMAC Secret from portal.trustwallet.com, saved in ~/.twak),
 * the agent routes its EXECUTION (swaps) and DATA PAYMENTS (x402) through TWAK —
 * making TWAK the sole execution layer across multiple surfaces. If TWAK is not
 * available, callers fall back to direct self-custody signing with ethers.
 */

const TWAK_BIN = process.env.TWAK_BIN || "twak";
let availabilityChecked = false;
let available = false;

export function twakEnabledByConfig(): boolean {
    return (process.env.USE_TWAK || "").toLowerCase() === "true";
}

/** True only if opt-in is set AND the CLI actually responds. Cached after first probe. */
export async function isTwakAvailable(): Promise<boolean> {
    if (!twakEnabledByConfig()) return false;
    if (availabilityChecked) return available;
    availabilityChecked = true;
    try {
        await pexec(TWAK_BIN, ["--version"], { timeout: 10_000 });
        available = true;
        logger.info("TWAK CLI detected — using Trust Wallet Agent Kit as the execution layer.");
    } catch {
        available = false;
        logger.warn("USE_TWAK=true but `twak` CLI not found/responding. Falling back to ethers self-custody signing.");
    }
    return available;
}

/** Best-effort extraction of a tx hash from arbitrary twak JSON output. */
function extractTxHash(obj: any): string {
    if (!obj || typeof obj !== "object") return "";
    const direct = obj.txHash || obj.hash || obj.transactionHash || obj.tx_hash || obj.transaction?.hash;
    if (typeof direct === "string") return direct;
    for (const v of Object.values(obj)) {
        if (v && typeof v === "object") {
            const found = extractTxHash(v);
            if (found) return found;
        }
    }
    return "";
}

function parseJsonLoose(stdout: string): any {
    try {
        return JSON.parse(stdout);
    } catch {
        // CLI sometimes prefixes logs; grab the last JSON object/array in the output.
        const match = stdout.match(/(\{[\s\S]*\}|\[[\s\S]*\])\s*$/);
        if (match) {
            try { return JSON.parse(match[1]); } catch { /* fall through */ }
        }
        return null;
    }
}

export interface TwakSwapResult {
    success: boolean;
    txHash: string;
    raw?: any;
    error?: string;
}

/**
 * Execute a same-chain swap via TWAK: `twak swap <amount> <from> <to> --chain <chain> --json`.
 * Password is taken from TWAK_PASSWORD env (never passed as a flag, to avoid stderr exposure).
 */
export async function twakSwap(
    amount: number,
    fromToken: string,
    toToken: string,
    chain = "bsc",
    slippagePct = 5
): Promise<TwakSwapResult> {
    const args = [
        "swap", String(amount), fromToken, toToken,
        "--chain", chain,
        "--slippage", String(slippagePct),
        "--json",
    ];
    const env = { ...process.env };
    if (process.env.TWAK_PASSWORD) env.TWAK_WALLET_PASSWORD = process.env.TWAK_PASSWORD;

    try {
        logger.info(`TWAK CLI: swap ${amount} ${fromToken} -> ${toToken} on ${chain}`);
        const { stdout } = await pexec(TWAK_BIN, args, { timeout: 120_000, env });
        const parsed = parseJsonLoose(stdout);
        const txHash = extractTxHash(parsed);
        if (txHash) return { success: true, txHash, raw: parsed };
        return { success: false, txHash: "", raw: parsed, error: "no tx hash in twak output" };
    } catch (e: any) {
        return { success: false, txHash: "", error: e.stderr || e.message };
    }
}

/**
 * Pay for and fetch an x402-protected resource via TWAK's native x402 support:
 *   `twak x402 request <url> --max-payment <atomic> --prefer-method eip3009 --yes --json`
 * Returns the parsed resource body, or null on failure (caller falls back).
 */
export async function twakX402Request(
    url: string,
    opts: { maxPaymentAtomic?: string; preferNetwork?: string; preferAsset?: string } = {}
): Promise<any | null> {
    const args = [
        "x402", "request", url,
        "--max-payment", opts.maxPaymentAtomic || "20000",
        "--prefer-method", "eip3009",
        "--yes",
        "--json",
    ];
    if (opts.preferNetwork) args.push("--prefer-network", opts.preferNetwork);
    if (opts.preferAsset) args.push("--prefer-asset", opts.preferAsset);

    const env = { ...process.env };
    if (process.env.TWAK_PASSWORD) env.TWAK_WALLET_PASSWORD = process.env.TWAK_PASSWORD;

    try {
        logger.info(`TWAK CLI: x402 request ${url}`);
        const { stdout } = await pexec(TWAK_BIN, args, { timeout: 60_000, env });
        const parsed = parseJsonLoose(stdout);
        // TWAK may wrap the resource under a field; return the body if present, else the whole object.
        return parsed?.body ?? parsed?.data ?? parsed ?? null;
    } catch (e: any) {
        logger.warn(`TWAK CLI: x402 request failed: ${e.stderr || e.message}`);
        return null;
    }
}
