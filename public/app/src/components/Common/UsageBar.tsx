import { useEffect, useCallback, useRef } from "react";
import { useAppStore } from "@/store/appStore";
import { fetchUsage } from "@/lib/api";

function usageColor(pct: number): string {
  if (pct >= 80) return "text-red-400";
  if (pct >= 50) return "text-amber-400";
  return "text-green-400";
}

function barColor(pct: number): string {
  if (pct >= 80) return "bg-red-400";
  if (pct >= 50) return "bg-amber-400";
  return "bg-green-400";
}

function formatReset(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff < 0) return "now";
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.round(mins / 60)}h ${mins % 60}m`;
}

interface UsageEntry {
  utilization: number;
  resets_at: string;
}

export default function UsageBar() {
  const usage = useAppStore((s) => s.usage);
  const setUsage = useAppStore((s) => s.setUsage);
  const tabs = useAppStore((s) => s.tabs);
  const prevRunning = useRef(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchUsage();
      if (data && !data.error) setUsage(data);
    } catch {}
  }, [setUsage]);

  // Poll every 30s
  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  // Refresh when any agent finishes (running -> idle/error)
  useEffect(() => {
    const anyRunning = tabs.some((t) => t.status === "running");
    if (prevRunning.current && !anyRunning) {
      // Agent just finished — refresh after short delay for API to update
      setTimeout(load, 2000);
    }
    prevRunning.current = anyRunning;
  }, [tabs, load]);

  if (!usage) {
    return (
      <div className="flex items-center px-3 text-xs text-gray-600 shrink-0">
        Usage: --
      </div>
    );
  }

  const entries: { label: string; entry: UsageEntry }[] = [];
  const u = usage as any;
  if (u.five_hour) entries.push({ label: "5h", entry: u.five_hour });
  if (u.seven_day) entries.push({ label: "7d", entry: u.seven_day });

  if (entries.length === 0) {
    return (
      <div className="flex items-center px-3 text-xs text-gray-600 shrink-0">
        Usage: --
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-3 text-xs shrink-0">
      {entries.map(({ label, entry }) => {
        const pct = Math.min(100, Math.round(entry.utilization));
        return (
          <div key={label} className="flex items-center gap-1.5">
            <span className={usageColor(pct)}>{label} {pct}%</span>
            <div className="w-12 h-1.5 bg-surface-3 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${barColor(pct)}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-gray-600">{formatReset(entry.resets_at)}</span>
          </div>
        );
      })}
    </div>
  );
}
