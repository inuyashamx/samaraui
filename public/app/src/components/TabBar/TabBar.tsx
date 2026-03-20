import { useAppStore } from "@/store/appStore";
import { getSocket } from "@/lib/socket";
import { setPreviewTarget } from "@/lib/api";
import Tab from "./Tab";
import UsageBar from "@/components/Common/UsageBar";

export default function TabBar() {
  const tabs = useAppStore((s) => s.tabs);
  const activeTabId = useAppStore((s) => s.activeTabId);
  const addTab = useAppStore((s) => s.addTab);
  const removeTab = useAppStore((s) => s.removeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const updateTab = useAppStore((s) => s.updateTab);
  const cwd = useAppStore((s) => s.cwd);

  const changeCwd = () => {
    useAppStore.getState().setReady(false);
    useAppStore.getState().setCwd("");
  };

  const handleClose = (id: string) => {
    const tab = tabs.find((t) => t.id === id);
    if (tab?.status === "running") {
      getSocket().emit("agent:interrupt", { agentId: id });
      updateTab(id, { status: "idle" });
    }
    removeTab(id);
  };

  return (
    <div className="flex items-center bg-surface border-b border-border shrink-0 overflow-x-auto">
      {tabs.map((tab) => (
        <Tab
          key={tab.id}
          tab={tab}
          isActive={tab.id === activeTabId}
          onSelect={() => {
            setActiveTab(tab.id);
            // Switch the Express proxy to this tab's preview URL
            if (tab.previewUrl) {
              setPreviewTarget(tab.previewUrl);
            }
          }}
          onClose={() => handleClose(tab.id)}
        />
      ))}
      <button
        className="px-3 py-1.5 text-gray-500 hover:text-white text-sm shrink-0"
        onClick={() => addTab()}
        title="New Agent Tab"
      >
        +
      </button>
      <div className="flex-1" />
      <button
        className="px-2 py-1 text-xs text-gray-500 hover:text-white shrink-0"
        onClick={changeCwd}
        title={cwd}
      >
        {cwd.split(/[/\\]/).pop()}
      </button>
      <UsageBar />
    </div>
  );
}
