import { useState, useEffect, useCallback } from "react";

export default function ClaudeMdPanel({ onClose }: { onClose: () => void }) {
  const [content, setContent] = useState("");
  const [filePath, setFilePath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    fetch("/api/claude-md")
      .then((r) => r.json())
      .then((data) => {
        setContent(data.content || "");
        setFilePath(data.path);
        setLoading(false);
      });
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    await fetch("/api/claude-md", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, path: filePath }),
    });
    setSaving(false);
    setDirty(false);
  }, [content, filePath]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        if (dirty) save();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [dirty, save]);

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface-1 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-300">CLAUDE.md</span>
          {dirty && <span className="text-xs text-accent">modified</span>}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="px-2 py-0.5 text-xs bg-accent text-black rounded hover:bg-accent-light disabled:opacity-50 transition-colors"
            onClick={save}
            disabled={!dirty || saving}
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            className="text-gray-500 hover:text-white text-sm px-1"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
      </div>
      {filePath && (
        <div className="px-3 py-1 text-xs text-gray-600 font-mono border-b border-border bg-surface">
          {filePath}
        </div>
      )}
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">Loading...</div>
      ) : content === "" && !filePath ? (
        <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
          <div className="text-center">
            <div className="mb-2">No CLAUDE.md found</div>
            <button
              className="text-accent text-xs hover:underline"
              onClick={() => {
                setContent("# Project Instructions\n\n");
                setFilePath(null);
                setDirty(true);
              }}
            >
              Create one
            </button>
          </div>
        </div>
      ) : (
        <textarea
          className="flex-1 bg-surface p-3 text-sm text-gray-200 font-mono resize-none outline-none"
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            setDirty(true);
          }}
          spellCheck={false}
        />
      )}
    </div>
  );
}
