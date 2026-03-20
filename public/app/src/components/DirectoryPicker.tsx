import { useState, useEffect, useRef } from "react";
import { useAppStore } from "@/store/appStore";
import { checkDir, getHome, setCwd, loadState, setPreviewTarget } from "@/lib/api";

export default function DirectoryPicker() {
  const [path, setPath] = useState("");
  const [error, setError] = useState("");
  const [projects, setProjects] = useState<{ name: string; path: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const store = useAppStore();

  useEffect(() => {
    getHome().then((data) => {
      setProjects(data.projects || []);
      setPath(data.suggestions?.[0] || data.home || "");
    });
    inputRef.current?.focus();
  }, []);

  const open = async (dir: string) => {
    setError("");
    const result = await checkDir(dir);
    if (!result.valid) {
      setError("Directory not found");
      return;
    }
    await setCwd(result.path);
    store.setCwd(result.path);

    // Load saved state
    const saved = await loadState(result.path);
    if (saved?.state?.tabs?.length) {
      store.loadFromSaved(saved.state);
      // Restore preview proxy for any tab with a preview URL
      const restoredTab = saved.state.tabs.find((t: any) => t.previewUrl);
      if (restoredTab?.previewUrl) {
        setPreviewTarget(restoredTab.previewUrl);
      }
    } else {
      store.addTab();
    }

    store.setReady(true);
  };

  return (
    <div className="flex items-center justify-center h-full">
      <div className="w-full max-w-lg px-6">
        <div className="text-center mb-8">
          <div className="text-3xl text-accent mb-2">&#9672; Samara UI</div>
          <div className="text-gray-500 text-sm">Select a project directory</div>
        </div>

        <div className="mb-4">
          <input
            ref={inputRef}
            className="w-full bg-surface-1 border border-border rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-accent placeholder-gray-600 font-mono"
            placeholder="Enter project path..."
            value={path}
            onChange={(e) => setPath(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") open(path);
            }}
          />
          {error && <div className="text-red-400 text-xs mt-1">{error}</div>}
        </div>

        {projects.length > 0 && (
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="text-xs text-gray-500 px-3 py-2 bg-surface-1 border-b border-border font-medium">
              Projects
            </div>
            {projects.map((p) => (
              <div
                key={p.path}
                className="px-3 py-2 text-sm text-gray-300 hover:bg-surface-1 cursor-pointer border-b border-border last:border-0"
                onClick={() => open(p.path)}
              >
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-gray-600 font-mono">{p.path}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
