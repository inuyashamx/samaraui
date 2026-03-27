import { useState, useRef, useEffect } from "react";
import { useAppStore } from "@/store/appStore";
import { getSocket } from "@/lib/socket";

export default function ChatInput({ tabId }: { tabId: string }) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const tab = useAppStore((s) => s.tabs.find((t) => t.id === tabId));
  const addMessage = useAppStore((s) => s.addMessage);
  const updateTab = useAppStore((s) => s.updateTab);

  const isRunning = tab?.status === "running";

  // Focus input when tab becomes active
  const activeTabId = useAppStore((s) => s.activeTabId);
  useEffect(() => {
    if (activeTabId === tabId && inputRef.current) {
      inputRef.current.focus();
    }
  }, [activeTabId, tabId]);

  const send = () => {
    const text = value.trim();
    if (!text || !tab) return;

    addMessage(tabId, { role: "user", content: text });
    updateTab(tabId, { status: "running" });
    setValue("");

    const socket = getSocket();

    if (tab.sessionId) {
      socket.emit("agent:message", { agentId: tabId, prompt: text, sessionId: tab.sessionId, model: tab.model || undefined });
    } else {
      socket.emit("agent:start", { agentId: tabId, prompt: text, model: tab.model || undefined });
    }
  };

  const interrupt = () => {
    getSocket().emit("agent:interrupt", { agentId: tabId });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (isRunning) return;
      send();
    }
  };

  return (
    <div className="p-3 border-t border-border shrink-0">
      <div className="flex gap-2">
        <textarea
          ref={inputRef}
          data-chat-input
          className="flex-1 bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-white resize-none outline-none focus:border-accent placeholder-gray-600"
          placeholder={isRunning ? "Agent is working..." : "Ask the agent..."}
          rows={3}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isRunning}
        />
        {isRunning ? (
          <button
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg shrink-0 self-end transition-colors"
            onClick={interrupt}
          >
            Stop
          </button>
        ) : (
          <button
            className="px-4 py-2 bg-accent hover:bg-accent-light text-black text-sm font-medium rounded-lg shrink-0 self-end transition-colors"
            onClick={send}
          >
            Send
          </button>
        )}
      </div>
    </div>
  );
}
