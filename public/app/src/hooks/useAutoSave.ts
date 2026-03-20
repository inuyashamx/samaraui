import { useEffect } from "react";
import { useAppStore } from "@/store/appStore";
import { saveState, sendBeaconState } from "@/lib/api";

export function useAutoSave() {
  useEffect(() => {
    // Auto-save every 10 seconds
    const interval = setInterval(() => {
      const s = useAppStore.getState();
      if (s.ready && s.tabs.length > 0) {
        saveState(s.cwd, s.getSerializableState());
      }
    }, 10000);

    // Save on page unload
    const handleBeforeUnload = () => {
      const s = useAppStore.getState();
      if (s.ready && s.tabs.length > 0) {
        sendBeaconState(s.cwd, s.getSerializableState());
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);
}
