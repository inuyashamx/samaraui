import { useAppStore } from "@/store/appStore";

const MODEL_OPTIONS = [
  { label: "Claude Opus 4.6 (1M)", value: "claude-opus-4-6-20250624" },
  { label: "Claude Opus 4.6", value: "claude-opus-4-6" },
  { label: "Claude Sonnet 4.6", value: "claude-sonnet-4-6" },
  { label: "Claude Haiku 4.5", value: "claude-haiku-4-5-20251001" },
];

const PERMISSION_OPTIONS = [
  { label: "Bypass Permissions", value: "bypassPermissions" },
  { label: "Default", value: "default" },
  { label: "Accept Edits", value: "acceptEdits" },
];

export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  const tabs = useAppStore((s) => s.tabs);
  const activeTabId = useAppStore((s) => s.activeTabId);
  const updateTab = useAppStore((s) => s.updateTab);
  const activeTab = tabs.find((t) => t.id === activeTabId);

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface-1 shrink-0">
        <span className="text-xs font-medium text-gray-300">Settings</span>
        <button className="text-gray-500 hover:text-white text-sm px-1" onClick={onClose}>✕</button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Active Agent Settings */}
        {activeTab && (
          <section>
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
              Agent: {activeTab.name}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Model</label>
                <select
                  className="w-full bg-surface-2 border border-border rounded px-2 py-1.5 text-xs text-gray-200 outline-none focus:border-accent"
                  value={activeTab.model || "claude-sonnet-4-6"}
                  onChange={(e) => updateTab(activeTabId!, { model: e.target.value })}
                >
                  {MODEL_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-1">Permission Mode</label>
                <select
                  className="w-full bg-surface-2 border border-border rounded px-2 py-1.5 text-xs text-gray-200 outline-none focus:border-accent"
                  value={activeTab.permissionMode}
                  onChange={(e) => updateTab(activeTabId!, { permissionMode: e.target.value as any })}
                >
                  {PERMISSION_OPTIONS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-1">Max Turns</label>
                <input
                  type="number"
                  className="w-full bg-surface-2 border border-border rounded px-2 py-1.5 text-xs text-gray-200 outline-none focus:border-accent"
                  placeholder="Unlimited"
                  value={activeTab.maxTurns ?? ""}
                  onChange={(e) => updateTab(activeTabId!, { maxTurns: e.target.value ? parseInt(e.target.value) : null })}
                  min={1}
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-1">Max Budget (USD)</label>
                <input
                  type="number"
                  className="w-full bg-surface-2 border border-border rounded px-2 py-1.5 text-xs text-gray-200 outline-none focus:border-accent"
                  placeholder="No limit"
                  value={activeTab.maxBudget ?? ""}
                  onChange={(e) => updateTab(activeTabId!, { maxBudget: e.target.value ? parseFloat(e.target.value) : null })}
                  min={0}
                  step={0.5}
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-1">System Prompt Override</label>
                <textarea
                  className="w-full bg-surface-2 border border-border rounded px-2 py-1.5 text-xs text-gray-200 outline-none focus:border-accent resize-none font-mono"
                  rows={4}
                  placeholder="Additional instructions appended to system prompt..."
                  value={activeTab.systemPromptOverride || ""}
                  onChange={(e) => updateTab(activeTabId!, { systemPromptOverride: e.target.value || null })}
                />
              </div>
            </div>
          </section>
        )}

        <hr className="border-border" />

        {/* Session Info */}
        {activeTab && (
          <section>
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Session Info</h3>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <span className="text-gray-300">{activeTab.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Session ID</span>
                <span className="text-gray-400 font-mono truncate ml-2 max-w-[160px]">{activeTab.sessionId || "—"}</span>
              </div>
              {activeTab.lastCost != null && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Last Cost</span>
                  <span className="text-gray-300">${activeTab.lastCost.toFixed(4)}</span>
                </div>
              )}
              {activeTab.lastDuration != null && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Last Duration</span>
                  <span className="text-gray-300">{(activeTab.lastDuration / 1000).toFixed(1)}s</span>
                </div>
              )}
              {activeTab.lastTurns != null && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Last Turns</span>
                  <span className="text-gray-300">{activeTab.lastTurns}</span>
                </div>
              )}
              {activeTab.lastInputTokens != null && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Context</span>
                  <span className={`${activeTab.lastInputTokens > 800000 ? "text-red-400" : activeTab.lastInputTokens > 500000 ? "text-amber-400" : "text-green-400"}`}>
                    {Math.round(activeTab.lastInputTokens / 1000)}k / 1M
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Messages</span>
                <span className="text-gray-300">{activeTab.messages.length}</span>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
