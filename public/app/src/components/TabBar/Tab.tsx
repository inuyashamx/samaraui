import StatusDot from "@/components/Common/StatusDot";
import type { Tab as TabType } from "@shared/types/agent";

interface TabProps {
  tab: TabType;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
}

export default function Tab({ tab, isActive, onSelect, onClose }: TabProps) {
  return (
    <div
      className={`group flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer border-b-2 whitespace-nowrap ${
        isActive
          ? "text-white border-accent bg-surface-1"
          : "text-gray-500 border-transparent hover:text-gray-300 hover:bg-surface-1"
      }`}
      onClick={onSelect}
    >
      <StatusDot status={tab.status} />
      <span className="truncate max-w-[120px]">{tab.name}</span>
      <button
        className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-white text-xs leading-none ml-1"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        x
      </button>
    </div>
  );
}
