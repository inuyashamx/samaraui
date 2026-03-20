import { useState, useEffect, useRef, useMemo } from "react";

interface Command {
  label: string;
  category: string;
  shortcut?: string;
  action: () => void;
}

export default function CommandPalette({
  commands,
  onClose,
}: {
  commands: Command[];
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = useMemo(() => {
    if (!query) return commands;
    const q = query.toLowerCase();
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q)
    );
  }, [query, commands]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      filtered[selectedIndex].action();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
      onClick={onClose}
    >
      <div
        className="bg-surface-1 border border-border rounded-lg shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-2 border-b border-border">
          <input
            ref={inputRef}
            className="w-full bg-transparent text-sm text-white outline-none placeholder-gray-500 px-2 py-1"
            placeholder="Type a command..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div className="max-h-64 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-gray-600 text-xs">
              No commands found
            </div>
          ) : (
            filtered.map((cmd, i) => (
              <div
                key={`${cmd.category}-${cmd.label}`}
                className={`flex items-center justify-between px-3 py-1.5 text-xs cursor-pointer ${
                  i === selectedIndex
                    ? "bg-accent/20 text-white"
                    : "text-gray-300 hover:bg-surface-2"
                }`}
                onClick={() => {
                  cmd.action();
                  onClose();
                }}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-gray-600 w-14 truncate">{cmd.category}</span>
                  <span>{cmd.label}</span>
                </div>
                {cmd.shortcut && (
                  <span className="text-gray-600 ml-2">{cmd.shortcut}</span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
