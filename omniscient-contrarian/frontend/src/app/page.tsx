"use client";

import { useAgentStatus } from "../hooks/useAgentStatus";
import { StatusBar } from "../components/StatusBar";
import { PnLChart } from "../components/PnLChart";
import { ConvictionGauge } from "../components/ConvictionGauge";
import { DrawdownMeter } from "../components/DrawdownMeter";
import { HeartbeatStatus } from "../components/HeartbeatStatus";
import { TradeFeed } from "../components/TradeFeed";
import { X402Ledger } from "../components/X402Ledger";

export default function Dashboard() {
  const { data, isLoading, error } = useAgentStatus();

  if (isLoading && !data) {
    return (
      <div className="min-h-screen bg-[#EAEAEA] flex items-center justify-center">
        <div className="text-black text-2xl font-black tracking-widest uppercase border-4 border-black p-8 bg-white">
          Connecting to Agent Backend...
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-[#EAEAEA] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-black text-2xl font-black tracking-widest uppercase border-4 border-black p-8 bg-white">
            ⚠ AGENT OFFLINE
          </div>
          <p className="text-xs font-black uppercase tracking-widest text-black/60">
            Run <span className="bg-black text-white px-2 py-1">npm start</span> in your backend terminal
          </p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const timeUntilNextEpoch = data.nextEpochTime
    ? Math.max(0, Math.floor((new Date(data.nextEpochTime).getTime() - Date.now()) / 60000))
    : 0;

  return (
    <main className="min-h-screen bg-[#EAEAEA] p-6 pb-20 text-black">
      <div className="max-w-7xl mx-auto space-y-6">
        <StatusBar data={data} />

        {/* Agent Status Bar */}
        <div className="bg-black text-white p-3 flex items-center justify-between text-xs font-black uppercase tracking-widest">
          <div className="flex items-center gap-4">
            <span className={`inline-block w-2 h-2 rounded-full ${
              data.agentStatus === "RUNNING" ? "bg-green-400 animate-pulse" :
              data.agentStatus === "ERROR" ? "bg-red-400 animate-pulse" :
              "bg-gray-400"
            }`} />
            <span>Agent: {data.agentStatus}</span>
            <span className="text-white/40">|</span>
            <span>Epoch #{data.currentEpoch}</span>
            <span className="text-white/40">|</span>
            <span>Next scan in {timeUntilNextEpoch} min</span>
          </div>
          <div className="flex items-center gap-4">
            {data.fearGreed != null && (
              <>
                <span>Fear &amp; Greed: {data.fearGreed} ({data.fearGreedClass})</span>
                <span className="text-white/40">|</span>
              </>
            )}
            <span>Daily Trades: {data.dailyTradeCount}</span>
            <span className="text-white/40">|</span>
            <span>Daily Volume: ${data.dailySpentUsd?.toFixed(2) || "0.00"}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="col-span-1 md:col-span-8 bg-white border-2 border-black p-6">
            <PnLChart 
              data={data.portfolioHistory} 
              current={data.portfolioValue} 
              change={data['24hChange']} 
            />
          </div>
          
          <div className="col-span-1 md:col-span-4 space-y-6">
            <div className="bg-white border-2 border-black p-6">
              <HeartbeatStatus data={data.heartbeat} />
            </div>
            <div className="bg-white border-2 border-black p-6">
              <DrawdownMeter percentage={data.drawdownPercentage} />
            </div>
          </div>
          
          <div className="col-span-1 md:col-span-12 bg-white border-2 border-black p-6">
            <ConvictionGauge score={data.convictionScore} />
          </div>

          {/* Live Token Scanner Results */}
          {data.lastScanResults && data.lastScanResults.length > 0 && (
            <div className="col-span-1 md:col-span-12 bg-white border-2 border-black p-6">
              <h2 className="text-sm font-black uppercase tracking-widest mb-4 border-b-2 border-black pb-2">
                Token Scanner (Last Epoch)
                {data.bestSignal && (
                  <span className="float-right text-xs">
                    Best: <span className="bg-black text-white px-2 py-1 ml-1">
                      {data.bestSignal.symbol} → {data.bestSignal.action} ({data.bestSignal.score})
                    </span>
                  </span>
                )}
              </h2>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {data.lastScanResults.map((r) => (
                  <div key={r.symbol} className={`border-2 p-3 text-center ${
                    r.action === "BUY" ? "border-black bg-black text-white" :
                    r.action === "SELL" ? "border-black bg-red-100" :
                    "border-gray-300"
                  }`}>
                    <div className="text-xs font-black uppercase">{r.symbol}</div>
                    <div className="text-2xl font-black">{r.score}</div>
                    <div className={`text-[10px] font-black uppercase mt-1 ${
                      r.action === "BUY" ? "text-green-300" :
                      r.action === "SELL" ? "text-red-600" :
                      "text-gray-400"
                    }`}>{r.action}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="col-span-1 md:col-span-6 bg-white border-2 border-black p-6">
            <TradeFeed trades={data.lastTrades} />
          </div>
          <div className="col-span-1 md:col-span-6 bg-white border-2 border-black p-6">
            <X402Ledger transactions={data.x402Transactions} />
          </div>

          {/* Live Agent Log Feed */}
          {data.logFeed && data.logFeed.length > 0 && (
            <div className="col-span-1 md:col-span-12 bg-black border-2 border-black p-6">
              <h2 className="text-sm font-black uppercase tracking-widest mb-4 text-white border-b border-white/20 pb-2">
                Agent Log Feed
              </h2>
              <div className="font-mono text-xs text-green-400 space-y-1 max-h-64 overflow-y-auto">
                {data.logFeed.map((log, i) => (
                  <div key={i} className="opacity-90 hover:opacity-100">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <footer className="pt-8 border-t-2 border-black flex flex-col md:flex-row justify-between items-center text-[10px] font-black uppercase tracking-widest text-black">
          <div>Autonomous Trading Engine Protocol</div>
          <div className="flex gap-6 mt-4 md:mt-0">
            <span>Agent: ERC-8004 COMPLIANT</span>
            <span>Skill: ERC-8183 COMPLIANT</span>
          </div>
        </footer>
      </div>
    </main>
  );
}
