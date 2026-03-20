import { useEffect, useRef, useState } from "react";

export interface MenuItem {
  label: string;
  shortcut?: string;
  action?: () => void;
  enabled?: boolean;
  separator?: boolean;
  submenu?: MenuItem[];
  checked?: boolean;
}

interface MenuDropdownProps {
  items: MenuItem[];
  onClose: () => void;
}

export default function MenuDropdown({ items, onClose }: MenuDropdownProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        // Don't close if clicking on menu bar triggers - parent handles that
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 mt-0.5 bg-surface-2 border border-border rounded shadow-xl py-1 min-w-[220px] z-[90]"
    >
      {items.map((item, i) => {
        if (item.separator) {
          return <div key={i} className="border-t border-border my-1" />;
        }
        return <DropdownItem key={i} item={item} onClose={onClose} />;
      })}
    </div>
  );
}

function DropdownItem({
  item,
  onClose,
}: {
  item: MenuItem;
  onClose: () => void;
}) {
  const [showSub, setShowSub] = useState(false);
  const enabled = item.enabled !== false;
  const hasSubmenu = item.submenu && item.submenu.length > 0;

  const handleClick = () => {
    if (!enabled || hasSubmenu) return;
    item.action?.();
    onClose();
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => hasSubmenu && setShowSub(true)}
      onMouseLeave={() => hasSubmenu && setShowSub(false)}
    >
      <button
        onClick={handleClick}
        disabled={!enabled && !hasSubmenu}
        className={`w-full flex items-center justify-between px-3 py-1.5 text-xs ${
          enabled
            ? "text-gray-300 hover:bg-surface-3 hover:text-white"
            : "text-gray-600 cursor-default"
        }`}
        title={!enabled ? "Coming soon" : undefined}
      >
        <span className="flex items-center gap-2">
          {item.checked !== undefined && (
            <span className="w-3 text-center">
              {item.checked ? "\u2022" : ""}
            </span>
          )}
          {item.label}
        </span>
        <span className="flex items-center gap-2">
          {item.shortcut && (
            <span className="text-gray-600 text-[10px] ml-4">
              {item.shortcut}
            </span>
          )}
          {hasSubmenu && <span className="text-gray-600 ml-2">{"\u25B8"}</span>}
        </span>
      </button>
      {hasSubmenu && showSub && (
        <div className="absolute left-full top-0 ml-0.5 bg-surface-2 border border-border rounded shadow-xl py-1 min-w-[180px] z-[91]">
          {item.submenu!.map((sub, j) => {
            if (sub.separator) {
              return <div key={j} className="border-t border-border my-1" />;
            }
            return <DropdownItem key={j} item={sub} onClose={onClose} />;
          })}
        </div>
      )}
    </div>
  );
}
