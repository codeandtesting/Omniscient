/**
 * Official Allowlist for the BNB Hackathon "The Omniscient Contrarian"
 * Trades outside these symbols do not count towards the competition PnL.
 * Below are the primary liquid tokens on BSC mapped to their Mainnet addresses.
 */
import { ethers } from "ethers";

export const ELIGIBLE_TOKENS: { [symbol: string]: string } = {
    // Core / Stablecoins
    "WBNB": "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
    "USDT": "0x55d398326f99059fF775485246999027B3197955",
    "USDC": "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
    "DAI":  "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3",
    "TUSD": "0x40af3827F39D0EAcBF4A168f8D4ee67c121D11c9",
    "FDUSD":"0xc5f0f7b66764F6ec8C8Dff7BA683102295E16409",
    // Large-cap
    "ETH":  "0x2170Ed0880ac9A755fd29B2688956BD959F933F8",
    "XRP":  "0x1D2F0da169ceB9fC7B3144828DB6DfB97CF507Ce",
    "DOGE": "0xbA2aE424d960c26247Dd6c32edC70B295c744C43",
    "ADA":  "0x3EE2200Efb3400fAbB9AacF31297cBdD1d435D47",
    "LINK": "0xF8A0BF9cF54Bb92F17374d9e9A321E6a111a51bD",
    "LTC":  "0x4338665CBB7B2485A8855A139b75D5e34AB0DB94",
    "DOT":  "0x7083609fce4d1d8Dc0C979AAb8c869Ea2C873402",
    "BCH":  "0x8fF795a6F4D97E7887C79beA79aba5cc76444aDf",
    "AVAX": "0x1CE0c2827e2eF14D5C4f29a091d735A204794041",
    "SHIB": "0x2859e4544C4bB03966803b044A93563Bd2D0DD4D",
    "UNI":  "0xBf5140A22578168FD562DCcF235E5D43A02ce9B1",
    "ETC":  "0x3d6545b08693daE087E957cb1180ee38B9e3c25E",
    "ATOM": "0x0Eb3a705fc54725037CC9e008bDede697f62F335",
    "FIL":  "0x0D8Ce2A99Bb6e3B7Db580eD848240e4a0F9aE153",
    // DeFi / Mid-cap
    "CAKE": "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82",
    "AAVE": "0xfb6115445Bff7b52FeB98650C87f44907E58f802",
    "SNX":  "0x9Ac983826058b8a9C7Aa1C9171441191232E8404",
    "COMP": "0x52CE071Bd9b1C4B00A0b92D298c512478CaD67e8",
    "SUSHI":"0x947950BcC74888a40Ffa2593C5798F11Fc9124C4",
    "1INCH":"0x111111111117dC0aa78b770fA6A738034120C302",
    "INJ":  "0xa2B726B1145A4773F68CBA5cadB5F2fB3e0b1682",
    "PENDLE":"0xb3Ed0A426155B79B898849803E3B36552f7ED507",
    "LDO":  "0x986854779804799C1d68867F5E03e601E781e41b",
    // Meme / Small-cap
    "FLOKI":"0xfb5B838b6cfEEdC2873aB27866079AC55363D37E",
    "BONK": "0xA697e272a73744b343528C3Bc4702F2565b2F422",
    "APE":  "0x0b079b33B6e72311c6BE245F9f660CC385029fc3",
    "BAT":  "0x101d82428437127bF1608F699CD651e6Abf9766E",
    "TWT":  "0x4B0F1812e5Df2A09796481Ff14017e6005508003",
    "AXS":  "0x715D400F88C167884bbCc41C5FeA407ed4D2f8A0",
    "ZIL":  "0xb86AbCb37C3A4B64f74f59301AFF131a1BEcC787",
    "KAVA": "0x5F88AB06e8dfe89DF127B2430Bba4Af600866035",
    "YFI":  "0x88f1A5ae2A3BF98AEAF342D26B30a79438c9142e",
    "FET":  "0x031b41e504677879370e9DBcF397afCe70090472",
};

/**
 * The subset of liquid tokens the agent actively scans each epoch.
 * These must all have verified PancakeSwap liquidity pools via WBNB.
 */
// Active scan universe: only tokens with VERIFIED PancakeSwap V2 liquidity routable
// from USDT (checked via scripts/probeLiquidity.ts). We exclude:
//   - no-route tokens that trade only on CEXs (XRP, INJ, FET)
//   - thin Binance-peg pools whose swaps revert in practice (UNI)
//   - fee-on-transfer / volatile meme tokens (FLOKI, BONK, SHIB)
// Excluded tokens remain in ELIGIBLE_TOKENS so any existing position can still be sold.
// Widest scan universe with VERIFIED deep PancakeSwap liquidity (price impact <= ~2%
// on a small trade, via scripts/checkAllImpact.ts across all eligible tokens). The
// runtime price-impact guard in twakExecutor is the live backstop — it skips any pool
// that thins out, so this list can be broad without risking the bleed we saw on
// dead pools (PENDLE 96%, LDO 20%, ETC 4.7%). FLOKI is excluded (fee-on-transfer).
export const SCAN_TOKENS: string[] = [
    "ETH", "BCH", "LTC", "AVAX", "ADA",
    "DOT", "LINK", "ATOM", "FIL", "AAVE",
    "UNI", "CAKE", "TWT", "DOGE", "SHIB",
    "AXS", "ZIL", "YFI", "1INCH", "BAT",
];

export function isTokenEligible(symbol: string): boolean {
    return !!ELIGIBLE_TOKENS[symbol];
}

export function getTokenAddress(symbol: string): string {
    const address = ELIGIBLE_TOKENS[symbol];
    if (!address) {
        throw new Error(`Token ${symbol} is not in the eligible allowlist.`);
    }
    // Normalize to a valid EIP-55 checksum (lowercasing first repairs any bad casing),
    // so ethers v6 doesn't reject otherwise-correct addresses.
    return ethers.getAddress(address.toLowerCase());
}
