import axios from "axios";
import { logger } from "../utils/logger";
import { buildX402Header, decodePaymentRequired, X402Accept } from "../twak/x402Payer";
import { isTwakAvailable, twakX402Request } from "../twak/twakCli";
import { fetchQuotesPro } from "./cmcPro";
import { addX402Transaction } from "../core/agentState";
import * as dotenv from "dotenv";

dotenv.config();

// CMC AI Agent Hub — x402 REST surface. No API key required; each request is paid
// per-call with USDC on Base via the x402 handshake handled below.
const CMC_BASE_URL = process.env.CMC_BASE_URL || "https://pro-api.coinmarketcap.com";
const QUOTES_PATH = "/x402/v3/cryptocurrency/quotes/latest";

/** Real per-token market metrics pulled from one batched quotes/latest call. */
export interface MarketMetrics {
    symbol: string;
    price: number;
    change1h: number;
    change24h: number;
    change7d: number;
    volume24h: number;
    volumeChange24h: number;
    marketCap: number;
    turnover: number; // volume24h / marketCap — how much of the cap trades in a day
}

// Cache the batched response so multiple reads within one epoch never pay twice.
const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { ts: number; data: Map<string, MarketMetrics> } | null = null;

/** Pull the on-chain settlement tx hash out of the facilitator's x402 response headers. */
function extractSettlementHash(headers: any): string {
    const raw =
        headers?.["x-payment-response"] ||
        headers?.["X-PAYMENT-RESPONSE"] ||
        headers?.["payment-response"];
    if (!raw) return "";
    try {
        const decoded = JSON.parse(Buffer.from(raw, "base64").toString("utf-8"));
        return decoded.transaction || decoded.txHash || decoded.transactionHash || decoded.hash || "";
    } catch {
        // Some servers send it as plain JSON rather than base64.
        try {
            const decoded = JSON.parse(raw);
            return decoded.transaction || decoded.txHash || decoded.transactionHash || decoded.hash || "";
        } catch {
            return "";
        }
    }
}

/**
 * GET a CMC x402 endpoint. If the server answers 402, decode the payment
 * requirements, sign an EIP-3009 USDC authorization, and retry with the
 * PAYMENT-SIGNATURE header. Returns the parsed JSON body.
 */
export async function x402Get(path: string, params: Record<string, string>): Promise<any> {
    const url = `${CMC_BASE_URL}${path}`;

    // Preferred path: pay + fetch natively through the Trust Wallet Agent Kit's x402.
    if (await isTwakAvailable()) {
        const qs = new URLSearchParams(params).toString();
        const body = await twakX402Request(`${url}?${qs}`, {
            preferNetwork: "base",
            preferAsset: "USDC",
            maxPaymentAtomic: "20000",
        });
        if (body) {
            addX402Transaction({
                time: new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" }),
                type: "PAID",
                amount: 0.01,
                txHash: "",
            });
            return body;
        }
        logger.warn("CMC Client: TWAK x402 returned nothing — falling back to direct EIP-3009 signing.");
    }

    // Fallback path: direct axios + self-custody EIP-3009 signing.
    // First attempt — treat 402 as a normal (non-throwing) response so we can pay.
    const first = await axios.get(url, {
        params,
        validateStatus: (s) => s === 200 || s === 402,
    });

    if (first.status === 200) {
        return first.data;
    }

    // ── 402 Payment Required: run the x402 handshake ──
    const header = first.headers["payment-required"] || first.headers["Payment-Required"];
    if (!header) {
        throw new Error("402 response missing Payment-Required header");
    }

    const reqs = decodePaymentRequired(header);
    // Selection priority:
    //   1) EIP-3009 + USDC on Base (gasless, what we implement AND what the wallet is funded with)
    //   2) any EIP-3009 option
    //   3) any "exact" option
    const accept: X402Accept | undefined =
        reqs.accepts.find((a) => a.extra?.assetTransferMethod === "eip3009" && a.network === "eip155:8453") ||
        reqs.accepts.find((a) => a.extra?.assetTransferMethod === "eip3009") ||
        reqs.accepts.find((a) => a.scheme === "exact") ||
        reqs.accepts[0];
    if (!accept) {
        throw new Error("402 Payment-Required had no usable payment options");
    }

    logger.warn(`CMC Client: 402 for ${path}. Paying via x402 (${accept.extra?.name || accept.asset})...`);
    const { header: paymentHeader, amountUsd } = await buildX402Header(accept, reqs.x402Version, reqs.resource);

    const retry = await axios.get(url, {
        params,
        headers: {
            "PAYMENT-SIGNATURE": paymentHeader,
            "X-PAYMENT": paymentHeader, // x402 standard header name, sent for compatibility
        },
        validateStatus: (s) => s === 200,
    });

    // The facilitator reports the on-chain settlement in the X-PAYMENT-RESPONSE header
    // (base64 JSON). Capture the settlement tx hash so the dashboard can show real proof.
    const settlementHash = extractSettlementHash(retry.headers);

    addX402Transaction({
        time: new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" }),
        type: "PAID",
        amount: amountUsd,
        txHash: settlementHash, // Base settlement tx hash (empty if the facilitator didn't return one)
    });
    logger.info(`CMC Client: x402 payment accepted${settlementHash ? ` (settled ${settlementHash.slice(0, 12)}…)` : ""}. Data returned for ${path}.`);

    return retry.data;
}

/**
 * Index CMC response data by symbol, handling both array and object-keyed shapes.
 * A ticker can be shared by several listed tokens (real coin + low-cap impostors),
 * so when duplicates exist we keep the one with the largest market cap.
 */
function indexBySymbol(root: any): Map<string, any> {
    const groups = new Map<string, any[]>();
    const add = (sym: string, entry: any) => {
        const k = sym.toUpperCase();
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k)!.push(entry);
    };

    if (Array.isArray(root)) {
        // v3 x402 shape: `data` is an array of token objects each carrying a `symbol`.
        for (const entry of root) if (entry?.symbol) add(entry.symbol, entry);
    } else if (root && typeof root === "object") {
        // classic shape: `data` is keyed by symbol; value may be an object or array.
        for (const [k, v] of Object.entries(root)) {
            if (Array.isArray(v)) v.forEach((e) => add(k, e));
            else add(k, v);
        }
    }

    const idx = new Map<string, any>();
    for (const [k, list] of groups) {
        let best = list[0];
        let bestMc = -1;
        for (const e of list) {
            const mc = resolveQuote(e)?.market_cap ?? -1;
            if (mc > bestMc) { bestMc = mc; best = e; }
        }
        idx.set(k, best);
    }
    return idx;
}

/** Resolve the USD quote object across CMC shapes: quote.USD | quote[0] | quote[0].USD. */
function resolveQuote(entry: any): any {
    const c = entry?.quote;
    if (!c) return null;
    if (c.USD?.price !== undefined) return c.USD;
    const vals = Array.isArray(c) ? c : Object.values(c);
    for (const v of vals as any[]) {
        if (v?.price !== undefined) return v;
        if (v?.USD?.price !== undefined) return v.USD;
    }
    return null;
}

/**
 * Fetch real metrics for ALL symbols in a single batched (one-payment) request.
 * Cached for CACHE_TTL_MS so an epoch never pays more than once.
 */
export async function fetchMarketData(symbols: string[]): Promise<Map<string, MarketMetrics>> {
    if (cache && Date.now() - cache.ts < CACHE_TTL_MS) {
        return cache.data;
    }

    logger.info(`CMC Client: Fetching ${symbols.length} symbols in one batched x402 request...`);
    let data: any;
    try {
        data = await x402Get(QUOTES_PATH, { symbol: symbols.join(","), convert: "USD" });
    } catch (err: any) {
        // Reliability net for live trading: if x402 fails, fall back to the Pro REST key.
        logger.warn(`CMC Client: x402 quote fetch failed (${err.message}). Trying Pro-key fallback...`);
        const proMap = await fetchQuotesPro(symbols);
        if (proMap.size > 0) {
            logger.info(`CMC Client: Pro-key fallback returned ${proMap.size} symbols.`);
            cache = { ts: Date.now(), data: proMap };
            return proMap;
        }
        throw err;
    }

    const root = data?.data ?? {};
    const idx = indexBySymbol(root);
    const map = new Map<string, MarketMetrics>();

    for (const sym of symbols) {
        const entry = idx.get(sym.toUpperCase());
        const q = resolveQuote(entry);
        if (!q) {
            logger.warn(`CMC Client: No quote returned for ${sym}`);
            continue;
        }
        const volume24h = q.volume_24h ?? 0;
        const marketCap = q.market_cap ?? 0;
        map.set(sym, {
            symbol: sym,
            price: q.price ?? 0,
            change1h: q.percent_change_1h ?? 0,
            change24h: q.percent_change_24h ?? 0,
            change7d: q.percent_change_7d ?? 0,
            volume24h,
            volumeChange24h: q.volume_change_24h ?? 0,
            marketCap,
            turnover: marketCap > 0 ? volume24h / marketCap : 0,
        });
    }

    if (map.size === 0) {
        logger.warn(`CMC Client: parsed 0 symbols from response (unexpected shape).`);
    }

    cache = { ts: Date.now(), data: map };
    logger.info(`CMC Client: Parsed metrics for ${map.size}/${symbols.length} symbols.`);
    return map;
}
