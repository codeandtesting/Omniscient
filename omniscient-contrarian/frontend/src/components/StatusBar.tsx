import { AgentStatus } from "../types";

export function StatusBar({ data }: { data: AgentStatus }) {
  return (
    <div className="bg-white border-2 border-black p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
      <div>
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-black leading-none">
          Omniscient Contrarian
        </h1>
        <div className="flex gap-4 mt-2">
          <span className="swiss-sublabel">BNB HACK 2026</span>
          <span className="text-gray-400">|</span>
          <span className="swiss-sublabel">LIVE SWISS GRID TERMINAL</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-8 border-t-2 md:border-t-0 md:border-l-2 border-black pt-4 md:pt-0 md:pl-8 w-full md:w-auto">
        <div className="flex flex-col">
          <span className="swiss-sublabel">Agent Status</span>
          <span className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
            <span className={`h-3 w-3 ${
              data.agentStatus === "RUNNING" ? "bg-black" :
              data.agentStatus === "ERROR" ? "bg-red-500" :
              "bg-gray-400"
            }`}></span>
            {data.agentStatus || "CONNECTING"}
          </span>
        </div>

        <div className="flex flex-col">
          <span className="swiss-sublabel">Veto Heartbeat</span>
          <span className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
            <span className={`h-3 w-3 ${data.heartbeat.status === "active" ? "bg-black" : "bg-transparent border border-black"}`}></span>
            {data.heartbeat.status === "active" ? "Active" : "Missed"}
          </span>
        </div>
      </div>
    </div>
  );
}
