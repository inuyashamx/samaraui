import { useState, useEffect } from "react";

interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

function FileNode({ entry, depth }: { entry: FileEntry; depth: number }) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<FileEntry[]>([]);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [showContent, setShowContent] = useState(false);

  const toggle = async () => {
    if (entry.isDirectory) {
      if (!expanded) {
        const res = await fetch(`/api/files?path=${encodeURIComponent(entry.path)}`);
        const data = await res.json();
        setChildren(data.entries || []);
      }
      setExpanded(!expanded);
    } else {
      if (!showContent) {
        const res = await fetch(`/api/file?path=${encodeURIComponent(entry.path)}`);
        const data = await res.json();
        setFileContent(data.content || data.error || "");
      }
      setShowContent(!showContent);
    }
  };

  const icon = entry.isDirectory ? (expanded ? "📂" : "📁") : "📄";

  return (
    <div>
      <div
        className="flex items-center gap-1 px-2 py-0.5 hover:bg-surface-1 cursor-pointer text-xs"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={toggle}
      >
        <span className="w-4 text-center text-[10px]">{icon}</span>
        <span className={entry.isDirectory ? "text-gray-300" : "text-gray-400"}>
          {entry.name}
        </span>
      </div>
      {entry.isDirectory && expanded && children.map((child) => (
        <FileNode key={child.path} entry={child} depth={depth + 1} />
      ))}
      {!entry.isDirectory && showContent && fileContent !== null && (
        <pre
          className="mx-2 my-1 p-2 bg-surface-2 rounded text-xs text-gray-400 font-mono overflow-x-auto max-h-48 overflow-y-auto"
          style={{ marginLeft: `${depth * 16 + 24}px` }}
        >
          {fileContent.slice(0, 5000)}
          {fileContent.length > 5000 && "\n... (truncated)"}
        </pre>
      )}
    </div>
  );
}

export default function FileExplorer({ onClose }: { onClose: () => void }) {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [rootPath, setRootPath] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/files")
      .then((r) => r.json())
      .then((data) => {
        setEntries(data.entries || []);
        setRootPath(data.path || "");
        setLoading(false);
      });
  }, []);

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface-1 shrink-0">
        <span className="text-xs font-medium text-gray-300">Files</span>
        <button
          className="text-gray-500 hover:text-white text-sm px-1"
          onClick={onClose}
        >
          ✕
        </button>
      </div>
      {rootPath && (
        <div className="px-3 py-1 text-xs text-gray-600 font-mono border-b border-border truncate">
          {rootPath}
        </div>
      )}
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">Loading...</div>
      ) : (
        <div className="flex-1 overflow-y-auto py-1">
          {entries.map((entry) => (
            <FileNode key={entry.path} entry={entry} depth={0} />
          ))}
        </div>
      )}
    </div>
  );
}
