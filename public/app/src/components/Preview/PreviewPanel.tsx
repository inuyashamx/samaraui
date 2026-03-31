import { useRef, useEffect, useState, useCallback } from "react";
import { useAppStore } from "@/store/appStore";
import { getSocket } from "@/lib/socket";
import { setPreviewTarget } from "@/lib/api";
import AddressBar from "./AddressBar";

function buildSelector(el: Element): string {
  if (el.id) return `#${el.id}`;
  const tag = el.tagName.toLowerCase();
  const classes = Array.from(el.classList).filter((c) => !c.startsWith("_") && c.length < 30);
  if (classes.length > 0) return `${tag}.${classes.slice(0, 2).join(".")}`;
  const parent = el.parentElement;
  if (parent) {
    const siblings = Array.from(parent.children).filter((c) => c.tagName === el.tagName);
    if (siblings.length > 1) {
      const idx = siblings.indexOf(el) + 1;
      return `${buildSelector(parent)} > ${tag}:nth-child(${idx})`;
    }
  }
  return tag;
}

function describeElement(el: Element): string {
  const selector = buildSelector(el);
  const tag = el.tagName.toLowerCase();
  const text = (el.textContent || "").trim().slice(0, 80);
  const id = el.id ? ` id="${el.id}"` : "";
  const cls = el.className && typeof el.className === "string"
    ? ` class="${el.className.trim().slice(0, 80)}"` : "";
  return `[Element: <${tag}${id}${cls}> selector="${selector}" text="${text}"]`;
}

function NoPreviewPlaceholder({ tabId }: { tabId: string }) {
  const [url, setUrl] = useState("");
  const updateTab = useAppStore((s) => s.updateTab);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let normalized = url.trim();
    if (!normalized) return;
    if (!/^https?:\/\//.test(normalized)) normalized = `http://${normalized}`;
    updateTab(tabId, { previewUrl: normalized, previewRoute: "/" });
    setPreviewTarget(normalized);
  };

  return (
    <div className="flex items-center justify-center h-full text-gray-600 text-sm">
      <div className="text-center">
        <div className="text-lg mb-2">No preview</div>
        <div className="text-xs text-gray-700 mb-4">
          Enter your dev server URL or start the agent and it will auto-detect it
        </div>
        <form onSubmit={handleSubmit} className="flex gap-2 justify-center">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="http://localhost:5173"
            className="bg-surface-2 border border-border rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-accent placeholder-gray-600 w-56"
          />
          <button
            type="submit"
            className="px-3 py-1.5 bg-accent hover:bg-accent-light text-black text-sm font-medium rounded-lg transition-colors"
          >
            Open
          </button>
        </form>
      </div>
    </div>
  );
}

export default function PreviewPanel({ tabId }: { tabId: string }) {
  const tab = useAppStore((s) => s.tabs.find((t) => t.id === tabId));
  const updateTab = useAppStore((s) => s.updateTab);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [picking, setPicking] = useState(false);

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

  // Element picker: inject highlight + click handler into iframe
  useEffect(() => {
    if (!picking) return;
    const iframe = iframeRef.current;
    if (!iframe) return;

    let doc: Document;
    try {
      doc = iframe.contentDocument!;
      if (!doc?.body) return;
    } catch { return; }

    // Inject highlight style
    const style = doc.createElement("style");
    style.id = "samara-picker-style";
    style.textContent = `
      .samara-picker-highlight {
        outline: 2px solid #00d4ff !important;
        outline-offset: -1px;
        cursor: crosshair !important;
      }
      * { cursor: crosshair !important; }
    `;
    doc.head.appendChild(style);

    let lastEl: Element | null = null;

    const onMove = (e: MouseEvent) => {
      const el = doc.elementFromPoint(e.clientX, e.clientY);
      if (el === lastEl) return;
      lastEl?.classList.remove("samara-picker-highlight");
      el?.classList.add("samara-picker-highlight");
      lastEl = el;
    };

    const onClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const el = doc.elementFromPoint(e.clientX, e.clientY);
      if (el) {
        const desc = describeElement(el);
        window.dispatchEvent(new CustomEvent("preview:element-picked", { detail: desc }));
      }
      setPicking(false);
    };

    doc.addEventListener("mousemove", onMove, true);
    doc.addEventListener("click", onClick, true);

    return () => {
      doc.removeEventListener("mousemove", onMove, true);
      doc.removeEventListener("click", onClick, true);
      lastEl?.classList.remove("samara-picker-highlight");
      doc.getElementById("samara-picker-style")?.remove();
    };
  }, [picking]);

  const togglePicker = useCallback(() => setPicking((p) => !p), []);

  if (!tab) return null;

  const hasPreview = !!tab.previewUrl;
  const scale = tab.zoom / 100;

  const iframeSrc = tab.previewRoute;

  return (
    <div className="flex flex-col h-full flex-1">
      <AddressBar tabId={tabId} iframeRef={iframeRef} picking={picking} onTogglePicker={togglePicker} />
      <div className="flex-1 overflow-hidden relative">
        {hasPreview ? (
          <>
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
            {picking && (
              <div className="absolute top-0 left-0 right-0 bg-accent/10 text-accent text-xs text-center py-1 pointer-events-none z-10">
                Click an element to select it
              </div>
            )}
          </>
        ) : (
          <NoPreviewPlaceholder tabId={tabId} />
        )}
      </div>
    </div>
  );
}
