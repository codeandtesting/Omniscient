import axios from "axios";
import { logger } from "../utils/logger";
import { MarketMetrics } from "./cmcClient";
import * as dotenv from "dotenv";

dotenv.config();

// Standard CMC Pro REST (subscription key). Used for data the x402 quotes endpoint
// does NOT expose — Fear & Greed and global metrics — and as a reliability fallback
// for quotes if the x402 path fails mid-competition.
const PRO_BASE = process.env.CMC_BASE_URL || "https://pro-api.coinmarketcap.com";

function headers() {
    const key = process.env.CMC_API_KEY;
    if (!key) throw new Error("CMC_API_KEY not set (Pro API key required for Fear & Greed / fallback)");
    return { "X-CMC_PRO_API_KEY": key };
}

function hasProKey(): boolean {
    return !!process.env.CMC_API_KEY;
}

// ── Fear & Greed (market-wide contrarian gauge) ──
export interface FearGreed {
    value: number;               // 0 (extreme fear) .. 100 (extreme greed)
    classification: string;      // "Fear", "Greed", ...
}

let fgCache: { ts: number; data: FearGreed | null } | null = null;
const FG_TTL_MS = 10 * 60 * 1000; // F&G updates ~every 15 min

export async function fetchFearGreed(): Promise<FearGreed | null> {
    if (!hasProKey()) return null;
    if (fgCache && Date.now() - fgCache.ts < FG_TTL_MS) return fgCache.data;
    try {
        const r = await axios.get(`${PRO_BASE}/v3/fear-and-greed/latest`, { headers: headers(), timeout: 15000 });
        const d = r.data?.data;
        const data: FearGreed | null = d
            ? { value: Number(d.value), classification: String(d.value_classification ?? "") }
            : null;
        fgCache = { ts: Date.now(), data };
        if (data) logger.info(`CMC Pro: Fear & Greed = ${data.value} (${data.classification})`);
        return data;
    } catch (e: any) {
        logger.warn(`CMC Pro: Fear & Greed fetch failed: ${e.response?.status || e.message}`);
        return null;
    }
}

// ── Global metrics (risk-on/off context) ──
export interface GlobalMetrics {
    totalMarketCap: number;
    btcDominance: number;
}

let gmCache: { ts: number; data: GlobalMetrics | null } | null = null;
const GM_TTL_MS = 10 * 60 * 1000;

export async function fetchGlobalMetrics(): Promise<GlobalMetrics | null> {
    if (!hasProKey()) return null;
    if (gmCache && Date.now() - gmCache.ts < GM_TTL_MS) return gmCache.data;
    try {
        const r = await axios.get(`${PRO_BASE}/v1/global-metrics/quotes/latest`, { headers: headers(), timeout: 15000 });
        const d = r.data?.data;
        const data: GlobalMetrics | null = d
            ? { totalMarketCap: d.quote?.USD?.total_market_cap ?? 0, btcDominance: d.btc_dominance ?? 0 }
            : null;
        gmCache = { ts: Date.now(), data };
        return data;
    } catch (e: any) {
        logger.warn(`CMC Pro: global metrics fetch failed: ${e.response?.status || e.message}`);
        return null;
    }
}

// ── Quotes via Pro key (reliability fallback for the x402 path) ──
export async function fetchQuotesPro(symbols: string[]): Promise<Map<string, MarketMetrics>> {
    const map = new Map<string, MarketMetrics>();
    if (!hasProKey()) return map;
    const r = await axios.get(`${PRO_BASE}/v1/cryptocurrency/quotes/latest`, {
        headers: headers(),
        params: { symbol: symbols.join(","), convert: "USD" },
        timeout: 20000,
    });
    const root = r.data?.data ?? {};
    for (const sym of symbols) {
        let entry: any = root[sym];
        if (Array.isArray(entry)) {
            // pick the highest-market-cap match (avoid impostor tickers)
            entry = entry.reduce((best: any, e: any) =>
                (e?.quote?.USD?.market_cap ?? -1) > (best?.quote?.USD?.market_cap ?? -1) ? e : best, entry[0]);
        }
        const q = entry?.quote?.USD;
        if (!q) continue;
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
    return map;
}
