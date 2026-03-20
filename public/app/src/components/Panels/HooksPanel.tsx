import { useState, useEffect } from "react";

interface HookEntry {
  event: string;
  matchers: Array<{ matcher?: string; hooks: Array<{ type: string; command: string }> }>;
}

export default function HooksPanel({ onClose }: { onClose: () => void }) {
  const [hooks, setHooks] = useState<HookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/project-settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          setLoading(false);
          return;
        }
        const settings = data.content ? JSON.parse(data.content) : {};
        const hookEntries: HookEntry[] = [];
        if (settings.hooks) {
          for (const [event, matchers] of Object.entries(settings.hooks)) {
            hookEntries.push({ event, matchers: matchers as any });
          }
        }
        setHooks(hookEntries);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load settings");
        setLoading(false);
      });
  }, []);

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface-1 shrink-0">
        <span className="text-xs font-medium text-gray-300">Hooks</span>
        <button className="text-gray-500 hover:text-white text-sm px-1" onClick={onClose}>✕</button>
      </div>
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">Loading...</div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center text-red-400 text-xs p-4">{error}</div>
      ) : hooks.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-gray-600 text-xs">
          <div className="text-center">
            <div>No hooks configured</div>
            <div className="text-gray-700 mt-1">Add hooks to .claude/settings.json</div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {hooks.map((h) => (
            <div key={h.event} className="px-3 py-2 border-b border-border">
              <div className="text-xs font-medium text-accent mb-1">{h.event}</div>
              {h.matchers.map((m, i) => (
                <div key={i} className="ml-2 text-xs text-gray-400 mb-1">
                  {m.matcher && <div className="text-gray-500">matcher: {m.matcher}</div>}
                  {m.hooks?.map((hook, j) => (
                    <div key={j} className="font-mono text-gray-300 truncate">
                      {hook.command}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
