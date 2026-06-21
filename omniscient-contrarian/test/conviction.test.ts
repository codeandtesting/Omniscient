import { calculateScore, computeFactors } from "../src/core/convictionScore";
import { MarketMetrics } from "../src/cmc/cmcClient";

function m(partial: Partial<MarketMetrics>): MarketMetrics {
    return {
        symbol: "TEST",
        price: 1,
        change1h: 0,
        change24h: 0,
        change7d: 0,
        volume24h: 0,
        volumeChange24h: 0,
        marketCap: 0,
        turnover: 0,
        ...partial,
    };
}

describe("Contrarian Conviction Score", () => {
    it("returns ~50 (HOLD) when nothing is moving", () => {
        expect(calculateScore(m({}))).toBe(50);
    });

    it("fades euphoria: a big pump on fading volume scores low (SELL)", () => {
        const score = calculateScore(m({ change24h: 15, volumeChange24h: -20 }));
        expect(score).toBeLessThan(30);
    });

    it("fades panic: a big dump on fading volume scores high (BUY)", () => {
        const score = calculateScore(m({ change24h: -15, volumeChange24h: -20 }));
        expect(score).toBeGreaterThan(70);
    });

    it("clamps within 0..100", () => {
        expect(calculateScore(m({ change24h: -100, change7d: -100 }))).toBeLessThanOrEqual(100);
        expect(calculateScore(m({ change24h: 100, change7d: 100 }))).toBeGreaterThanOrEqual(0);
    });

    it("computeFactors returns in-range display values", () => {
        const f = computeFactors(m({ change24h: 5, volumeChange24h: 10, change7d: 3, turnover: 0.05 }));
        for (const v of Object.values(f)) {
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThanOrEqual(100);
        }
    });
});
