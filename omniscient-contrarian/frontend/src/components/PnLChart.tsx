import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export function PnLChart({ data, current, change }: { data: number[]; current: number; change: number }) {
  const chartData = data.map((val, index) => ({ index, value: val }));
  const isPositive = change >= 0;

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex justify-between items-start border-b-2 border-black pb-4">
        <div>
          <h2 className="swiss-sublabel mb-1">Portfolio PNL</h2>
          <div className="text-5xl font-black text-black leading-none tracking-tight">
            ${current.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="swiss-sublabel">24h Change</span>
          <div className="text-lg font-black uppercase tracking-tight">
            {isPositive ? "+" : ""}{change}%
          </div>
        </div>
      </div>
      
      <div className="flex-1 min-h-[250px] bg-[#F5F5F5] border border-black p-2">
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
            <XAxis dataKey="index" hide />
            <YAxis domain={['dataMin - 100', 'dataMax + 100']} hide />
            <Tooltip 
              contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#000000', color: '#000000', borderRadius: '0px' }}
              itemStyle={{ color: '#000000', fontWeight: 'bold' }}
              formatter={(value: number) => [`$${value.toFixed(2)}`, 'Value']}
              labelFormatter={() => ''}
            />
            <Area type="monotone" dataKey="value" stroke="#000000" strokeWidth={3} fillOpacity={0.1} fill="#000000" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
