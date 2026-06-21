import { Heartbeat } from "../types";

export function HeartbeatStatus({ data }: { data: Heartbeat }) {
  const isActive = data.status === "active";
  
  return (
    <div className="flex flex-col space-y-4">
      <h2 className="swiss-sublabel border-b border-black pb-2">WalletConnect Override</h2>
      
      <div className="flex items-center space-x-6">
        <div className={`h-12 w-12 border-2 border-black flex items-center justify-center font-black text-xl ${isActive ? 'bg-black text-white' : 'bg-white text-black'}`}>
          {isActive ? 'OK' : '!!'}
        </div>
        
        <div>
          <div className="text-2xl font-black uppercase tracking-tight">
            {isActive ? 'Heartbeat Active' : 'Heartbeat Missed'}
          </div>
          <div className="text-xs text-gray-500 mt-1 uppercase font-bold">
            Next Veto Due: {new Date(data.nextDue).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
      
      <div className="pt-2 text-[10px] text-gray-400 border-t border-gray-200 uppercase font-bold">
        Last Verification: {new Date(data.lastSeen).toLocaleString()}
      </div>
    </div>
  );
}
