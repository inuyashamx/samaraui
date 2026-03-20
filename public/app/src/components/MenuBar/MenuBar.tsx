import { useCallback, useEffect, useRef, useState } from "react";
import { useAppStore } from "@/store/appStore";
import { getSocket } from "@/lib/socket";
import MenuDropdown, { type MenuItem } from "./MenuDropdown";
import Modal from "@/components/Common/Modal";

const MODEL_OPTIONS = [
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

  const [showAbout, setShowAbout] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const barRef = useRef<HTMLDivElement>(null);

  // Listen for keyboard shortcut toggle event
  useEffect(() => {
    const handler = () => setShowShortcuts((v) => !v);
    window.addEventListener("menu:toggle-shortcuts", handler);
    return () => window.removeEventListener("menu:toggle-shortcuts", handler);
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

  const activeTab = getActiveTab();

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
      disabled("Open Project...", "Ctrl+O"),
      disabled("Recent Projects"),
      { label: "", separator: true },
      disabled("Export Chat..."),
      disabled("Export All Sessions..."),
    ],
    Project: [
      disabled("Project Info"),
      disabled("CLAUDE.md"),
      disabled(".claude/settings.json"),
      { label: "", separator: true },
      disabled("MCP Servers"),
      disabled("Skills"),
      disabled("Hooks"),
      { label: "", separator: true },
      disabled("Git Status"),
      disabled("Git Log"),
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
      disabled("Max Turns"),
      disabled("Max Budget"),
      {
        label: "Permission Mode",
        submenu: makePermSubmenu(
          activeTab?.permissionMode || "bypassPermissions",
          (mode) => activeTabId && updateTab(activeTabId, { permissionMode: mode })
        ),
      },
      { label: "", separator: true },
      disabled("System Prompt Override..."),
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
      disabled("Preview Zoom In", "Ctrl+="),
      disabled("Preview Zoom Out", "Ctrl+-"),
      disabled("Preview Zoom Reset", "Ctrl+0"),
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
      disabled("Activity Log"),
      disabled("Usage Dashboard"),
    ],
    Tools: [
      disabled("Terminal"),
      disabled("File Explorer"),
      { label: "", separator: true },
      disabled("Screenshot Preview"),
      disabled("Inspect Element"),
      { label: "", separator: true },
      disabled("Templates"),
      disabled("Command Palette", "Ctrl+K"),
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
      disabled("General"),
      disabled("API Key / Auth"),
      disabled("Proxy Settings"),
      disabled("Preview Server Config"),
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
    </>
  );
}
