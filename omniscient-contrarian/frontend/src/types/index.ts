export interface Trade {
  time: string;
  token: string;
  side: "BUY" | "SELL";
  amount: number;
  price: number;
  txHash: string;
}

export interface X402Transaction {
  time: string;
  type: "PAID" | "REVENUE";
  amount: number;
  txHash: string;
}

export interface ConvictionScore {
  social: number;
  flow: number;
  funding: number;
  news: number;
  composite: number;
}

export interface Heartbeat {
  status: "active" | "missed";
  lastSeen: string;
  nextDue: string;
}

export interface ScanResult {
  symbol: string;
  score: number;
  action: "BUY" | "SELL" | "HOLD";
}

export interface AgentStatus {
  portfolioValue: number;
  portfolioHistory: number[];
  "24hChange": number;
  convictionScore: ConvictionScore;
  drawdownPercentage: number;
  heartbeat: Heartbeat;
  lastTrades: Trade[];
  x402Transactions: X402Transaction[];
  // Live agent fields
  agentStatus: "RUNNING" | "STOPPED" | "ERROR";
  currentEpoch: number;
  lastEpochTime: string | null;
  nextEpochTime: string | null;
  bestSignal: ScanResult | null;
  lastScanResults: ScanResult[];
  dailyTradeCount: number;
  dailySpentUsd: number;
  fearGreed: number | null;
  fearGreedClass: string;
  logFeed: string[];
}
