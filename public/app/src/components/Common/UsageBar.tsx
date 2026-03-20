import { useEffect } from "react";
import { useAppStore } from "@/store/appStore";
import { fetchUsage } from "@/lib/api";

function usageColor(pct: number): string {
  if (pct >= 80) return "text-red-400";
  if (pct >= 50) return "text-amber-400";
  return "text-green-400";
}

function formatReset(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff < 0) return "now";
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.round(mins / 60)}h ${mins % 60}m`;
}

export default function UsageBar() {
  const usage = useAppStore((s) => s.usage);
  const setUsage = useAppStore((s) => s.setUsage);

  useEffect(() => {
    const load = async () => {
      const data = await fetchUsage();
      if (data) setUsage(data);
    };
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [setUsage]);

  if (!usage) return null;

  return (
    <div className="flex items-center gap-3 px-3 text-xs shrink-0">
      {[usage.five_hour, usage.seven_day].map((entry, i) => (
        <span key={i} className={usageColor(entry.utilization * 100)}>
          {entry.label}: {Math.round(entry.utilization * 100)}%
          <span className="text-gray-600 ml-1">
            (resets {formatReset(entry.resets_at)})
          </span>
        </span>
      ))}
    </div>
  );
}
