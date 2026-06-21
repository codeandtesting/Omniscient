import { X402Transaction } from "../types";

export function X402Ledger({ transactions }: { transactions: X402Transaction[] }) {
  return (
    <div className="flex flex-col h-full">
      <h2 className="bold-heading">x402 Protocol Settlement</h2>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-[10px] uppercase tracking-widest text-black border-b-2 border-black font-black">
            <tr>
              <th className="pb-3 pr-2">Time</th>
              <th className="pb-3 pr-2">Type</th>
              <th className="pb-3 text-right pr-2">Amount (x402)</th>
              <th className="pb-3 text-center">Tx Hash</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx, i) => (
              <tr key={i} className="border-b border-black hover:bg-[#F5F5F5] transition-colors">
                <td className="py-3 text-gray-500 font-mono text-xs pr-2">{tx.time}</td>
                <td className="py-3 pr-2">
                  <span className={`px-2 py-0.5 text-xs font-black uppercase border ${tx.type === 'REVENUE' ? 'bg-black text-white border-black' : 'bg-transparent text-black border-black'}`}>
                    {tx.type}
                  </span>
                </td>
                <td className="py-3 text-right font-mono font-black text-black pr-2">{tx.amount.toFixed(2)}</td>
                <td className="py-3 text-center">
                  {tx.txHash ? (
                    // x402 settles in USDC on Base — link to BaseScan, not BscScan.
                    <a href={`https://basescan.org/tx/${tx.txHash}`} target="_blank" rel="noreferrer" className="inline-block text-black hover:underline font-mono text-xs">
                      {tx.txHash.substring(0, 6)}...{tx.txHash.substring(tx.txHash.length - 4)}
                    </a>
                  ) : (
                    <span className="text-gray-400 font-mono text-xs">pending…</span>
                  )}
                </td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-gray-400 italic font-bold">No x402 transactions yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
