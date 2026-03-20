import type { AgentStatus } from "@shared/types/agent";

export default function StatusDot({ status }: { status: AgentStatus }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full status-dot-${status}`}
      title={status}
    />
  );
}
