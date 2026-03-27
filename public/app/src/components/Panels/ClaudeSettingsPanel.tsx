import { useState, useEffect, useCallback } from "react";

export default function ClaudeSettingsPanel({ onClose }: { onClose: () => void }) {
  const [content, setContent] = useState("");
  const [filePath, setFilePath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/claude-settings")
      .then((r) => r.json())
      .then((data) => {
        setContent(data.content || "{\n  \n}");
        setFilePath(data.path);
        setLoading(false);
        if (!data.content) setDirty(true);
      });
  }, []);

  const save = useCallback(async () => {
    setError("");
    try {
      JSON.parse(content);
    } catch (e: any) {
      setError("Invalid JSON: " + e.message);
      return;
    }
    setSaving(true);
    const res = await fetch("/api/claude-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    const data = await res.json();
    setSaving(false);
    if (data.error) {
      setError(data.error);
    } else {
      setDirty(false);
    }
  }, [content]);

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
          <span className="text-xs font-medium text-gray-300">.claude/settings.json</span>
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
      {error && (
        <div className="px-3 py-1 text-xs text-red-400 border-b border-border bg-red-900/10">
          {error}
        </div>
      )}
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">Loading...</div>
      ) : (
        <textarea
          className="flex-1 bg-surface p-3 text-sm text-gray-200 font-mono resize-none outline-none"
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            setDirty(true);
            setError("");
          }}
          spellCheck={false}
        />
      )}
    </div>
  );
}
