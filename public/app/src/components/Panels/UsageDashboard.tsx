import { useState, useEffect } from "react";

interface UsageEntry {
  utilization: number;
  resets_at: string;
}

function formatReset(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff < 0) return "now";
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hours < 24) return `${hours}h ${remMins}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

function barColor(pct: number): string {
  if (pct >= 80) return "bg-red-400";
  if (pct >= 50) return "bg-amber-400";
  return "bg-green-400";
}

function textColor(pct: number): string {
  if (pct >= 80) return "text-red-400";
  if (pct >= 50) return "text-amber-400";
  return "text-green-400";
}

const CATEGORY_LABELS: Record<string, string> = {
  five_hour: "5 Hour",
  seven_day: "7 Day",
  seven_day_opus: "7 Day (Opus)",
  seven_day_sonnet: "7 Day (Sonnet)",
  seven_day_oauth_apps: "7 Day (OAuth Apps)",
  seven_day_cowork: "7 Day (Cowork)",
};

export default function UsageDashboard({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    setLoading(true);
    fetch("/api/usage")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); });
  };

  useEffect(() => { refresh(); }, []);

  const entries: { label: string; entry: UsageEntry }[] = [];
  if (data && !data.error) {
    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === "object" && "utilization" in value && value.utilization != null) {
        entries.push({
          label: CATEGORY_LABELS[key] || key,
          entry: value as UsageEntry,
        });
      }
    }
  }

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface-1 shrink-0">
        <span className="text-xs font-medium text-gray-300">Usage Dashboard</span>
        <div className="flex items-center gap-2">
          <button className="text-gray-500 hover:text-white text-xs px-1" onClick={refresh}>↻</button>
          <button className="text-gray-500 hover:text-white text-sm px-1" onClick={onClose}>✕</button>
        </div>
      </div>
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">Loading...</div>
      ) : data?.error ? (
        <div className="flex-1 flex items-center justify-center text-red-400 text-xs p-4">{data.error}</div>
      ) : entries.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-gray-600 text-xs">No usage data available</div>
      ) : (
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {entries.map(({ label, entry }) => {
            const pct = Math.min(100, Math.round(entry.utilization));
            return (
              <div key={label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-300">{label}</span>
                  <span className={`text-xs font-mono ${textColor(pct)}`}>{pct}%</span>
                </div>
                <div className="w-full h-2 bg-surface-3 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${barColor(pct)}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="text-xs text-gray-600 mt-0.5">
                  Resets in {formatReset(entry.resets_at)}
                </div>
              </div>
            );
          })}

          {data?.extra_usage?.is_enabled && (
            <>
              <hr className="border-border" />
              <div>
                <div className="text-xs text-gray-400 font-medium mb-1">Extra Usage</div>
                <div className="text-xs text-gray-500">
                  {data.extra_usage.used_credits != null
                    ? `$${data.extra_usage.used_credits.toFixed(2)} / $${data.extra_usage.monthly_limit?.toFixed(2) || "∞"}`
                    : "Enabled"}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
