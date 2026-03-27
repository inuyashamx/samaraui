import { useEffect, useState } from "react";
import { useAppStore } from "@/store/appStore";
import { getToolDescription } from "@/lib/constants";

export default function AgentStatus({ tabId }: { tabId: string }) {
  const tab = useAppStore((s) => s.tabs.find((t) => t.id === tabId));
  const [elapsed, setElapsed] = useState(0);
  const [startTime] = useState(() => Date.now());

  const isRunning = tab?.status === "running";

  // Timer that ticks every second while running
  useEffect(() => {
    if (!isRunning) {
      setElapsed(0);
      return;
    }
    const start = Date.now();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  if (!isRunning) return null;

  // Determine current activity from the last message
  const messages = tab?.messages || [];
  const lastMsg = messages[messages.length - 1];

  let status = "Thinking";
  let detail = "";

  if (lastMsg?.role === "tool" && !lastMsg.toolResult) {
    // Tool is currently executing
    const rawName = lastMsg.toolName || "";
    const shortName = rawName.includes("__") ? rawName.split("__").pop()! : rawName;
    status = shortName;
    detail = getToolDescription(rawName, lastMsg.toolInput);
  } else if (lastMsg?.role === "tool" && lastMsg.toolResult) {
    // Tool finished, model is thinking about result
    status = "Thinking";
  } else if (lastMsg?.role === "assistant" && lastMsg.content) {
    // Model is streaming text
    status = "Writing";
  }

  const formatTime = (s: number) => {
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  return (
    <div className="mx-3 my-2 flex items-center gap-2 text-xs text-gray-400">
      <span className="inline-flex">
        <span className="animate-pulse text-accent">●</span>
      </span>
      <span className="text-gray-300 font-medium">{status}</span>
      {detail && <span className="text-gray-500 truncate">{detail}</span>}
      <span className="text-gray-600 ml-auto shrink-0">{formatTime(elapsed)}</span>
    </div>
  );
}
