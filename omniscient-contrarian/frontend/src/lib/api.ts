import { AgentStatus } from "../types";

export async function fetchAgentStatus(): Promise<AgentStatus> {
  const res = await fetch("http://localhost:3000/status");
  if (!res.ok) {
    throw new Error("Failed to fetch agent status");
  }
  return res.json();
}
