import { useEffect } from "react";
import { useAppStore } from "@/store/appStore";
import { useSocket } from "@/hooks/useSocket";
import { useAutoSave } from "@/hooks/useAutoSave";
import { getInit, loadState, setPreviewTarget } from "@/lib/api";
import MainUI from "@/components/MainUI";

export default function App() {
  const ready = useAppStore((s) => s.ready);

  useSocket();
  useAutoSave();

  // Auto-initialize from server's cwd on mount
  useEffect(() => {
    async function init() {
      const { cwd } = await getInit();
      const store = useAppStore.getState();
      store.setCwd(cwd);

      // Restore saved session
      const saved = await loadState(cwd);
      if (saved?.tabs?.length) {
        store.loadFromSaved(saved);
        const restoredTab = saved.tabs.find((t: any) => t.previewUrl);
        if (restoredTab?.previewUrl) {
          setPreviewTarget(restoredTab.previewUrl);
        }
      } else {
        store.addTab();
      }

      store.setReady(true);
    }
    init();
  }, []);

  if (!ready) {
    return (
      <div className="h-full flex items-center justify-center text-gray-600">
        <div className="text-center">
          <div className="text-3xl text-accent mb-2">&#9672;</div>
          <div className="text-sm">Loading...</div>
        </div>
      </div>
    );
  }

  return <MainUI />;
}
