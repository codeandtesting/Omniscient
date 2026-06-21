// Omniscient Contrarian AI Trading Agent Entry Point
import * as dotenv from "dotenv";
import { startAgentLoop } from "./core/agentLoop";
import { logger } from "./utils/logger";
import { getAgentState } from "./core/agentState";
import { approveOverride, getOverrideStatus } from "./twak/twakHeartbeat";
import express from "express";
import cors from "cors";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ── Live Status Endpoint ──
// Returns the real-time state of the agent (no mock data)
app.get("/status", (req, res) => {
    const state = getAgentState();
    
    // Change since the agent started, rounded to 2 decimals for display.
    const changePct = state.initialPortfolioValue > 0
        ? ((state.portfolioValue - state.initialPortfolioValue) / state.initialPortfolioValue) * 100
        : 0;

    // Map to the format the frontend expects
    const response = {
        portfolioValue: Math.round(state.portfolioValue * 100) / 100,
        portfolioHistory: state.portfolioHistory,
        "24hChange": Math.round(changePct * 100) / 100,
        convictionScore: state.convictionScore,
        drawdownPercentage: Math.round(state.drawdownPercentage * 100) / 100,
        heartbeat: state.heartbeat,
        lastTrades: state.lastTrades,
        x402Transactions: state.x402Transactions,
        // Extra fields for an enhanced dashboard
        agentStatus: state.agentStatus,
        currentEpoch: state.currentEpoch,
        lastEpochTime: state.lastEpochTime,
        nextEpochTime: state.nextEpochTime,
        bestSignal: state.bestSignal,
        lastScanResults: state.lastScanResults,
        dailyTradeCount: state.dailyTradeCount,
        dailySpentUsd: state.dailySpentUsd,
        fearGreed: state.fearGreed,
        fearGreedClass: state.fearGreedClass,
        logFeed: state.logFeed,
    };

    res.json(response);
});

// ── Heartbeat veto: owner approves continuing past a drawdown breach ──
// GET shows whether the agent is currently waiting on the owner.
app.get("/heartbeat/status", (req, res) => {
    res.json(getOverrideStatus());
});

// POST is the owner's explicit "keep my positions" approval. No approval = liquidation.
app.post("/heartbeat/approve", (req, res) => {
    const ok = approveOverride();
    res.json({ approved: ok, message: ok ? "Override approved — agent will hold." : "No override was pending." });
});

async function main() {
    logger.info("Starting The Omniscient Contrarian...");
    logger.info("Initializing Agent Hub Connection...");
    logger.info("Initializing TWAK (Trust Wallet Agent Kit)...");
    
    app.listen(3000, () => {
      logger.info("REST API listening on port 3000");
    });
    
    // Start the infinite agent loop
    await startAgentLoop();
}

main().catch(err => {
    logger.error("Fatal error starting the agent", err);
    process.exit(1);
});
