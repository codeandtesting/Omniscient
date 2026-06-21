import { computeFactors } from "../src/core/convictionScore";
import { MarketMetrics } from "../src/cmc/cmcClient";

// NOTE: We deliberately do NOT hit the live CMC x402 endpoint here — every real
// request costs USDC. Network behaviour is exercised manually via the validation
// script; unit tests stay pure and free.
describe("CMC metrics → display factors", () => {
    it("maps real metrics into four numeric factors", () => {
        const metrics: MarketMetrics = {
            symbol: "BNB",
            price: 600,
            change1h: 0.2,
            change24h: 3.1,
            change7d: -5.0,
            volume24h: 1_000_000,
            volumeChange24h: 12,
            marketCap: 90_000_000,
            turnover: 1_000_000 / 90_000_000,
        };
        const f = computeFactors(metrics);
        expect(typeof f.social).toBe("number");
        expect(typeof f.flow).toBe("number");
        expect(typeof f.funding).toBe("number");
        expect(typeof f.news).toBe("number");
    });
});
