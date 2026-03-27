import { useEffect, useRef } from "react";
import { useAppStore } from "@/store/appStore";
import ChatToolbar from "./ChatToolbar";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import AgentStatus from "./AgentStatus";

export default function ChatPanel({ tabId }: { tabId: string }) {
  const messages = useAppStore(
    (s) => s.tabs.find((t) => t.id === tabId)?.messages || []
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, messages[messages.length - 1]?.content]);

  return (
    <div className="flex flex-col h-full">
      <ChatToolbar tabId={tabId} />
      <div className="flex-1 overflow-y-auto" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-600 text-sm">
            <div className="text-center">
              <div className="text-2xl mb-2">&#9672;</div>
              <div>Start a conversation with the agent</div>
              <div className="text-xs text-gray-700 mt-1">
                The agent can read, write, and edit files in your project
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg, i) => <ChatMessage key={i} message={msg} />)
        )}
        <AgentStatus tabId={tabId} />
      </div>
      <ChatInput tabId={tabId} />
    </div>
  );
}
