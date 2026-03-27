import { useEffect } from "react";
import { useAppStore } from "@/store/appStore";
import { getSocket } from "@/lib/socket";

export function useKeyboard() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const store = useAppStore.getState();

      // Ctrl+T - New tab
      if (ctrl && e.key === "t") {
        e.preventDefault();
        store.addTab();
        return;
      }

      // Ctrl+W - Close tab
      if (ctrl && e.key === "w") {
        e.preventDefault();
        if (store.activeTabId) store.removeTab(store.activeTabId);
        return;
      }

      // Ctrl+1 - Toggle chat panel
      if (ctrl && e.key === "1") {
        e.preventDefault();
        store.setLayout(store.layout === "preview" ? "split" : "preview");
        return;
      }

      // Ctrl+2 - Toggle preview panel
      if (ctrl && e.key === "2") {
        e.preventDefault();
        store.setLayout(store.layout === "chat" ? "split" : "chat");
        return;
      }

      // Ctrl+L - Focus chat input
      if (ctrl && e.key === "l") {
        e.preventDefault();
        const el = document.querySelector<HTMLTextAreaElement>(
          "[data-chat-input]"
        );
        el?.focus();
        return;
      }

      // Ctrl+O - Open folder
      if (ctrl && e.key === "o") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("menu:open-folder"));
        return;
      }

      // Ctrl+K - Toggle command palette
      if (ctrl && e.key === "k") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("menu:toggle-palette"));
        return;
      }

      // Ctrl+/ - Toggle shortcuts modal
      if (ctrl && e.key === "/") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("menu:toggle-shortcuts"));
        return;
      }

      // Esc - Interrupt agent or close menu
      if (e.key === "Escape") {
        const menu = store.activeMenu;
        if (menu) {
          store.setActiveMenu(null);
          return;
        }
        const tab = store.getActiveTab();
        if (tab?.status === "running") {
          getSocket().emit("agent:interrupt", { agentId: tab.id });
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
