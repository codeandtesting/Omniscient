const ALLOWED_TOKENS = ["BNB", "BTC", "ETH", "USDC", "USDT", "FDUSD", "CAKE"];

/**
 * Validates that the token is part of the 149 BEP-20 allowed list.
 */
export function isValidToken(symbol: string): boolean {
    return ALLOWED_TOKENS.includes(symbol.toUpperCase());
}

/**
 * Validates position size (must not exceed 20% of portfolio).
 */
export function isValidPositionSize(tradeAmount: number, portfolioValue: number): boolean {
    const maxAllowed = portfolioValue * 0.20;
    return tradeAmount <= maxAllowed;
}
