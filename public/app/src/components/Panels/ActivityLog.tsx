import { useAppStore } from "@/store/appStore";
import { getToolDescription } from "@/lib/constants";

export default function ActivityLog({ onClose }: { onClose: () => void }) {
  const activeTabId = useAppStore((s) => s.activeTabId);
  const messages = useAppStore(
    (s) => s.tabs.find((t) => t.id === activeTabId)?.messages || []
  );

  const toolMessages = messages.filter((m) => m.role === "tool");

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface-1 shrink-0">
        <span className="text-xs font-medium text-gray-300">Activity Log</span>
        <button className="text-gray-500 hover:text-white text-sm px-1" onClick={onClose}>✕</button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {toolMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-600 text-xs">No tool activity yet</div>
        ) : (
          toolMessages.map((msg, i) => (
            <div key={i} className="px-3 py-1.5 border-b border-border text-xs">
              <div className="flex items-center gap-2">
                <span className="text-accent font-mono">{msg.toolName}</span>
                <span className="text-gray-400 flex-1 truncate">
                  {getToolDescription(msg.toolName || "", msg.toolInput)}
                </span>
                {msg.elapsed != null && (
                  <span className="text-gray-600 shrink-0">{msg.elapsed.toFixed(1)}s</span>
                )}
              </div>
              {msg.toolResult && (
                <details className="mt-0.5">
                  <summary className="text-gray-600 cursor-pointer hover:text-gray-400">Result</summary>
                  <pre className="mt-1 text-gray-500 whitespace-pre-wrap max-h-24 overflow-y-auto">{msg.toolResult}</pre>
                </details>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
