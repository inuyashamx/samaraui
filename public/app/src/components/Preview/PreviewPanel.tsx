import { useRef, useEffect } from "react";
import { useAppStore } from "@/store/appStore";
import { getSocket } from "@/lib/socket";
import AddressBar from "./AddressBar";

export default function PreviewPanel({ tabId }: { tabId: string }) {
  const tab = useAppStore((s) => s.tabs.find((t) => t.id === tabId));
  const updateTab = useAppStore((s) => s.updateTab);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Sync address bar when iframe navigates + notify server
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const onLoad = () => {
      try {
        const path = new URL(iframe.contentWindow?.location.href || "").pathname;
        updateTab(tabId, { previewRoute: path });
        getSocket().emit("preview:url-update", { url: path });
      } catch {
        // Cross-origin, ignore
      }
    };

    iframe.addEventListener("load", onLoad);
    return () => iframe.removeEventListener("load", onLoad);
  }, [tabId, updateTab]);

  if (!tab) return null;

  const hasPreview = !!tab.previewUrl;
  const scale = tab.zoom / 100;

  const iframeSrc = tab.previewRoute;

  return (
    <div className="flex flex-col h-full flex-1">
      <AddressBar tabId={tabId} iframeRef={iframeRef} />
      <div className="flex-1 overflow-hidden relative">
        {hasPreview ? (
          <iframe
            ref={iframeRef}
            id={`preview-frame-${tabId}`}
            src={iframeSrc}
            className="border-none bg-white"
            style={{
              width: `${100 / scale}%`,
              height: `${100 / scale}%`,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
            title="Preview"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-600 text-sm">
            <div className="text-center">
              <div className="text-lg mb-1">No preview</div>
              <div className="text-xs text-gray-700">
                Start the agent and it will auto-detect your dev server,
                <br />
                or set a URL manually from the address bar
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
