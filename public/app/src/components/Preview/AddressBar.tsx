import { useState } from "react";
import { useAppStore } from "@/store/appStore";
import { setPreviewTarget } from "@/lib/api";

interface AddressBarProps {
  tabId: string;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  picking?: boolean;
  onTogglePicker?: () => void;
}

export default function AddressBar({ tabId, iframeRef, picking, onTogglePicker }: AddressBarProps) {
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

  const resetPreview = async () => {
    // Clear the iframe first to stop any pending loads
    if (iframeRef.current) {
      iframeRef.current.src = "about:blank";
    }
    // Clear the proxy on the server
    await setPreviewTarget("");
    // Clear the tab state so iframe unmounts
    updateTab(tabId, { previewUrl: null, previewRoute: "/" });
  };

  const startEditUrl = () => {
    setUrlInput(tab.previewUrl || "");
    setEditingUrl(true);
  };

  const applyUrl = async () => {
    let url = urlInput.trim();
    if (url && !url.match(/^https?:\/\//)) url = `http://${url}`;
    setEditingUrl(false);
    if (!url) return;
    // Switch the proxy FIRST, before rendering the iframe
    await setPreviewTarget(url);
    // Now safe to set previewUrl (which renders the iframe) and force reload
    updateTab(tabId, { previewUrl: url, previewRoute: "/" });
    // Wait for React to render the iframe, then force-reload it
    requestAnimationFrame(() => {
      if (iframeRef.current) {
        iframeRef.current.src = "/";
      }
    });
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

      {onTogglePicker && (
        <button
          className={`px-1.5 py-0.5 ${picking ? "text-accent" : "text-gray-500 hover:text-white"}`}
          onClick={onTogglePicker}
          title={picking ? "Cancel element picker" : "Pick an element"}
        >
          &#9781;
        </button>
      )}

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
      {tab.previewUrl && (
        <button
          className="px-1.5 py-0.5 text-gray-500 hover:text-red-400"
          onClick={resetPreview}
          title="Reset preview (clear proxy and URL)"
        >
          &#10005;
        </button>
      )}

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
