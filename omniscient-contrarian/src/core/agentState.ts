/**
 * Shared in-memory state store for the agent.
 * The agent loop writes here; the REST API reads from here.
 * This is the single source of truth for the dashboard.
 */

export interface TradeRecord {
    time: string;
    token: string;
    side: "BUY" | "SELL";
    amount: number;
    price: number;
    txHash: string;
}

export interface X402Record {
    time: string;
    type: "PAID" | "REVENUE";
    amount: number;
    txHash: string;
}

export interface ScanResult {
    symbol: string;
    score: number;
    action: "BUY" | "SELL" | "HOLD";
}

export interface AgentState {
    // Status
    agentStatus: "RUNNING" | "STOPPED" | "ERROR";
    currentEpoch: number;
    lastEpochTime: string | null;
    nextEpochTime: string | null;

    // Portfolio
    portfolioValue: number;
    portfolioHistory: number[];
    initialPortfolioValue: number;

    // Conviction scores (latest epoch)
    convictionScore: {
        social: number;
        flow: number;
        funding: number;
        news: number;
        composite: number;
    };

    // Best signal from last scan
    bestSignal: ScanResult | null;

    // All scan results from last epoch
    lastScanResults: ScanResult[];

    // Drawdown
    drawdownPercentage: number;

    // Heartbeat
    heartbeat: {
        status: "active" | "missed";
        lastSeen: string;
        nextDue: string;
    };

    // Trade history (most recent first, max 50)
    lastTrades: TradeRecord[];

    // x402 payment history (most recent first, max 50)
    x402Transactions: X402Record[];

    // Guardrails
    dailyTradeCount: number;
    dailySpentUsd: number;

    // Market regime (Fear & Greed)
    fearGreed: number | null;
    fearGreedClass: string;

    // Log feed (last 30 messages)
    logFeed: string[];
}

// ── Singleton State ──
const state: AgentState = {
    agentStatus: "STOPPED",
    currentEpoch: 0,
    lastEpochTime: null,
    nextEpochTime: null,

    portfolioValue: 0,
    portfolioHistory: [],
    initialPortfolioValue: 0,

    convictionScore: {
        social: 50,
        flow: 50,
        funding: 50,
        news: 50,
        composite: 50,
    },

    bestSignal: null,
    lastScanResults: [],

    drawdownPercentage: 0,

    heartbeat: {
        status: "active",
        lastSeen: new Date().toISOString(),
        nextDue: new Date(Date.now() + 3600000).toISOString(),
    },

    lastTrades: [],
    x402Transactions: [],

    dailyTradeCount: 0,
    dailySpentUsd: 0,

    fearGreed: null,
    fearGreedClass: "",

    logFeed: [],
};

// ── Getters ──
export function getAgentState(): AgentState {
    return { ...state };
}

// ── Setters ──
export function updatePortfolio(value: number) {
    state.portfolioValue = value;
    state.portfolioHistory.push(value);
    // Keep only last 168 data points (7 days of hourly data)
    if (state.portfolioHistory.length > 168) {
        state.portfolioHistory.shift();
    }
}

export function setInitialPortfolio(value: number) {
    state.initialPortfolioValue = value;
    state.portfolioValue = value;
    state.portfolioHistory = [value];
}

export function updateConviction(social: number, flow: number, funding: number, news: number, composite: number) {
    state.convictionScore = { social, flow, funding, news, composite };
}

export function updateDrawdown(pct: number) {
    state.drawdownPercentage = pct;
}

export function setBestSignal(signal: ScanResult | null) {
    state.bestSignal = signal;
}

export function setLastScanResults(results: ScanResult[]) {
    state.lastScanResults = results;
}

export function addTrade(trade: TradeRecord) {
    state.lastTrades.unshift(trade);
    if (state.lastTrades.length > 50) state.lastTrades.pop();
}

export function addX402Transaction(tx: X402Record) {
    state.x402Transactions.unshift(tx);
    if (state.x402Transactions.length > 50) state.x402Transactions.pop();
}

export function updateHeartbeat() {
    state.heartbeat = {
        status: "active",
        lastSeen: new Date().toISOString(),
        nextDue: new Date(Date.now() + 3600000).toISOString(),
    };
}

export function setAgentStatus(status: "RUNNING" | "STOPPED" | "ERROR") {
    state.agentStatus = status;
}

export function incrementEpoch() {
    const intervalMs = Number(process.env.SCAN_INTERVAL_MS) || 3600000;
    state.currentEpoch += 1;
    state.lastEpochTime = new Date().toISOString();
    state.nextEpochTime = new Date(Date.now() + intervalMs).toISOString();
}

export function updateGuardrails(tradeCount: number, spentUsd: number) {
    state.dailyTradeCount = tradeCount;
    state.dailySpentUsd = spentUsd;
}

export function setMarketRegime(fearGreed: number, classification: string) {
    state.fearGreed = fearGreed;
    state.fearGreedClass = classification;
}

export function addLogEntry(message: string) {
    const timestamp = new Date().toISOString();
    state.logFeed.unshift(`[${timestamp}] ${message}`);
    if (state.logFeed.length > 30) state.logFeed.pop();
}
