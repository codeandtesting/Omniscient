export function DrawdownMeter({ percentage }: { percentage: number }) {
  const maxDrawdown = 30; // 30% DQ limit
  const normalized = Math.min(100, Math.max(0, (percentage / maxDrawdown) * 100));
  
  let statusText = "SAFE OPERATIONAL LEVEL";
  if (percentage >= 15) {
    statusText = "EMERGENCY VETO ACTIVE";
  } else if (percentage >= 10) {
    statusText = "RISK WARNING STATE";
  }

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex justify-between items-center border-b border-black pb-2">
        <h2 className="swiss-sublabel">Drawdown Monitoring</h2>
      </div>
      
      <div className="flex items-baseline space-x-2">
        <span className="text-4xl font-black text-black tracking-tight">{percentage.toFixed(1)}%</span>
        <span className="text-gray-400 text-xs font-bold uppercase">/ {maxDrawdown}% Max DQ</span>
      </div>

      <div className="h-6 w-full bg-[#EAEAEA] border-2 border-black overflow-hidden p-0.5">
        <div 
          className="h-full bg-black transition-all duration-1000 ease-out"
          style={{ width: `${normalized}%` }}
        />
      </div>
      
      <div className="flex justify-between text-[9px] text-black font-black tracking-widest border-t border-black pt-2">
        <span>0%</span>
        <span className="font-black">15% VETO</span>
        <span>30% DQ LIMIT</span>
      </div>

      <div className="text-[10px] font-black uppercase text-center py-1 bg-black text-white">
        {statusText}
      </div>
    </div>
  );
}
