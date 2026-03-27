import { useEffect, useRef } from "react";
import { marked } from "marked";
import hljs from "highlight.js";
import type { Message } from "@shared/types/agent";
import { getToolDescription, escapeHtml } from "@/lib/constants";

function renderMarkdown(text: string): string {
  try {
    return marked.parse(text, { async: false }) as string;
  } catch {
    return escapeHtml(text);
  }
}

export default function ChatMessage({ message }: { message: Message }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.querySelectorAll("pre code").forEach((el) => {
        hljs.highlightElement(el as HTMLElement);
      });
    }
  }, [message.content, message.toolResult]);

  if (message.role === "user") {
    return (
      <div className="px-4 py-3 bg-surface-1 rounded-lg mx-3 my-2">
        <div className="text-xs text-gray-500 mb-1 font-medium">You</div>
        <div className="text-sm whitespace-pre-wrap">{message.content}</div>
        {message.images && message.images.length > 0 && (
          <div className="flex gap-2 mt-2 flex-wrap">
            {message.images.map((img, i) => (
              <img
                key={i}
                src={`data:${img.mimeType};base64,${img.data}`}
                alt=""
                className="max-h-48 rounded border border-border"
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (message.role === "assistant") {
    return (
      <div className="px-4 py-2 mx-3 my-1" ref={ref}>
        <div
          className="text-sm prose max-w-none text-gray-200"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
        />
      </div>
    );
  }

  if (message.role === "tool") {
    const rawName = message.toolName || "";
    const shortName = rawName.includes("__") ? rawName.split("__").pop()! : rawName;
    const desc = getToolDescription(rawName, message.toolInput);
    return (
      <div className="mx-3 my-1 px-3 py-2 bg-surface-1 border-l-2 border-accent rounded text-xs">
        <div className="flex items-center gap-2">
          <span className="text-accent font-mono font-medium">{shortName}</span>
          <span className="text-gray-400">{desc}</span>
          {message.elapsed != null && (
            <span className="text-gray-600 ml-auto">{message.elapsed.toFixed(1)}s</span>
          )}
        </div>
        {message.toolResult && (
          <details className="mt-1">
            <summary className="text-gray-500 cursor-pointer hover:text-gray-300">Result</summary>
            <pre className="mt-1 text-xs text-gray-400 overflow-x-auto whitespace-pre-wrap max-h-40 overflow-y-auto">
              {message.toolResult}
            </pre>
          </details>
        )}
      </div>
    );
  }

  if (message.role === "system") {
    return (
      <div className="mx-3 my-1 px-3 py-2 bg-red-900/20 border-l-2 border-red-500 rounded text-xs text-red-300">
        {message.content}
      </div>
    );
  }

  return null;
}
