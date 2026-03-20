import { useState, useRef, useEffect } from "react";
import { useAppStore } from "@/store/appStore";

export default function ChatToolbar({ tabId }: { tabId: string }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const tab = useAppStore((s) => s.tabs.find((t) => t.id === tabId));
  const updateTab = useAppStore((s) => s.updateTab);
  const clearMessages = useAppStore((s) => s.clearMessages);

  useEffect(() => {
    if (renaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [renaming]);

  if (!tab) return null;

  const startRename = () => {
    setMenuOpen(false);
    setNameValue(tab.name);
    setRenaming(true);
  };

  const finishRename = () => {
    const name = nameValue.trim() || tab.name;
    updateTab(tabId, { name });
    setRenaming(false);
  };

  const handleClear = () => {
    setMenuOpen(false);
    clearMessages(tabId);
  };

  return (
    <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-surface-1 shrink-0">
      {renaming ? (
        <input
          ref={inputRef}
          className="bg-surface-2 border border-accent rounded px-2 py-0.5 text-xs text-gray-200 outline-none font-mono w-32"
          value={nameValue}
          onChange={(e) => setNameValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") finishRename();
            if (e.key === "Escape") setRenaming(false);
          }}
          onBlur={finishRename}
        />
      ) : (
        <span className="text-xs text-gray-500 font-medium">{tab.name}</span>
      )}
      <div className="relative">
        <button
          className="text-gray-500 hover:text-white text-sm px-1 leading-none"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          ...
        </button>
        {menuOpen && (
          <div className="absolute top-full right-0 bg-surface-2 border border-border rounded-md py-1 min-w-[160px] z-50 shadow-lg">
            <button
              className="block w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-surface-3 hover:text-white"
              onClick={handleClear}
            >
              Clear conversation
            </button>
            <button
              className="block w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-surface-3 hover:text-white"
              onClick={startRename}
            >
              Rename tab
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
