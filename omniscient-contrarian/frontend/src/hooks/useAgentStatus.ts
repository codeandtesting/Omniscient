import { useQuery } from "@tanstack/react-query";
import { fetchAgentStatus } from "../lib/api";
import { AgentStatus } from "../types";

export function useAgentStatus() {
  return useQuery<AgentStatus>({
    queryKey: ["agentStatus"],
    queryFn: fetchAgentStatus,
    refetchInterval: 5000,
    staleTime: 3000,
  });
}
