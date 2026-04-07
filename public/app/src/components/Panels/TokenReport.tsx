import { useAppStore } from "@/store/appStore";
import type { TurnUsage } from "@shared/types/agent";

// Pricing per 1M tokens (Opus 4.6 default — adjust if needed)
const PRICING: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-opus-4-6": { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 },
  "claude-opus-4-6-20250624": { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 },
  "claude-sonnet-4-6": { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  "claude-haiku-4-5-20251001": { input: 0.8, output: 4, cacheRead: 0.08, cacheWrite: 1 },
};

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function estimateCost(usage: TurnUsage[], model: string | null): number {
  const p = PRICING[model || "claude-opus-4-6"] || PRICING["claude-opus-4-6"];
  let total = 0;
  for (const u of usage) {
    total += (u.inputTokens / 1e6) * p.input;
    total += (u.outputTokens / 1e6) * p.output;
    total += (u.cacheRead / 1e6) * p.cacheRead;
    total += (u.cacheCreation / 1e6) * p.cacheWrite;
  }
  return total;
}

function barWidth(value: number, max: number): string {
  if (max === 0) return "0%";
  return `${Math.min(100, (value / max) * 100)}%`;
}

export default function TokenReport({ onClose }: { onClose: () => void }) {
  const tabs = useAppStore((s) => s.tabs);
  const activeTabId = useAppStore((s) => s.activeTabId);
  const tab = tabs.find((t) => t.id === activeTabId);
  const usage = tab?.usageHistory || [];

  // Totals
  const totals = usage.reduce(
    (acc, u) => ({
      input: acc.input + u.inputTokens,
      output: acc.output + u.outputTokens,
      cacheRead: acc.cacheRead + u.cacheRead,
      cacheCreation: acc.cacheCreation + u.cacheCreation,
    }),
    { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 }
  );

  const totalTokens = totals.input + totals.output;
  const cost = estimateCost(usage, tab?.model || null);

  // Max input for bar scaling
  const maxInput = Math.max(...usage.map((u) => u.inputTokens), 1);

  // Cache hit rate
  const cacheHitRate = totals.input > 0
    ? Math.round((totals.cacheRead / totals.input) * 100)
    : 0;

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface-1 shrink-0">
        <span className="text-xs font-medium text-gray-300">Token Report</span>
        <button className="text-gray-500 hover:text-white text-sm px-1" onClick={onClose}>✕</button>
      </div>

      {!tab || usage.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-gray-600 text-xs">
          No usage data yet. Send a message to start tracking.
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-surface-2 rounded p-2">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Total Tokens</div>
              <div className="text-sm font-mono text-gray-200 mt-0.5">{fmt(totalTokens)}</div>
            </div>
            <div className="bg-surface-2 rounded p-2">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Est. Cost</div>
              <div className="text-sm font-mono text-green-400 mt-0.5">${cost.toFixed(4)}</div>
            </div>
            <div className="bg-surface-2 rounded p-2">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Turns</div>
              <div className="text-sm font-mono text-gray-200 mt-0.5">{usage.length}</div>
            </div>
            <div className="bg-surface-2 rounded p-2">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Cache Hit</div>
              <div className={`text-sm font-mono mt-0.5 ${cacheHitRate >= 70 ? "text-green-400" : cacheHitRate >= 40 ? "text-amber-400" : "text-red-400"}`}>
                {cacheHitRate}%
              </div>
            </div>
          </div>

          {/* Breakdown */}
          <section>
            <h3 className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Breakdown</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">Input</span>
                <span className="text-gray-300 font-mono">{fmt(totals.input)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Output</span>
                <span className="text-gray-300 font-mono">{fmt(totals.output)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Cache Read</span>
                <span className="text-cyan-400 font-mono">{fmt(totals.cacheRead)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Cache Write</span>
                <span className="text-purple-400 font-mono">{fmt(totals.cacheCreation)}</span>
              </div>
            </div>
          </section>

          <hr className="border-border" />

          {/* Per-turn Timeline */}
          <section>
            <h3 className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">
              Per-Turn Input ({usage.length} turns)
            </h3>
            <div className="space-y-1">
              {usage.map((u) => (
                <div key={u.turn} className="flex items-center gap-2 text-[11px]">
                  <span className="text-gray-600 w-6 text-right shrink-0 font-mono">{u.turn}</span>
                  <div className="flex-1 h-3 bg-surface-3 rounded-sm overflow-hidden relative">
                    {/* Cache read portion */}
                    <div
                      className="absolute inset-y-0 left-0 bg-cyan-800 rounded-sm"
                      style={{ width: barWidth(u.cacheRead, maxInput) }}
                    />
                    {/* Total input bar on top */}
                    <div
                      className="absolute inset-y-0 left-0 bg-blue-500 rounded-sm opacity-60"
                      style={{ width: barWidth(u.inputTokens - u.cacheRead, maxInput) }}
                    />
                  </div>
                  <span className="text-gray-400 font-mono w-12 text-right shrink-0">{fmt(u.inputTokens)}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-600">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-cyan-800 inline-block" /> cached
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-blue-500 opacity-60 inline-block" /> new
              </span>
            </div>
          </section>

          {/* Per-turn Output */}
          <section>
            <h3 className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">
              Per-Turn Output
            </h3>
            <div className="space-y-1">
              {(() => {
                const maxOut = Math.max(...usage.map((u) => u.outputTokens), 1);
                return usage.map((u) => (
                  <div key={u.turn} className="flex items-center gap-2 text-[11px]">
                    <span className="text-gray-600 w-6 text-right shrink-0 font-mono">{u.turn}</span>
                    <div className="flex-1 h-3 bg-surface-3 rounded-sm overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-sm opacity-70"
                        style={{ width: barWidth(u.outputTokens, maxOut) }}
                      />
                    </div>
                    <span className="text-gray-400 font-mono w-12 text-right shrink-0">{fmt(u.outputTokens)}</span>
                  </div>
                ));
              })()}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
