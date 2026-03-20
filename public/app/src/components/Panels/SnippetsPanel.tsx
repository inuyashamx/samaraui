import { useState, useEffect } from "react";

interface Snippet {
  id: string;
  name: string;
  content: string;
}

const STORAGE_KEY = "samara-snippets";

function loadSnippets(): Snippet[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveSnippets(snippets: Snippet[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snippets));
}

export default function SnippetsPanel({ onClose }: { onClose: () => void }) {
  const [snippets, setSnippets] = useState<Snippet[]>(loadSnippets);
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editContent, setEditContent] = useState("");

  useEffect(() => {
    saveSnippets(snippets);
  }, [snippets]);

  const addNew = () => {
    const id = `snip-${Date.now()}`;
    setSnippets([...snippets, { id, name: "New Snippet", content: "" }]);
    setEditing(id);
    setEditName("New Snippet");
    setEditContent("");
  };

  const startEdit = (s: Snippet) => {
    setEditing(s.id);
    setEditName(s.name);
    setEditContent(s.content);
  };

  const saveEdit = () => {
    if (!editing) return;
    setSnippets(snippets.map((s) =>
      s.id === editing ? { ...s, name: editName.trim() || s.name, content: editContent } : s
    ));
    setEditing(null);
  };

  const deleteSnippet = (id: string) => {
    setSnippets(snippets.filter((s) => s.id !== id));
    if (editing === id) setEditing(null);
  };

  const copyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface-1 shrink-0">
        <span className="text-xs font-medium text-gray-300">Snippets</span>
        <div className="flex items-center gap-2">
          <button
            className="text-xs text-accent hover:text-accent-light px-1"
            onClick={addNew}
          >
            + New
          </button>
          <button className="text-gray-500 hover:text-white text-sm px-1" onClick={onClose}>✕</button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {snippets.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-600 text-xs">
            <div className="text-center">
              <div>No snippets saved</div>
              <div className="text-gray-700 mt-1">Click + New to create one</div>
            </div>
          </div>
        ) : editing ? (
          <div className="p-3 space-y-2">
            <input
              className="w-full bg-surface-2 border border-border rounded px-2 py-1.5 text-xs text-gray-200 outline-none focus:border-accent"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Snippet name"
              autoFocus
            />
            <textarea
              className="w-full bg-surface-2 border border-border rounded px-2 py-1.5 text-xs text-gray-200 outline-none focus:border-accent resize-none font-mono"
              rows={8}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              placeholder="Prompt content..."
            />
            <div className="flex gap-2">
              <button
                className="px-2 py-1 text-xs bg-accent text-black rounded hover:bg-accent-light"
                onClick={saveEdit}
              >
                Save
              </button>
              <button
                className="px-2 py-1 text-xs text-gray-400 hover:text-white"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          snippets.map((s) => (
            <div key={s.id} className="px-3 py-2 border-b border-border hover:bg-surface-1 group">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-200 font-medium">{s.name}</span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                  <button className="text-gray-500 hover:text-white text-xs" onClick={() => copyToClipboard(s.content)} title="Copy">📋</button>
                  <button className="text-gray-500 hover:text-white text-xs" onClick={() => startEdit(s)} title="Edit">✏️</button>
                  <button className="text-gray-500 hover:text-red-400 text-xs" onClick={() => deleteSnippet(s.id)} title="Delete">🗑️</button>
                </div>
              </div>
              {s.content && (
                <div className="text-xs text-gray-500 mt-0.5 truncate font-mono">{s.content}</div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
