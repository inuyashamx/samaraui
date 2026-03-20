import { useRef } from "react";
import { useAppStore } from "@/store/appStore";
import { useKeyboard } from "@/hooks/useKeyboard";
import MenuBar from "@/components/MenuBar/MenuBar";
import TabBar from "@/components/TabBar/TabBar";
import ChatPanel from "@/components/Chat/ChatPanel";
import PreviewPanel from "@/components/Preview/PreviewPanel";
import Resizer from "@/components/Common/Resizer";

export default function MainUI() {
  const tabs = useAppStore((s) => s.tabs);
  const activeTabId = useAppStore((s) => s.activeTabId);
  const layout = useAppStore((s) => s.layout);
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const chatRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useKeyboard();

  return (
    <div className="flex flex-col h-full">
      <MenuBar />
      <TabBar />
      <div className="flex-1 overflow-hidden">
        {activeTab ? (
          <div className="flex h-full" ref={containerRef}>
            {(layout === "split" || layout === "chat") && (
              <div
                className="flex flex-col h-full"
                ref={chatRef}
                style={{
                  width: layout === "chat" ? "100%" : "35%",
                  minWidth: layout === "chat" ? undefined : 280,
                }}
              >
                <ChatPanel tabId={activeTab.id} />
              </div>
            )}
            {layout === "split" && (
              <Resizer panelRef={chatRef} containerRef={containerRef} />
            )}
            {(layout === "split" || layout === "preview") && (
              <PreviewPanel tabId={activeTab.id} />
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-600 text-sm">
            <div className="text-center">
              <div className="text-xl mb-2">No agents</div>
              <div className="text-xs">Click + to create a new agent tab</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
