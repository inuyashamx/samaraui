import { useState, useEffect } from "react";

export default function GitPanel({ onClose }: { onClose: () => void }) {
  const [branch, setBranch] = useState("");
  const [status, setStatus] = useState("");
  const [commits, setCommits] = useState<{ hash: string; message: string; date: string; author: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"status" | "log">("status");

  const refresh = async () => {
    setLoading(true);
    const [statusRes, logRes] = await Promise.all([
      fetch("/api/git/status").then((r) => r.json()),
      fetch("/api/git/log").then((r) => r.json()),
    ]);
    setBranch(statusRes.branch || "");
    setStatus(statusRes.status || statusRes.error || "");
    setCommits(logRes.commits || []);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface-1 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-300">Git</span>
          {branch && (
            <span className="text-xs text-accent font-mono">{branch}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="text-gray-500 hover:text-white text-xs px-1"
            onClick={refresh}
          >
            ↻
          </button>
          <button
            className="text-gray-500 hover:text-white text-sm px-1"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
      </div>
      <div className="flex border-b border-border shrink-0">
        <button
          className={`px-3 py-1.5 text-xs ${tab === "status" ? "text-white border-b border-accent" : "text-gray-500 hover:text-gray-300"}`}
          onClick={() => setTab("status")}
        >
          Status
        </button>
        <button
          className={`px-3 py-1.5 text-xs ${tab === "log" ? "text-white border-b border-accent" : "text-gray-500 hover:text-gray-300"}`}
          onClick={() => setTab("log")}
        >
          Log
        </button>
      </div>
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">Loading...</div>
      ) : tab === "status" ? (
        <div className="flex-1 overflow-y-auto p-3">
          {status ? (
            <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap">{status}</pre>
          ) : (
            <div className="text-xs text-gray-600">Working tree clean</div>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {commits.map((c) => (
            <div key={c.hash} className="px-3 py-1.5 border-b border-border hover:bg-surface-1 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-accent font-mono">{c.hash}</span>
                <span className="text-gray-300 flex-1 truncate">{c.message}</span>
              </div>
              <div className="text-gray-600 mt-0.5">
                {c.author} · {c.date}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
