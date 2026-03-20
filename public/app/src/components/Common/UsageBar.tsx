import { useEffect } from "react";
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

  useEffect(() => {
    const load = async () => {
      const data = await fetchUsage();
      if (data && !data.error) setUsage(data);
    };
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [setUsage]);

  if (!usage) return null;

  const entries: { label: string; entry: UsageEntry }[] = [];
  const u = usage as any;
  if (u.five_hour) entries.push({ label: "5h", entry: u.five_hour });
  if (u.seven_day) entries.push({ label: "7d", entry: u.seven_day });

  if (entries.length === 0) return null;

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
