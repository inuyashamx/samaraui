import { create } from "zustand";
import type { Tab, Message } from "@shared/types/agent";
import type { UsageData } from "@shared/types/settings";
import { createDefaultTab } from "@shared/types/agent";

interface AppStore {
  // App state
  cwd: string;
  ready: boolean;
  connected: boolean;
  setCwd: (cwd: string) => void;
  setReady: (ready: boolean) => void;
  setConnected: (connected: boolean) => void;

  // Tabs
  tabs: Tab[];
  activeTabId: string;
  addTab: (name?: string) => Tab;
  removeTab: (id: string) => void;
  updateTab: (id: string, patch: Partial<Tab>) => void;
  setActiveTab: (id: string) => void;
  getActiveTab: () => Tab | undefined;

  // Messages
  addMessage: (tabId: string, message: Message) => void;
  appendToLastAssistant: (tabId: string, text: string) => void;
  updateLastToolMessage: (tabId: string, patch: Partial<Message>) => void;
  clearMessages: (tabId: string) => void;

  // Usage
  usage: UsageData | null;
  setUsage: (data: UsageData | null) => void;

  // Layout & Menu
  activeMenu: string | null;
  layout: "split" | "chat" | "preview";
  setActiveMenu: (menu: string | null) => void;
  setLayout: (layout: "split" | "chat" | "preview") => void;

  // State persistence
  loadFromSaved: (saved: { tabs: Tab[]; activeTabId: string }) => void;
  getSerializableState: () => { tabs: Tab[]; activeTabId: string };
}

let tabCounter = 0;

export const useAppStore = create<AppStore>((set, get) => ({
  // App state
  cwd: "",
  ready: false,
  connected: false,
  setCwd: (cwd) => set({ cwd }),
  setReady: (ready) => set({ ready }),
  setConnected: (connected) => set({ connected }),

  // Tabs
  tabs: [],
  activeTabId: "",

  addTab: (name?: string) => {
    tabCounter++;
    const id = `agent-${Date.now()}`;
    const tab = createDefaultTab(id, name || `Agent ${tabCounter}`);
    set((s) => ({
      tabs: [...s.tabs, tab],
      activeTabId: id,
    }));
    return tab;
  },

  removeTab: (id) =>
    set((s) => {
      const idx = s.tabs.findIndex((t) => t.id === id);
      const newTabs = s.tabs.filter((t) => t.id !== id);
      let newActive = s.activeTabId;
      if (s.activeTabId === id) {
        const nextIdx = Math.min(idx, newTabs.length - 1);
        newActive = newTabs[nextIdx]?.id || "";
      }
      return { tabs: newTabs, activeTabId: newActive };
    }),

  updateTab: (id, patch) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    })),

  setActiveTab: (id) => set({ activeTabId: id }),

  getActiveTab: () => {
    const s = get();
    return s.tabs.find((t) => t.id === s.activeTabId);
  },

  // Messages
  addMessage: (tabId, message) =>
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === tabId ? { ...t, messages: [...t.messages, message] } : t
      ),
    })),

  appendToLastAssistant: (tabId, text) =>
    set((s) => ({
      tabs: s.tabs.map((t) => {
        if (t.id !== tabId) return t;
        const msgs = [...t.messages];
        const last = msgs[msgs.length - 1];
        if (last?.role === "assistant") {
          msgs[msgs.length - 1] = { ...last, content: last.content + text };
        } else {
          msgs.push({ role: "assistant", content: text });
        }
        return { ...t, messages: msgs };
      }),
    })),

  updateLastToolMessage: (tabId, patch) =>
    set((s) => ({
      tabs: s.tabs.map((t) => {
        if (t.id !== tabId) return t;
        const msgs = [...t.messages];
        for (let i = msgs.length - 1; i >= 0; i--) {
          if (msgs[i].role === "tool" && !msgs[i].toolResult) {
            msgs[i] = { ...msgs[i], ...patch };
            break;
          }
        }
        return { ...t, messages: msgs };
      }),
    })),

  clearMessages: (tabId) =>
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === tabId
          ? {
              ...t,
              messages: [],
              sessionId: null,
              lastCost: null,
              lastDuration: null,
              lastTurns: null,
            }
          : t
      ),
    })),

  // Usage
  usage: null,
  setUsage: (data) => set({ usage: data }),

  // Layout & Menu
  activeMenu: null,
  layout: "split",
  setActiveMenu: (menu) => set({ activeMenu: menu }),
  setLayout: (layout) => set({ layout }),

  // State persistence
  loadFromSaved: (saved) => {
    const tabs = saved.tabs.map((t: any) => ({
      ...createDefaultTab(t.id, t.name),
      ...t,
      status: "idle" as const,
      previewUrl: t.previewUrl || null,
      // Normalize old message field names: tool->toolName, result->toolResult
      messages: (t.messages || []).map((m: any) => ({
        ...m,
        toolName: m.toolName || m.tool,
        toolResult: m.toolResult ?? m.result,
      })),
    }));
    tabCounter = tabs.length;
    set({
      tabs,
      activeTabId: saved.activeTabId || tabs[0]?.id || "",
    });
  },

  getSerializableState: () => {
    const s = get();
    return {
      tabs: s.tabs.map((t) => ({
        ...t,
        status: "idle" as const,
      })),
      activeTabId: s.activeTabId,
    };
  },
}));
