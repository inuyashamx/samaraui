import { useState } from "react";
import { useAppStore } from "@/store/appStore";

interface AddressBarProps {
  tabId: string;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
}

export default function AddressBar({ tabId, iframeRef }: AddressBarProps) {
  const tab = useAppStore((s) => s.tabs.find((t) => t.id === tabId));
  const updateTab = useAppStore((s) => s.updateTab);
  const [editingUrl, setEditingUrl] = useState(false);
  const [urlInput, setUrlInput] = useState("");

  if (!tab) return null;

  const goBack = () => {
    try {
      iframeRef.current?.contentWindow?.history.back();
    } catch {}
  };

  const refresh = () => {
    try {
      iframeRef.current?.contentWindow?.location.reload();
    } catch {
      if (iframeRef.current) iframeRef.current.src = iframeRef.current.src;
    }
  };

  const navigate = (route: string) => {
    if (iframeRef.current) {
      iframeRef.current.src = route;
      updateTab(tabId, { previewRoute: route });
    }
  };

  const zoom = (delta: number) => {
    if (!tab) return;
    let z = tab.zoom;
    if (delta === 0) z = 100;
    else z = Math.max(30, Math.min(200, z + delta));
    updateTab(tabId, { zoom: z });
  };

  const openExternal = () => {
    if (tab.previewUrl) {
      window.open(tab.previewUrl + tab.previewRoute, "_blank");
    }
  };

  const startEditUrl = () => {
    setUrlInput(tab.previewUrl || "");
    setEditingUrl(true);
  };

  const applyUrl = () => {
    let url = urlInput.trim();
    if (url && !url.match(/^https?:\/\//)) url = `http://${url}`;
    if (url) {
      updateTab(tabId, { previewUrl: url });
      import("@/lib/api").then((m) => m.setPreviewTarget(url));
    }
    setEditingUrl(false);
  };

  return (
    <div className="flex items-center gap-1 px-2 py-1 border-b border-border bg-surface-1 text-xs shrink-0">
      <button className="px-1.5 py-0.5 text-gray-500 hover:text-white" onClick={goBack} title="Back">
        &larr;
      </button>
      <button className="px-1.5 py-0.5 text-gray-500 hover:text-white" onClick={refresh} title="Refresh">
        &#8635;
      </button>

      <input
        className="flex-1 bg-surface-2 border border-border rounded px-2 py-0.5 text-gray-300 outline-none focus:border-accent font-mono"
        value={tab.previewRoute}
        onChange={(e) => updateTab(tabId, { previewRoute: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === "Enter") navigate(e.currentTarget.value);
        }}
        placeholder="/"
      />

      <button
        className="px-1.5 py-0.5 text-gray-500 hover:text-white"
        onClick={() => zoom(-10)}
        title="Zoom out"
      >
        -
      </button>
      <span className="text-gray-600 w-8 text-center">{tab.zoom}%</span>
      <button
        className="px-1.5 py-0.5 text-gray-500 hover:text-white"
        onClick={() => zoom(10)}
        title="Zoom in"
      >
        +
      </button>
      <button
        className="px-1.5 py-0.5 text-gray-500 hover:text-white"
        onClick={() => zoom(0)}
        title="Reset zoom"
      >
        1:1
      </button>

      <button className="px-1.5 py-0.5 text-gray-500 hover:text-white" onClick={openExternal} title="Open in browser">
        &#8599;
      </button>

      {editingUrl ? (
        <div className="flex gap-1">
          <input
            className="bg-surface-2 border border-accent rounded px-2 py-0.5 text-gray-200 outline-none font-mono w-40"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyUrl();
              if (e.key === "Escape") setEditingUrl(false);
            }}
            autoFocus
          />
          <button className="text-accent text-xs" onClick={applyUrl}>
            OK
          </button>
        </div>
      ) : (
        <button
          className="px-1.5 py-0.5 text-gray-600 hover:text-accent text-xs font-mono truncate max-w-[140px]"
          onClick={startEditUrl}
          title="Change preview URL"
        >
          {tab.previewUrl || "Set URL..."}
        </button>
      )}
    </div>
  );
}
