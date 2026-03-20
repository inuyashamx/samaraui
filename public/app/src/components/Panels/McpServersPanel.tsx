import { useState, useEffect } from "react";

interface McpServer {
  name: string;
  type: string;
  command?: string;
  args?: string[];
}

export default function McpServersPanel({ onClose }: { onClose: () => void }) {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/mcp-servers")
      .then((r) => r.json())
      .then((data) => {
        setServers(data.servers || []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface-1 shrink-0">
        <span className="text-xs font-medium text-gray-300">MCP Servers</span>
        <button className="text-gray-500 hover:text-white text-sm px-1" onClick={onClose}>✕</button>
      </div>
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">Loading...</div>
      ) : servers.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-gray-600 text-xs">
          <div className="text-center">
            <div>No MCP servers configured</div>
            <div className="text-gray-700 mt-1">Add servers to .mcp.json</div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {servers.map((s) => (
            <div key={s.name} className="px-3 py-2 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-200">{s.name}</span>
                <span className="text-xs text-gray-600 font-mono">{s.type}</span>
              </div>
              {s.command && (
                <div className="text-xs text-gray-500 font-mono mt-0.5 truncate">
                  {s.command} {(s.args || []).join(" ")}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
