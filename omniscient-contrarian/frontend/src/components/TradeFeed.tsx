import { Trade } from "../types";

export function TradeFeed({ trades }: { trades: Trade[] }) {
  return (
    <div className="flex flex-col h-full">
      <h2 className="bold-heading">Execution Ledger (Trade Feed)</h2>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-[10px] uppercase tracking-widest text-black border-b-2 border-black font-black">
            <tr>
              <th className="pb-3 pr-2">Time</th>
              <th className="pb-3 pr-2">Action</th>
              <th className="pb-3 pr-2">Token</th>
              <th className="pb-3 text-right pr-2">Amount</th>
              <th className="pb-3 text-right pr-2">Price</th>
              <th className="pb-3 text-center">Tx</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((trade, i) => (
              <tr key={i} className="border-b border-black hover:bg-[#F5F5F5] transition-colors">
                <td className="py-3 text-gray-500 font-mono text-xs pr-2">{trade.time}</td>
                <td className="py-3 pr-2">
                  <span className={`px-2 py-0.5 text-xs font-black uppercase border ${trade.side === 'BUY' ? 'bg-black text-white border-black' : 'bg-transparent text-black border-black'}`}>
                    {trade.side}
                  </span>
                </td>
                <td className="py-3 font-bold text-black pr-2">{trade.token}</td>
                <td className="py-3 text-right text-black font-bold pr-2">{Number(trade.amount).toFixed(2)}</td>
                <td className="py-3 text-right font-mono font-black text-black pr-2">${trade.price.toFixed(2)}</td>
                <td className="py-3 text-center">
                  <a href={`https://bscscan.com/tx/${trade.txHash}`} target="_blank" rel="noreferrer" className="inline-block text-black hover:underline font-bold text-xs">
                    [LINK]
                  </a>
                </td>
              </tr>
            ))}
            {trades.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-400 italic font-bold">No trades executed yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
