import { twakExecutor } from "../src/twak/twakExecutor";

describe("TWAK Executor", () => {
    it("should return a portfolio value", async () => {
        const value = await twakExecutor.getPortfolioValue();
        expect(value).toBeGreaterThan(0);
    });

    it("should execute a trade without throwing", async () => {
        await expect(twakExecutor.executeTrade("BNB", "BUY")).resolves.not.toThrow();
    });
});
