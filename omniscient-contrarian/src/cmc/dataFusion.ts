import { fetchMarketData, MarketMetrics } from "./cmcClient";

/**
 * Data fusion layer. Pulls all tracked tokens from the CMC Agent Hub in a single
 * batched x402 request and returns their real market metrics keyed by symbol.
 *
 * Batching matters: one paid request per epoch instead of one-per-token-per-endpoint.
 */
export async function fetchAllMetrics(symbols: string[]): Promise<Map<string, MarketMetrics>> {
    return fetchMarketData(symbols);
}

export type { MarketMetrics };
