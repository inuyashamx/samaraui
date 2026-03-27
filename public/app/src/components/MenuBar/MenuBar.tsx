import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "@/store/appStore";
import { getSocket } from "@/lib/socket";
import { setPreviewTarget, setCwd, loadState } from "@/lib/api";
import MenuDropdown, { type MenuItem } from "./MenuDropdown";
import Modal from "@/components/Common/Modal";
import CommandPalette from "@/components/Common/CommandPalette";

const MODEL_OPTIONS = [
  "claude-opus-4-6-20250624",
  "claude-opus-4-6",
  "claude-sonnet-4-6",
  "claude-haiku-4-5-20251001",
];

const PERMISSION_OPTIONS: Array<{
  label: string;
  value: "bypassPermissions" | "default" | "acceptEdits";
}> = [
  { label: "Bypass Permissions", value: "bypassPermissions" },
  { label: "Default", value: "default" },
  { label: "Accept Edits", value: "acceptEdits" },
];

function disabled(label: string, shortcut?: string): MenuItem {
  return { label, shortcut, enabled: false };
}

export default function MenuBar() {
  const activeMenu = useAppStore((s) => s.activeMenu);
  const setActiveMenu = useAppStore((s) => s.setActiveMenu);
  const layout = useAppStore((s) => s.layout);
  const setLayout = useAppStore((s) => s.setLayout);
  const addTab = useAppStore((s) => s.addTab);
  const removeTab = useAppStore((s) => s.removeTab);
  const activeTabId = useAppStore((s) => s.activeTabId);
  const clearMessages = useAppStore((s) => s.clearMessages);
  const updateTab = useAppStore((s) => s.updateTab);
  const cwd = useAppStore((s) => s.cwd);
  const getActiveTab = useAppStore((s) => s.getActiveTab);
  const togglePanel = useAppStore((s) => s.togglePanel);

  const [showAbout, setShowAbout] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [recents, setRecents] = useState<string[]>([]);

  const barRef = useRef<HTMLDivElement>(null);

  // Listen for keyboard shortcut toggle event
  useEffect(() => {
    const handler = () => setShowShortcuts((v) => !v);
    window.addEventListener("menu:toggle-shortcuts", handler);
    return () => window.removeEventListener("menu:toggle-shortcuts", handler);
  }, []);

  // Listen for command palette toggle event
  useEffect(() => {
    const handler = () => setShowPalette((v) => !v);
    window.addEventListener("menu:toggle-palette", handler);
    return () => window.removeEventListener("menu:toggle-palette", handler);
  }, []);

  // Load recents from localStorage
  useEffect(() => {
    try {
      setRecents(JSON.parse(localStorage.getItem("samara-recents") || "[]"));
    } catch {}
  }, []);

  // Listen for open folder event (Ctrl+O)
  useEffect(() => {
    const handler = () => openFolder();
    window.addEventListener("menu:open-folder", handler);
    return () => window.removeEventListener("menu:open-folder", handler);
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    if (!activeMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveMenu(null);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [activeMenu, setActiveMenu]);

  const openExternal = useCallback(
    (type: string) => {
      fetch("/api/open-external", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, cwd }),
      });
    },
    [cwd]
  );

  const saveRecent = useCallback((path: string) => {
    const updated = [path, ...recents.filter((r) => r !== path)].slice(0, 10);
    setRecents(updated);
    localStorage.setItem("samara-recents", JSON.stringify(updated));
  }, [recents]);

  const switchProject = useCallback(async (selected: string) => {
    setActiveMenu(null);
    const store = useAppStore.getState();

    // Interrupt running agents
    const socket = getSocket();
    for (const tab of store.tabs) {
      if (tab.status === "running") {
        socket.emit("agent:interrupt", { agentId: tab.id });
      }
    }

    await setPreviewTarget("");
    await setCwd(selected);
    store.setCwd(selected);
    store.tabs.forEach((t) => store.removeTab(t.id));

    const saved = await loadState(selected);
    if (saved?.state?.tabs?.length) {
      store.loadFromSaved(saved.state);
      const restoredTab = saved.state.tabs.find((t: any) => t.previewUrl);
      if (restoredTab?.previewUrl) {
        setPreviewTarget(restoredTab.previewUrl);
      }
    } else {
      store.addTab();
    }

    saveRecent(selected);
  }, [setActiveMenu, saveRecent]);

  const openFolder = useCallback(async () => {
    setActiveMenu(null);
    const res = await fetch("/api/pick-folder", { method: "POST" });
    const { path: selected } = await res.json();
    if (!selected) return;
    await switchProject(selected);
  }, [setActiveMenu, switchProject]);

  const activeTab = getActiveTab();

  const exportAllSessions = async () => {
    const res = await fetch("/api/export-sessions");
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "samara-sessions.json";
    a.click();
    URL.revokeObjectURL(url);
    setActiveMenu(null);
  };

  const exportChat = () => {
    const tab = getActiveTab();
    if (!tab || tab.messages.length === 0) return;
    let md = `# ${tab.name}\n\n`;
    for (const msg of tab.messages) {
      if (msg.role === "user") {
        md += `## You\n\n${msg.content}\n\n`;
      } else if (msg.role === "assistant") {
        md += `## Assistant\n\n${msg.content}\n\n`;
      } else if (msg.role === "tool") {
        md += `> **${msg.toolName}**: ${msg.toolResult ? "completed" : "running"}${msg.elapsed ? ` (${msg.elapsed.toFixed(1)}s)` : ""}\n\n`;
      } else if (msg.role === "system") {
        md += `> ⚠️ ${msg.content}\n\n`;
      }
    }
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${tab.name.replace(/\s+/g, "-").toLowerCase()}-chat.md`;
    a.click();
    URL.revokeObjectURL(url);
    setActiveMenu(null);
  };

  const makeModelSubmenu = (
    currentModel: string | null,
    onSelect: (model: string) => void
  ): MenuItem[] =>
    MODEL_OPTIONS.map((m) => ({
      label: m,
      checked: (currentModel || "") === m,
      action: () => onSelect(m),
    }));

  const makePermSubmenu = (
    current: string,
    onSelect: (mode: "bypassPermissions" | "default" | "acceptEdits") => void
  ): MenuItem[] =>
    PERMISSION_OPTIONS.map((p) => ({
      label: p.label,
      checked: current === p.value,
      action: () => onSelect(p.value),
    }));

  const menus: Record<string, MenuItem[]> = {
    File: [
      {
        label: "New Agent Tab",
        shortcut: "Ctrl+T",
        action: () => addTab(),
      },
      {
        label: "Close Tab",
        shortcut: "Ctrl+W",
        action: () => activeTabId && removeTab(activeTabId),
      },
      { label: "", separator: true },
      {
        label: "Open Folder...",
        shortcut: "Ctrl+O",
        action: openFolder,
      },
      {
        label: "Recent Projects",
        enabled: recents.length > 0,
        submenu: recents.map((path) => ({
          label: path.split(/[/\\]/).pop() || path,
          action: () => switchProject(path),
        })),
      },
      { label: "", separator: true },
      { label: "Export Chat...", action: exportChat },
      { label: "Export All Sessions...", action: exportAllSessions },
    ],
    Project: [
      { label: "CLAUDE.md", action: () => { togglePanel("claudeMd"); setActiveMenu(null); } },
      { label: ".claude/settings.json", action: () => { togglePanel("claudeSettings"); setActiveMenu(null); } },
      { label: "", separator: true },
      { label: "MCP Servers", action: () => { togglePanel("mcpServers"); setActiveMenu(null); } },
      { label: "Skills", action: () => { togglePanel("skills"); setActiveMenu(null); } },
      { label: "", separator: true },
      { label: "Git Status", action: () => { togglePanel("git"); setActiveMenu(null); } },
      { label: "", separator: true },
      {
        label: "Open in Terminal",
        action: () => openExternal("terminal"),
      },
      {
        label: "Open in VS Code",
        action: () => openExternal("vscode"),
      },
    ],
    Agent: [
      {
        label: "Clear Conversation",
        action: () => activeTabId && clearMessages(activeTabId),
      },
      {
        label: "Rename Tab...",
        action: () => {
          // Trigger inline rename via a custom event
          window.dispatchEvent(
            new CustomEvent("menu:rename-tab", { detail: activeTabId })
          );
        },
      },
      { label: "", separator: true },
      {
        label: "Change Model",
        submenu: makeModelSubmenu(activeTab?.model || null, (model) =>
          activeTabId && updateTab(activeTabId, { model })
        ),
      },
      {
        label: "Permission Mode",
        submenu: makePermSubmenu(
          activeTab?.permissionMode || "bypassPermissions",
          (mode) => activeTabId && updateTab(activeTabId, { permissionMode: mode })
        ),
      },
      { label: "", separator: true },
      {
        label: "Interrupt Agent",
        shortcut: "Esc",
        action: () => {
          if (activeTabId) {
            getSocket().emit("agent:interrupt", { agentId: activeTabId });
          }
        },
      },
    ],
    View: [
      {
        label: "Toggle Chat Panel",
        shortcut: "Ctrl+1",
        action: () => setLayout(layout === "preview" ? "split" : "preview"),
      },
      {
        label: "Toggle Preview Panel",
        shortcut: "Ctrl+2",
        action: () => setLayout(layout === "chat" ? "split" : "chat"),
      },
      {
        label: "Focus Chat",
        shortcut: "Ctrl+L",
        action: () => {
          const el = document.querySelector<HTMLTextAreaElement>(
            "[data-chat-input]"
          );
          el?.focus();
        },
      },
      { label: "", separator: true },
      {
        label: "Layout: Side by Side",
        checked: layout === "split",
        action: () => setLayout("split"),
      },
      {
        label: "Layout: Chat Only",
        checked: layout === "chat",
        action: () => setLayout("chat"),
      },
      {
        label: "Layout: Preview Only",
        checked: layout === "preview",
        action: () => setLayout("preview"),
      },
      { label: "", separator: true },
      { label: "Activity Log", action: () => { togglePanel("activityLog"); setActiveMenu(null); } },
      { label: "Usage Dashboard", action: () => { togglePanel("usageDashboard"); setActiveMenu(null); } },
    ],
    Tools: [
      { label: "Terminal", action: () => { togglePanel("terminal"); setActiveMenu(null); } },
      { label: "File Explorer", action: () => { togglePanel("fileExplorer"); setActiveMenu(null); } },
      { label: "", separator: true },
      {
        label: "Reset Preview",
        action: async () => {
          // Full reset: proxy + browser cache on server
          await fetch("/api/reset-preview", { method: "POST" });
          // Clear previewUrl on all tabs
          const tabs = useAppStore.getState().tabs;
          tabs.forEach((t) => updateTab(t.id, { previewUrl: null, previewRoute: "/" }));
          // Clear all iframes
          document.querySelectorAll<HTMLIFrameElement>("iframe[id^='preview-frame-']").forEach((f) => {
            f.src = "about:blank";
          });
          setActiveMenu(null);
        },
      },
      { label: "", separator: true },
      disabled("Templates"),
      { label: "Command Palette", shortcut: "Ctrl+K", action: () => { setShowPalette(true); setActiveMenu(null); } },
      disabled("Snippets Manager"),
    ],
    Settings: [
      {
        label: "Default Model",
        submenu: makeModelSubmenu(activeTab?.model || null, (model) => {
          // Set model on all current tabs as a "default" behavior
          const tabs = useAppStore.getState().tabs;
          tabs.forEach((t) => updateTab(t.id, { model }));
        }),
      },
      {
        label: "Default Permissions",
        submenu: makePermSubmenu(
          activeTab?.permissionMode || "bypassPermissions",
          (mode) => {
            const tabs = useAppStore.getState().tabs;
            tabs.forEach((t) => updateTab(t.id, { permissionMode: mode }));
          }
        ),
      },
      { label: "", separator: true },
      { label: "General", action: () => { togglePanel("settings"); setActiveMenu(null); } },
      disabled("Keyboard Shortcuts"),
      { label: "", separator: true },
      {
        label: "About Samara UI",
        action: () => setShowAbout(true),
      },
    ],
    Help: [
      {
        label: "Documentation",
        action: () =>
          window.open("https://docs.anthropic.com/en/docs/claude-code"),
      },
      {
        label: "Keyboard Shortcuts",
        shortcut: "Ctrl+/",
        action: () => setShowShortcuts(true),
      },
      { label: "", separator: true },
      {
        label: "Report Issue",
        action: () =>
          window.open("https://github.com/anthropics/claude-code/issues"),
      },
      {
        label: "Claude Code Docs",
        action: () =>
          window.open("https://docs.anthropic.com/en/docs/claude-code"),
      },
      {
        label: "Agent SDK Reference",
        action: () =>
          window.open("https://docs.anthropic.com/en/docs/agent-sdk"),
      },
      { label: "", separator: true },
      {
        label: "About",
        action: () => setShowAbout(true),
      },
    ],
  };

  const allCommands = useMemo(() => {
    const cmds: Array<{ label: string; category: string; shortcut?: string; action: () => void }> = [];
    for (const [category, items] of Object.entries(menus)) {
      for (const item of items) {
        if (item.action && item.enabled !== false && !item.separator) {
          cmds.push({ label: item.label, category, shortcut: item.shortcut, action: item.action });
        }
      }
    }
    return cmds;
  }, [menus]);

  const menuKeys = Object.keys(menus);

  const handleMenuClick = (key: string) => {
    setActiveMenu(activeMenu === key ? null : key);
  };

  const handleMenuHover = (key: string) => {
    if (activeMenu && activeMenu !== key) {
      setActiveMenu(key);
    }
  };

  return (
    <>
      <div
        ref={barRef}
        className="flex items-center bg-surface border-b border-border shrink-0 select-none"
      >
        <img src="/_app/logo.png" alt="Samara" className="w-4 h-4 ml-2 mr-1" />
        {menuKeys.map((key) => (
          <div key={key} className="relative">
            <button
              className={`px-3 py-1 text-xs ${
                activeMenu === key
                  ? "bg-surface-2 text-white"
                  : "text-gray-400 hover:text-gray-200 hover:bg-surface-1"
              }`}
              onClick={() => handleMenuClick(key)}
              onMouseEnter={() => handleMenuHover(key)}
            >
              {key}
            </button>
            {activeMenu === key && (
              <MenuDropdown
                items={menus[key]}
                onClose={() => setActiveMenu(null)}
              />
            )}
          </div>
        ))}
      </div>

      {/* About Modal */}
      <Modal open={showAbout} onClose={() => setShowAbout(false)} title="About Samara UI">
        <div className="text-center space-y-2">
          <img src="/_app/logo.png" alt="Samara" className="w-10 h-10 mx-auto" />
          <div className="text-white font-medium">Samara UI v0.1.0</div>
          <div className="text-gray-400 text-xs">Web UI for Claude Code</div>
          <a
            href="https://github.com/anthropics/claude-code"
            target="_blank"
            rel="noreferrer"
            className="text-accent text-xs hover:underline inline-block mt-2"
          >
            GitHub
          </a>
        </div>
      </Modal>

      {/* Keyboard Shortcuts Modal */}
      <Modal
        open={showShortcuts}
        onClose={() => setShowShortcuts(false)}
        title="Keyboard Shortcuts"
      >
        <table className="w-full text-xs">
          <tbody>
            {[
              ["Ctrl+T", "New Agent Tab"],
              ["Ctrl+W", "Close Tab"],
              ["Ctrl+1", "Toggle Chat Panel"],
              ["Ctrl+2", "Toggle Preview Panel"],
              ["Ctrl+L", "Focus Chat Input"],
              ["Ctrl+=", "Preview Zoom In"],
              ["Ctrl+-", "Preview Zoom Out"],
              ["Ctrl+0", "Preview Zoom Reset"],
              ["Ctrl+K", "Command Palette"],
              ["Ctrl+/", "Keyboard Shortcuts"],
              ["Esc", "Interrupt Agent"],
            ].map(([key, desc]) => (
              <tr key={key} className="border-b border-border last:border-0">
                <td className="py-1.5 pr-4 text-gray-500 font-mono">{key}</td>
                <td className="py-1.5 text-gray-300">{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Modal>

      {showPalette && (
        <CommandPalette commands={allCommands} onClose={() => setShowPalette(false)} />
      )}

    </>
  );
}
