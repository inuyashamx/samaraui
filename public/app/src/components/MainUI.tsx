import { useRef } from "react";
import { useAppStore } from "@/store/appStore";
import { useKeyboard } from "@/hooks/useKeyboard";
import MenuBar from "@/components/MenuBar/MenuBar";
import TabBar from "@/components/TabBar/TabBar";
import ChatPanel from "@/components/Chat/ChatPanel";
import PreviewPanel from "@/components/Preview/PreviewPanel";
import Resizer from "@/components/Common/Resizer";
import ClaudeMdPanel from "@/components/Panels/ClaudeMdPanel";
import GitPanel from "@/components/Panels/GitPanel";
import FileExplorer from "@/components/Panels/FileExplorer";
import ActivityLog from "@/components/Panels/ActivityLog";
import McpServersPanel from "@/components/Panels/McpServersPanel";
import SkillsPanel from "@/components/Panels/SkillsPanel";
import SettingsPanel from "@/components/Panels/SettingsPanel";
import UsageDashboard from "@/components/Panels/UsageDashboard";
import TerminalPanel from "@/components/Panels/TerminalPanel";
import ClaudeSettingsPanel from "@/components/Panels/ClaudeSettingsPanel";

export default function MainUI() {
  const tabs = useAppStore((s) => s.tabs);
  const activeTabId = useAppStore((s) => s.activeTabId);
  const layout = useAppStore((s) => s.layout);
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const openPanel = useAppStore((s) => s.openPanel);
  const setOpenPanel = useAppStore((s) => s.setOpenPanel);
  const chatRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const panelComponent = openPanel ? (() => {
    const onClose = () => setOpenPanel(null);
    switch (openPanel) {
      case "claudeMd": return <ClaudeMdPanel onClose={onClose} />;
      case "git": return <GitPanel onClose={onClose} />;
      case "fileExplorer": return <FileExplorer onClose={onClose} />;
      case "activityLog": return <ActivityLog onClose={onClose} />;
      case "mcpServers": return <McpServersPanel onClose={onClose} />;
      case "skills": return <SkillsPanel onClose={onClose} />;
      case "settings": return <SettingsPanel onClose={onClose} />;
      case "usageDashboard": return <UsageDashboard onClose={onClose} />;
      case "terminal": return <TerminalPanel onClose={onClose} />;
      case "claudeSettings": return <ClaudeSettingsPanel onClose={onClose} />;
      default: return null;
    }
  })() : null;

  useKeyboard();

  return (
    <div className="flex flex-col h-full">
      <MenuBar />
      <TabBar />
      <div className="flex-1 overflow-hidden flex">
        {/* Main workspace - render ALL tabs, hide inactive with CSS to preserve iframe state */}
        <div className="flex-1 overflow-hidden relative">
          {tabs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-600 text-sm">
              <div className="text-center">
                <div className="text-xl mb-2">No agents</div>
                <div className="text-xs">Click + to create a new agent tab</div>
              </div>
            </div>
          ) : (
            tabs.map((tab) => {
              const isActive = tab.id === activeTabId;
              return (
                <div
                  key={tab.id}
                  className="absolute inset-0"
                  style={{ display: isActive ? "flex" : "none" }}
                  ref={isActive ? containerRef : undefined}
                >
                  {(layout === "split" || layout === "chat") && (
                    <div
                      className="flex flex-col h-full"
                      ref={isActive ? chatRef : undefined}
                      style={{
                        width: layout === "chat" ? "100%" : "35%",
                        minWidth: layout === "chat" ? undefined : 280,
                      }}
                    >
                      <ChatPanel tabId={tab.id} />
                    </div>
                  )}
                  {layout === "split" && isActive && (
                    <Resizer panelRef={chatRef} containerRef={containerRef} />
                  )}
                  {(layout === "split" || layout === "preview") && (
                    <PreviewPanel tabId={tab.id} />
                  )}
                </div>
              );
            })
          )}
        </div>
        {/* Panel drawer */}
        {panelComponent && (
          <div className="w-80 border-l border-border shrink-0 overflow-hidden">
            {panelComponent}
          </div>
        )}
      </div>
    </div>
  );
}
