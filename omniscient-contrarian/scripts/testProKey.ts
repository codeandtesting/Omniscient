import axios from "axios";

const KEY = process.env.CMC_API_KEY || "199e4dccac7c4bc6b7de254ee9a113ec";
const base = "https://pro-api.coinmarketcap.com";
const H = { "X-CMC_PRO_API_KEY": KEY };

const endpoints: [string, Record<string, string>][] = [
    ["/v1/cryptocurrency/quotes/latest", { symbol: "BNB,CAKE" }],
    ["/v3/fear-and-greed/latest", {}],
    ["/v1/global-metrics/quotes/latest", {}],
    ["/v1/cryptocurrency/trending/latest", {}],
    ["/v1/cryptocurrency/listings/latest", { limit: "5" }],
];

(async () => {
    for (const [path, params] of endpoints) {
        try {
            const r = await axios.get(base + path, { headers: H, params, timeout: 15000 });
            const sample = JSON.stringify(r.data?.data).slice(0, 160);
            console.log(`✅ ${path}  -> ${sample}`);
        } catch (e: any) {
            console.log(`❌ ${path}  -> ${e.response?.status} ${JSON.stringify(e.response?.data?.status?.error_message || e.message)}`);
        }
    }
})();
