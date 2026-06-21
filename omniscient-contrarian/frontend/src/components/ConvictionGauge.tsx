import { ConvictionScore } from "../types";

function Gauge({ value, label }: { value: number; label: string }) {
  const radius = 35;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div className="flex flex-col items-center border border-black p-4 bg-white">
      <div className="relative flex items-center justify-center w-24 h-24">
        <svg className="transform -rotate-90 w-full h-full">
          <circle
            cx="48"
            cy="48"
            r={radius}
            stroke="#EAEAEA"
            strokeWidth="8"
            fill="transparent"
          />
          <circle
            cx="48"
            cy="48"
            r={radius}
            stroke="#000000"
            strokeWidth="8"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="square"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <span className="absolute text-2xl font-black text-black">{value}</span>
      </div>
      <span className="swiss-sublabel mt-3 text-center">{label}</span>
    </div>
  );
}

export function ConvictionGauge({ score }: { score: ConvictionScore }) {
  return (
    <div className="flex flex-col h-full">
      <h2 className="bold-heading">Composite Conviction Score</h2>
      
      <div className="flex flex-col lg:flex-row items-stretch justify-between gap-6 h-full">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1">
          <Gauge value={score.social} label="Social Hype" />
          <Gauge value={score.flow} label="Whale Flow" />
          <Gauge value={score.funding} label="Funding Rate" />
          <Gauge value={score.news} label="News Sentiment" />
        </div>
        
        <div className="flex flex-col items-center justify-center p-8 bg-black text-white w-full lg:w-48 min-h-[160px]">
          <span className="text-7xl font-black leading-none mb-1">
            {score.composite}
          </span>
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 text-center">Master Signal</span>
        </div>
      </div>
    </div>
  );
}
