# Phase 1a: React + TypeScript Migration - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Samara UI frontend from vanilla JS to Vite + React 19 + TypeScript + Tailwind CSS v4, and migrate the server from JS to TypeScript, preserving all existing functionality identically.

**Architecture:** The React app lives in `public/app/` with its own `package.json`. Shared types live in `shared/types/`. State management uses Zustand. Socket.io communication is unchanged. The Express server is renamed from `.js` to `.ts` with type annotations added. Old vanilla files are removed after verification.

**Tech Stack:** Vite, React 19, TypeScript, Tailwind CSS v4, Zustand, Socket.io-client, marked, highlight.js, tsx

---

## File Map

### New Files to Create

```
shared/
  types/
    agent.ts                    # Tab, Message, AgentStatus types
    socket.ts                   # Socket event payload types
    settings.ts                 # Settings interfaces

public/app/
  index.html                    # Vite entry HTML
  package.json                  # Frontend dependencies
  vite.config.ts                # Vite config with proxy + aliases
  tsconfig.json                 # TypeScript config

  src/
    main.tsx                    # ReactDOM.createRoot entry
    App.tsx                     # Root component: DirectoryPicker | MainUI
    index.css                   # Tailwind v4 @theme + custom CSS

    store/
      appStore.ts               # Zustand store (tabs, UI, settings)

    lib/
      socket.ts                 # Socket.io singleton + typed events
      api.ts                    # Fetch helpers for /api/*
      constants.ts              # Models, tool descriptions

    hooks/
      useSocket.ts              # Socket event listeners → store updates
      useAutoSave.ts            # 10s interval + beforeunload save
      usePreviewDetect.ts       # Auto-detect localhost URLs in messages

    components/
      DirectoryPicker.tsx       # Folder selection screen
      MainUI.tsx                # TabBar + TabContent + UsageBar wrapper

      TabBar/
        TabBar.tsx              # Tab strip + new tab button
        Tab.tsx                 # Single tab with status dot + close

      Chat/
        ChatPanel.tsx           # Toolbar + messages + input
        ChatMessage.tsx         # Single message render (user/assistant/tool/system)
        ChatInput.tsx           # Textarea + send/stop button
        ChatToolbar.tsx         # Tab name + dropdown menu

      Preview/
        PreviewPanel.tsx        # Address bar + iframe + placeholder
        AddressBar.tsx          # URL input, back, refresh, zoom controls

      Common/
        Resizer.tsx             # Drag handle between chat and preview
        StatusDot.tsx           # idle/running/error dot
        UsageBar.tsx            # 5hr + 7day usage display
```

### Server Files to Rename + Type

```
server/index.js       → server/index.ts
server/agent-manager.js → server/agent-manager.ts
server/preview-browser.js → server/preview-browser.ts
(new) server/types.ts
```

### Files to Delete (after verification)

```
public/app.js
public/styles.css
public/index.html
```

---

## Task 1: Scaffold Vite + React + TypeScript Project

**Files:**
- Create: `public/app/package.json`
- Create: `public/app/index.html`
- Create: `public/app/vite.config.ts`
- Create: `public/app/tsconfig.json`
- Create: `public/app/src/main.tsx`
- Create: `public/app/src/App.tsx`
- Create: `public/app/src/index.css`

- [ ] **Step 1: Create frontend package.json**

```json
{
  "name": "samara-ui-app",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "zustand": "^5.0.0",
    "socket.io-client": "^4.8.0",
    "marked": "^15.0.0",
    "highlight.js": "^11.11.0"
  },
  "devDependencies": {
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.0",
    "@vitejs/plugin-react": "^4.4.0",
    "@tailwindcss/vite": "^4.1.0",
    "tailwindcss": "^4.1.0",
    "typescript": "^5.8.0",
    "vite": "^6.3.0"
  }
}
```

- [ ] **Step 2: Create vite.config.ts**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "../../shared"),
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000",
      "/socket.io": {
        target: "http://localhost:3000",
        ws: true,
      },
      // Proxy all non-src routes to Express so the preview iframe
      // loads through the Express reverse proxy to the dev server
      "^/(?!src|node_modules|@)": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
});
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true,
    "paths": {
      "@shared/*": ["../../shared/*"],
      "@/*": ["./src/*"]
    }
  },
  "include": ["src", "../../shared"]
}
```

- [ ] **Step 4: Create index.html**

```html
<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Samara UI</title>
</head>
<body class="bg-surface text-white h-screen overflow-hidden">
  <div id="root" class="h-full"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

- [ ] **Step 5: Create src/index.css with Tailwind v4 theme**

```css
@import "tailwindcss";

@theme {
  --color-surface: #0f0f0f;
  --color-surface-1: #1a1a1a;
  --color-surface-2: #242424;
  --color-surface-3: #2e2e2e;
  --color-accent: #d97706;
  --color-accent-light: #f59e0b;
  --color-border: #333333;
  --color-border-light: #444444;
}

/* Scrollbar */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #555; }

/* Code blocks */
pre code {
  display: block;
  background: #0d1117;
  padding: 12px;
  border-radius: 6px;
  overflow-x: auto;
  font-size: 13px;
  line-height: 1.5;
}

/* Prose for markdown */
.prose h1, .prose h2, .prose h3 { font-weight: 600; margin: 0.8em 0 0.4em; }
.prose p { margin: 0.4em 0; }
.prose ul, .prose ol { padding-left: 1.5em; margin: 0.4em 0; }
.prose li { margin: 0.2em 0; }
.prose code { background: #1e1e2e; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
.prose a { color: #60a5fa; text-decoration: underline; }
.prose blockquote { border-left: 3px solid #d97706; padding-left: 12px; color: #999; }
.prose table { border-collapse: collapse; width: 100%; margin: 0.5em 0; }
.prose th, .prose td { border: 1px solid #333; padding: 6px 10px; text-align: left; }

/* Status dots */
.status-dot-idle { background: #666; }
.status-dot-running { background: #4ade80; animation: pulse 1.5s infinite; }
.status-dot-error { background: #f87171; }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
```

- [ ] **Step 6: Create main.tsx and App.tsx stubs**

`src/main.tsx`:
```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

`src/App.tsx`:
```tsx
export default function App() {
  return <div className="h-full flex items-center justify-center text-gray-500">Samara UI loading...</div>;
}
```

- [ ] **Step 7: Install dependencies and verify dev server starts**

```bash
cd public/app && npm install
npm run dev
```

Expected: Vite dev server at http://localhost:5173 showing "Samara UI loading..."

- [ ] **Step 8: Commit**

```bash
git add public/app/
git commit -m "feat: scaffold Vite + React + TypeScript + Tailwind v4 project"
```

---

## Task 2: Create Shared Types

**Files:**
- Create: `shared/types/agent.ts`
- Create: `shared/types/socket.ts`
- Create: `shared/types/settings.ts`

- [ ] **Step 1: Create shared/types/agent.ts**

```typescript
export interface Tab {
  id: string;
  name: string;
  status: "idle" | "running" | "error";
  messages: Message[];
  sessionId: string | null;
  previewUrl: string | null;
  previewRoute: string;
  zoom: number;
  model: string | null;
  maxTurns: number | null;
  maxBudget: number | null;
  permissionMode: "bypassPermissions" | "default" | "acceptEdits";
  systemPromptOverride: string | null;
  lastCost: number | null;
  lastDuration: number | null;
  lastTurns: number | null;
}

export interface Message {
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  toolUseId?: string;
  toolName?: string;
  toolInput?: unknown;
  toolResult?: string;
  elapsed?: number;
  timestamp?: number;
}

export type AgentStatus = "idle" | "running" | "error";

export function createDefaultTab(id: string, name: string): Tab {
  return {
    id,
    name,
    status: "idle",
    messages: [],
    sessionId: null,
    previewUrl: null,
    previewRoute: "/",
    zoom: 100,
    model: null,
    maxTurns: null,
    maxBudget: null,
    permissionMode: "bypassPermissions",
    systemPromptOverride: null,
    lastCost: null,
    lastDuration: null,
    lastTurns: null,
  };
}
```

- [ ] **Step 2: Create shared/types/socket.ts**

```typescript
export interface AgentStartPayload {
  agentId: string;
  prompt: string;
  model?: string;
  maxTurns?: number;
  maxBudget?: number;
  permissionMode?: string;
}

export interface AgentInitPayload {
  agentId: string;
  sessionId: string;
  model: string;
  tools: string[];
}

export interface AgentTextPayload {
  agentId: string;
  text: string;
}

export interface AgentToolUsePayload {
  agentId: string;
  toolUseId: string;
  tool: string;
  input: unknown;
}

export interface AgentToolResultPayload {
  agentId: string;
  content: string;
}

export interface AgentToolProgressPayload {
  agentId: string;
  toolUseId: string;
  tool: string;
  elapsed: number;
}

export interface AgentResultPayload {
  agentId: string;
  result: string | null;
  errors: string | null;
  subtype: string;
  cost: number;
  turns: number;
  duration: number;
  sessionId: string;
}

export interface AgentErrorPayload {
  agentId: string;
  error: string;
}

export interface PreviewNavigatePayload {
  agentId: string;
  route: string;
}

export interface PreviewRefreshPayload {
  agentId: string;
}

export interface ServerToClientEvents {
  "agent:init": (payload: AgentInitPayload) => void;
  "agent:text": (payload: AgentTextPayload) => void;
  "agent:tool_use": (payload: AgentToolUsePayload) => void;
  "agent:tool_result": (payload: AgentToolResultPayload) => void;
  "agent:tool_progress": (payload: AgentToolProgressPayload) => void;
  "agent:result": (payload: AgentResultPayload) => void;
  "agent:error": (payload: AgentErrorPayload) => void;
  "preview:navigate": (payload: PreviewNavigatePayload) => void;
  "preview:refresh": (payload: PreviewRefreshPayload) => void;
  "preview:get-url": (payload: { agentId: string }) => void;
}

export interface ClientToServerEvents {
  "agent:start": (payload: AgentStartPayload) => void;
  "agent:message": (payload: AgentStartPayload) => void;
  "agent:interrupt": (payload: { agentId: string }) => void;
  "preview:url-update": (payload: { url: string }) => void;
  "preview:current-url": (payload: { url: string }) => void;
}
```

- [ ] **Step 3: Create shared/types/settings.ts**

```typescript
export interface Settings {
  theme: "dark" | "light";
  fontSize: number;
  defaultModel: string;
  defaultPermissionMode: string;
  apiKey: string | null;
  proxyUrl: string | null;
  previewPort: number | null;
  shortcuts: Record<string, string>;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "dark",
  fontSize: 13,
  defaultModel: "claude-sonnet-4-6",
  defaultPermissionMode: "bypassPermissions",
  apiKey: null,
  proxyUrl: null,
  previewPort: null,
  shortcuts: {},
};

export interface UsageData {
  five_hour: UsageEntry;
  seven_day: UsageEntry;
}

export interface UsageEntry {
  label: string;
  utilization: number;
  resets_at: string;
}
```

- [ ] **Step 4: Commit**

```bash
git add shared/
git commit -m "feat: add shared TypeScript types for agent, socket, and settings"
```

---

## Task 3: Create Zustand Store

**Files:**
- Create: `public/app/src/store/appStore.ts`

- [ ] **Step 1: Create the store**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add public/app/src/store/
git commit -m "feat: add Zustand store with tabs, messages, and persistence"
```

---

## Task 4: Create lib/ utilities (socket, api, constants)

**Files:**
- Create: `public/app/src/lib/socket.ts`
- Create: `public/app/src/lib/api.ts`
- Create: `public/app/src/lib/constants.ts`

- [ ] **Step 1: Create socket.ts**

```typescript
import { io, Socket } from "socket.io-client";
import type { ServerToClientEvents, ClientToServerEvents } from "@shared/types/socket";

export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: TypedSocket | null = null;

export function getSocket(): TypedSocket {
  if (!socket) {
    socket = io({ transports: ["websocket", "polling"] });
  }
  return socket;
}
```

- [ ] **Step 2: Create api.ts**

```typescript
const BASE = "";

export async function checkDir(path: string): Promise<{ valid: boolean; path: string }> {
  const res = await fetch(`${BASE}/api/check-dir?path=${encodeURIComponent(path)}`);
  return res.json();
}

export async function getHome(): Promise<{
  home: string;
  suggestions: string[];
  projects: { name: string; path: string }[];
}> {
  const res = await fetch(`${BASE}/api/home`);
  return res.json();
}

export async function setCwd(cwd: string): Promise<void> {
  await fetch(`${BASE}/api/set-cwd`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cwd }),
  });
}

export async function setPreviewTarget(url: string): Promise<void> {
  await fetch(`${BASE}/api/set-preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
}

export async function fetchUsage() {
  const res = await fetch(`${BASE}/api/usage`);
  if (!res.ok) return null;
  return res.json();
}

export async function saveState(cwd: string, state: unknown): Promise<void> {
  await fetch(`${BASE}/api/state`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cwd, state }),
  });
}

export async function loadState(cwd: string) {
  try {
    const res = await fetch(`${BASE}/api/state?cwd=${encodeURIComponent(cwd)}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export function sendBeaconState(cwd: string, state: unknown): void {
  const payload = JSON.stringify({ cwd, state });
  navigator.sendBeacon("/api/state", new Blob([payload], { type: "application/json" }));
}
```

- [ ] **Step 3: Create constants.ts**

```typescript
export const TOOL_DESCRIPTIONS: Record<string, (input: any) => string> = {
  Read: (i) => `Reading ${i?.file_path || "file"}`,
  Write: (i) => `Writing ${i?.file_path || "file"}`,
  Edit: (i) => `Editing ${i?.file_path || "file"}`,
  Bash: (i) => `Running: ${(i?.command || "").slice(0, 80)}`,
  Glob: (i) => `Searching for ${i?.pattern || "files"}`,
  Grep: (i) => `Searching for "${(i?.pattern || "").slice(0, 40)}"`,
  WebSearch: (i) => `Searching: ${(i?.query || "").slice(0, 60)}`,
  WebFetch: (i) => `Fetching ${(i?.url || "").slice(0, 60)}`,
  Agent: () => "Running sub-agent",
  NavigatePreview: (i) => `Navigating to ${i?.route || "/"}`,
  RefreshPreview: () => "Refreshing preview",
  ScreenshotPreview: () => "Taking screenshot",
  GetPreviewURL: () => "Getting preview URL",
  InspectElement: (i) => `Inspecting ${i?.selector || "element"}`,
  GetPageContent: (i) => `Getting content of ${i?.selector || "page"}`,
  ClickElement: (i) => `Clicking ${i?.selector || "element"}`,
  TypeInElement: (i) => `Typing in ${i?.selector || "element"}`,
};

export function getToolDescription(tool: string, input: unknown): string {
  // Strip MCP prefix: "mcp__preview-tools__NavigatePreview" -> "NavigatePreview"
  const shortName = tool.includes("__") ? tool.split("__").pop()! : tool;
  const fn = TOOL_DESCRIPTIONS[shortName] || TOOL_DESCRIPTIONS[tool];
  return fn ? fn(input) : `Using ${shortName}`;
}

export const URL_PATTERN = /https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]):(\d+)/;

export function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
```

- [ ] **Step 4: Commit**

```bash
git add public/app/src/lib/
git commit -m "feat: add socket, API, and constants utilities"
```

---

## Task 5: Create useSocket hook

**Files:**
- Create: `public/app/src/hooks/useSocket.ts`

- [ ] **Step 1: Create useSocket.ts**

```typescript
import { useEffect } from "react";
import { getSocket } from "@/lib/socket";
import { useAppStore } from "@/store/appStore";
import { setPreviewTarget } from "@/lib/api";
import { URL_PATTERN } from "@/lib/constants";

export function useSocket() {
  useEffect(() => {
    const socket = getSocket();

    socket.on("connect", () => {
      useAppStore.getState().setConnected(true);
    });

    socket.on("disconnect", () => {
      useAppStore.getState().setConnected(false);
    });

    socket.on("agent:init", ({ agentId, sessionId, model }) => {
      const s = useAppStore.getState();
      s.updateTab(agentId, { sessionId, status: "running", model });
    });

    socket.on("agent:text", ({ agentId, text }) => {
      const s = useAppStore.getState();
      s.appendToLastAssistant(agentId, text);

      // Auto-detect preview URLs and configure proxy
      const match = text.match(URL_PATTERN);
      if (match) {
        const tab = s.tabs.find((t) => t.id === agentId);
        if (tab && !tab.previewUrl) {
          const url = match[0];
          s.updateTab(agentId, { previewUrl: url });
          setPreviewTarget(url);
        }
      }
    });

    socket.on("agent:tool_use", ({ agentId, toolUseId, tool, input }) => {
      const s = useAppStore.getState();
      s.addMessage(agentId, {
        role: "tool",
        content: "",
        toolUseId,
        toolName: tool,
        toolInput: input,
      });
    });

    socket.on("agent:tool_result", ({ agentId, content }) => {
      const s = useAppStore.getState();
      s.updateLastToolMessage(agentId, { toolResult: content });

      // Auto-detect preview URLs in tool results and configure proxy
      const match = content.match(URL_PATTERN);
      if (match) {
        const tab = s.tabs.find((t) => t.id === agentId);
        if (tab && !tab.previewUrl) {
          const url = match[0];
          s.updateTab(agentId, { previewUrl: url });
          setPreviewTarget(url);
        }
      }
    });

    socket.on("agent:tool_progress", ({ agentId, elapsed }) => {
      const s = useAppStore.getState();
      s.updateLastToolMessage(agentId, { elapsed });
    });

    socket.on("agent:result", ({ agentId, subtype, cost, turns, duration, sessionId, errors }) => {
      const s = useAppStore.getState();
      s.updateTab(agentId, {
        status: subtype === "success" ? "idle" : "error",
        sessionId,
        lastCost: cost,
        lastDuration: duration,
        lastTurns: turns,
      });
      if (errors) {
        s.addMessage(agentId, { role: "system", content: `Error: ${errors}` });
      }
    });

    socket.on("agent:error", ({ agentId, error }) => {
      const s = useAppStore.getState();
      s.updateTab(agentId, { status: "error" });
      s.addMessage(agentId, { role: "system", content: error });
    });

    socket.on("preview:navigate", ({ agentId, route }) => {
      const s = useAppStore.getState();
      s.updateTab(agentId, { previewRoute: route });
    });

    socket.on("preview:refresh", () => {
      // Handled by PreviewPanel component via store reactivity
    });

    // Server asks for current iframe URL (for agent GetPreviewURL tool)
    socket.on("preview:get-url", ({ agentId }) => {
      try {
        const iframe = document.getElementById(`preview-frame-${agentId}`) as HTMLIFrameElement;
        const url = iframe?.contentWindow?.location.pathname || "/";
        socket.emit("preview:current-url", { url });
      } catch {
        socket.emit("preview:current-url", { url: "/" });
      }
    });

    return () => {
      socket.removeAllListeners();
    };
  }, []);
}
```

- [ ] **Step 2: Commit**

```bash
git add public/app/src/hooks/
git commit -m "feat: add useSocket hook with all event handlers"
```

---

## Task 6: Create useAutoSave hook

**Files:**
- Create: `public/app/src/hooks/useAutoSave.ts`

- [ ] **Step 1: Create useAutoSave.ts**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add public/app/src/hooks/useAutoSave.ts
git commit -m "feat: add auto-save hook with 10s interval + beforeunload"
```

---

## Task 7: Create Common Components (StatusDot, Resizer, UsageBar)

**Files:**
- Create: `public/app/src/components/Common/StatusDot.tsx`
- Create: `public/app/src/components/Common/Resizer.tsx`
- Create: `public/app/src/components/Common/UsageBar.tsx`

- [ ] **Step 1: Create StatusDot.tsx**

```tsx
import type { AgentStatus } from "@shared/types/agent";

export default function StatusDot({ status }: { status: AgentStatus }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full status-dot-${status}`}
      title={status}
    />
  );
}
```

- [ ] **Step 2: Create Resizer.tsx**

```tsx
import { useCallback, useRef } from "react";

interface ResizerProps {
  panelRef: React.RefObject<HTMLDivElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export default function Resizer({ panelRef, containerRef }: ResizerProps) {
  const dragging = useRef(false);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const onMouseMove = (ev: MouseEvent) => {
        if (!dragging.current || !panelRef.current || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const newWidth = ev.clientX - rect.left;
        const maxWidth = rect.width - 300;
        panelRef.current.style.width = `${Math.max(300, Math.min(newWidth, maxWidth))}px`;
      };

      const onMouseUp = () => {
        dragging.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [panelRef, containerRef]
  );

  return (
    <div
      className="w-1 cursor-col-resize bg-border hover:bg-accent active:bg-accent shrink-0 transition-colors"
      onMouseDown={onMouseDown}
    />
  );
}
```

- [ ] **Step 3: Create UsageBar.tsx**

```tsx
import { useEffect } from "react";
import { useAppStore } from "@/store/appStore";
import { fetchUsage } from "@/lib/api";

function usageColor(pct: number): string {
  if (pct >= 80) return "text-red-400";
  if (pct >= 50) return "text-amber-400";
  return "text-green-400";
}

function formatReset(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff < 0) return "now";
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.round(mins / 60)}h ${mins % 60}m`;
}

export default function UsageBar() {
  const usage = useAppStore((s) => s.usage);
  const setUsage = useAppStore((s) => s.setUsage);

  useEffect(() => {
    const load = async () => {
      const data = await fetchUsage();
      if (data) setUsage(data);
    };
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [setUsage]);

  if (!usage) return null;

  return (
    <div className="flex items-center gap-3 px-3 text-xs shrink-0">
      {[usage.five_hour, usage.seven_day].map((entry, i) => (
        <span key={i} className={usageColor(entry.utilization * 100)}>
          {entry.label}: {Math.round(entry.utilization * 100)}%
          <span className="text-gray-600 ml-1">
            (resets {formatReset(entry.resets_at)})
          </span>
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add public/app/src/components/Common/
git commit -m "feat: add StatusDot, Resizer, and UsageBar components"
```

---

## Task 8: Create TabBar Components

**Files:**
- Create: `public/app/src/components/TabBar/TabBar.tsx`
- Create: `public/app/src/components/TabBar/Tab.tsx`

- [ ] **Step 1: Create Tab.tsx**

```tsx
import StatusDot from "@/components/Common/StatusDot";
import type { Tab as TabType } from "@shared/types/agent";

interface TabProps {
  tab: TabType;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
}

export default function Tab({ tab, isActive, onSelect, onClose }: TabProps) {
  return (
    <div
      className={`group flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer border-b-2 whitespace-nowrap ${
        isActive
          ? "text-white border-accent bg-surface-1"
          : "text-gray-500 border-transparent hover:text-gray-300 hover:bg-surface-1"
      }`}
      onClick={onSelect}
    >
      <StatusDot status={tab.status} />
      <span className="truncate max-w-[120px]">{tab.name}</span>
      <button
        className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-white text-xs leading-none ml-1"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        x
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create TabBar.tsx**

```tsx
import { useAppStore } from "@/store/appStore";
import { getSocket } from "@/lib/socket";
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
          onSelect={() => setActiveTab(tab.id)}
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
```

- [ ] **Step 3: Commit**

```bash
git add public/app/src/components/TabBar/
git commit -m "feat: add TabBar and Tab components"
```

---

## Task 9: Create Chat Components

**Files:**
- Create: `public/app/src/components/Chat/ChatMessage.tsx`
- Create: `public/app/src/components/Chat/ChatInput.tsx`
- Create: `public/app/src/components/Chat/ChatToolbar.tsx`
- Create: `public/app/src/components/Chat/ChatPanel.tsx`

- [ ] **Step 1: Create ChatMessage.tsx**

```tsx
import { useEffect, useRef } from "react";
import { marked } from "marked";
import hljs from "highlight.js";
import type { Message } from "@shared/types/agent";
import { getToolDescription, escapeHtml } from "@/lib/constants";

function renderMarkdown(text: string): string {
  try {
    return marked.parse(text, { async: false }) as string;
  } catch {
    return escapeHtml(text);
  }
}

export default function ChatMessage({ message }: { message: Message }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.querySelectorAll("pre code").forEach((el) => {
        hljs.highlightElement(el as HTMLElement);
      });
    }
  }, [message.content, message.toolResult]);

  if (message.role === "user") {
    return (
      <div className="px-4 py-3 bg-surface-1 rounded-lg mx-3 my-2">
        <div className="text-xs text-gray-500 mb-1 font-medium">You</div>
        <div className="text-sm whitespace-pre-wrap">{message.content}</div>
      </div>
    );
  }

  if (message.role === "assistant") {
    return (
      <div className="px-4 py-2 mx-3 my-1" ref={ref}>
        <div
          className="text-sm prose max-w-none text-gray-200"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
        />
      </div>
    );
  }

  if (message.role === "tool") {
    const desc = getToolDescription(message.toolName || "", message.toolInput);
    return (
      <div className="mx-3 my-1 px-3 py-2 bg-surface-1 border-l-2 border-accent rounded text-xs">
        <div className="flex items-center gap-2">
          <span className="text-accent font-mono font-medium">{message.toolName}</span>
          <span className="text-gray-400">{desc}</span>
          {message.elapsed != null && (
            <span className="text-gray-600 ml-auto">{message.elapsed.toFixed(1)}s</span>
          )}
        </div>
        {message.toolResult && (
          <details className="mt-1">
            <summary className="text-gray-500 cursor-pointer hover:text-gray-300">Result</summary>
            <pre className="mt-1 text-xs text-gray-400 overflow-x-auto whitespace-pre-wrap max-h-40 overflow-y-auto">
              {message.toolResult}
            </pre>
          </details>
        )}
      </div>
    );
  }

  if (message.role === "system") {
    return (
      <div className="mx-3 my-1 px-3 py-2 bg-red-900/20 border-l-2 border-red-500 rounded text-xs text-red-300">
        {message.content}
      </div>
    );
  }

  return null;
}
```

- [ ] **Step 2: Create ChatInput.tsx**

```tsx
import { useState, useRef, useEffect } from "react";
import { useAppStore } from "@/store/appStore";
import { getSocket } from "@/lib/socket";

export default function ChatInput({ tabId }: { tabId: string }) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const tab = useAppStore((s) => s.tabs.find((t) => t.id === tabId));
  const addMessage = useAppStore((s) => s.addMessage);
  const updateTab = useAppStore((s) => s.updateTab);

  const isRunning = tab?.status === "running";

  // Focus input when tab becomes active
  const activeTabId = useAppStore((s) => s.activeTabId);
  useEffect(() => {
    if (activeTabId === tabId && inputRef.current) {
      inputRef.current.focus();
    }
  }, [activeTabId, tabId]);

  const send = () => {
    const text = value.trim();
    if (!text || !tab) return;

    addMessage(tabId, { role: "user", content: text });
    updateTab(tabId, { status: "running" });
    setValue("");

    const socket = getSocket();
    const payload = { agentId: tabId, prompt: text };

    if (tab.sessionId) {
      socket.emit("agent:message", payload);
    } else {
      socket.emit("agent:start", payload);
    }
  };

  const interrupt = () => {
    getSocket().emit("agent:interrupt", { agentId: tabId });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (isRunning) return;
      send();
    }
  };

  return (
    <div className="p-3 border-t border-border shrink-0">
      <div className="flex gap-2">
        <textarea
          ref={inputRef}
          className="flex-1 bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-white resize-none outline-none focus:border-accent placeholder-gray-600"
          placeholder={isRunning ? "Agent is working..." : "Ask the agent..."}
          rows={3}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isRunning}
        />
        {isRunning ? (
          <button
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg shrink-0 self-end transition-colors"
            onClick={interrupt}
          >
            Stop
          </button>
        ) : (
          <button
            className="px-4 py-2 bg-accent hover:bg-accent-light text-black text-sm font-medium rounded-lg shrink-0 self-end transition-colors"
            onClick={send}
          >
            Send
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create ChatToolbar.tsx**

```tsx
import { useState, useRef, useEffect } from "react";
import { useAppStore } from "@/store/appStore";

export default function ChatToolbar({ tabId }: { tabId: string }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const tab = useAppStore((s) => s.tabs.find((t) => t.id === tabId));
  const updateTab = useAppStore((s) => s.updateTab);
  const clearMessages = useAppStore((s) => s.clearMessages);

  useEffect(() => {
    if (renaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [renaming]);

  if (!tab) return null;

  const startRename = () => {
    setMenuOpen(false);
    setNameValue(tab.name);
    setRenaming(true);
  };

  const finishRename = () => {
    const name = nameValue.trim() || tab.name;
    updateTab(tabId, { name });
    setRenaming(false);
  };

  const handleClear = () => {
    setMenuOpen(false);
    clearMessages(tabId);
  };

  return (
    <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-surface-1 shrink-0">
      {renaming ? (
        <input
          ref={inputRef}
          className="bg-surface-2 border border-accent rounded px-2 py-0.5 text-xs text-gray-200 outline-none font-mono w-32"
          value={nameValue}
          onChange={(e) => setNameValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") finishRename();
            if (e.key === "Escape") setRenaming(false);
          }}
          onBlur={finishRename}
        />
      ) : (
        <span className="text-xs text-gray-500 font-medium">{tab.name}</span>
      )}
      <div className="relative">
        <button
          className="text-gray-500 hover:text-white text-sm px-1 leading-none"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          ...
        </button>
        {menuOpen && (
          <div className="absolute top-full right-0 bg-surface-2 border border-border rounded-md py-1 min-w-[160px] z-50 shadow-lg">
            <button
              className="block w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-surface-3 hover:text-white"
              onClick={handleClear}
            >
              Clear conversation
            </button>
            <button
              className="block w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-surface-3 hover:text-white"
              onClick={startRename}
            >
              Rename tab
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create ChatPanel.tsx**

```tsx
import { useEffect, useRef } from "react";
import { useAppStore } from "@/store/appStore";
import ChatToolbar from "./ChatToolbar";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";

export default function ChatPanel({ tabId }: { tabId: string }) {
  const messages = useAppStore(
    (s) => s.tabs.find((t) => t.id === tabId)?.messages || []
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, messages[messages.length - 1]?.content]);

  return (
    <div className="flex flex-col h-full">
      <ChatToolbar tabId={tabId} />
      <div className="flex-1 overflow-y-auto" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-600 text-sm">
            <div className="text-center">
              <div className="text-2xl mb-2">&#9672;</div>
              <div>Start a conversation with the agent</div>
              <div className="text-xs text-gray-700 mt-1">
                The agent can read, write, and edit files in your project
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg, i) => <ChatMessage key={i} message={msg} />)
        )}
      </div>
      <ChatInput tabId={tabId} />
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add public/app/src/components/Chat/
git commit -m "feat: add ChatPanel, ChatMessage, ChatInput, ChatToolbar components"
```

---

## Task 10: Create Preview Components

**Files:**
- Create: `public/app/src/components/Preview/AddressBar.tsx`
- Create: `public/app/src/components/Preview/PreviewPanel.tsx`

- [ ] **Step 1: Create AddressBar.tsx**

```tsx
import { useState } from "react";
import { useAppStore } from "@/store/appStore";

interface AddressBarProps {
  tabId: string;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
}

export default function AddressBar({ tabId, iframeRef }: AddressBarProps) {
  const tab = useAppStore((s) => s.tabs.find((t) => t.id === tabId));
  const updateTab = useAppStore((s) => s.updateTab);
  const [editingUrl, setEditingUrl] = useState(false);
  const [urlInput, setUrlInput] = useState("");

  if (!tab) return null;

  const goBack = () => {
    try {
      iframeRef.current?.contentWindow?.history.back();
    } catch {}
  };

  const refresh = () => {
    try {
      iframeRef.current?.contentWindow?.location.reload();
    } catch {
      if (iframeRef.current) iframeRef.current.src = iframeRef.current.src;
    }
  };

  const navigate = (route: string) => {
    if (iframeRef.current) {
      iframeRef.current.src = route;
      updateTab(tabId, { previewRoute: route });
    }
  };

  const zoom = (delta: number) => {
    if (!tab) return;
    let z = tab.zoom;
    if (delta === 0) z = 100;
    else z = Math.max(30, Math.min(200, z + delta));
    updateTab(tabId, { zoom: z });
  };

  const openExternal = () => {
    if (tab.previewUrl) {
      window.open(tab.previewUrl + tab.previewRoute, "_blank");
    }
  };

  const startEditUrl = () => {
    setUrlInput(tab.previewUrl || "");
    setEditingUrl(true);
  };

  const applyUrl = () => {
    let url = urlInput.trim();
    if (url && !url.match(/^https?:\/\//)) url = `http://${url}`;
    if (url) {
      updateTab(tabId, { previewUrl: url });
      import("@/lib/api").then((m) => m.setPreviewTarget(url));
    }
    setEditingUrl(false);
  };

  return (
    <div className="flex items-center gap-1 px-2 py-1 border-b border-border bg-surface-1 text-xs shrink-0">
      <button className="px-1.5 py-0.5 text-gray-500 hover:text-white" onClick={goBack} title="Back">
        &larr;
      </button>
      <button className="px-1.5 py-0.5 text-gray-500 hover:text-white" onClick={refresh} title="Refresh">
        &#8635;
      </button>

      <input
        className="flex-1 bg-surface-2 border border-border rounded px-2 py-0.5 text-gray-300 outline-none focus:border-accent font-mono"
        value={tab.previewRoute}
        onChange={(e) => updateTab(tabId, { previewRoute: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === "Enter") navigate(e.currentTarget.value);
        }}
        placeholder="/"
      />

      <button
        className="px-1.5 py-0.5 text-gray-500 hover:text-white"
        onClick={() => zoom(-10)}
        title="Zoom out"
      >
        -
      </button>
      <span className="text-gray-600 w-8 text-center">{tab.zoom}%</span>
      <button
        className="px-1.5 py-0.5 text-gray-500 hover:text-white"
        onClick={() => zoom(10)}
        title="Zoom in"
      >
        +
      </button>
      <button
        className="px-1.5 py-0.5 text-gray-500 hover:text-white"
        onClick={() => zoom(0)}
        title="Reset zoom"
      >
        1:1
      </button>

      <button className="px-1.5 py-0.5 text-gray-500 hover:text-white" onClick={openExternal} title="Open in browser">
        &#8599;
      </button>

      {editingUrl ? (
        <div className="flex gap-1">
          <input
            className="bg-surface-2 border border-accent rounded px-2 py-0.5 text-gray-200 outline-none font-mono w-40"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyUrl();
              if (e.key === "Escape") setEditingUrl(false);
            }}
            autoFocus
          />
          <button className="text-accent text-xs" onClick={applyUrl}>
            OK
          </button>
        </div>
      ) : (
        <button
          className="px-1.5 py-0.5 text-gray-600 hover:text-accent text-xs font-mono truncate max-w-[140px]"
          onClick={startEditUrl}
          title="Change preview URL"
        >
          {tab.previewUrl || "Set URL..."}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create PreviewPanel.tsx**

```tsx
import { useRef, useEffect } from "react";
import { useAppStore } from "@/store/appStore";
import { getSocket } from "@/lib/socket";
import AddressBar from "./AddressBar";

export default function PreviewPanel({ tabId }: { tabId: string }) {
  const tab = useAppStore((s) => s.tabs.find((t) => t.id === tabId));
  const updateTab = useAppStore((s) => s.updateTab);
  const iframeRef = useRef<HTMLIFrameElement>(null);

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

  if (!tab) return null;

  const hasPreview = !!tab.previewUrl;
  const scale = tab.zoom / 100;

  // In dev mode, the iframe must load through Express proxy (port 3000),
  // not through Vite (port 5173). The Express server proxies all non-/_app
  // routes to the preview target. Use the route directly since Vite proxies
  // all non-matched routes to Express via the proxy config.
  // In production, Express handles everything on one port.
  const iframeSrc = tab.previewRoute;

  return (
    <div className="flex flex-col h-full flex-1">
      <AddressBar tabId={tabId} iframeRef={iframeRef} />
      <div className="flex-1 overflow-hidden relative">
        {hasPreview ? (
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
        ) : (
          <div className="flex items-center justify-center h-full text-gray-600 text-sm">
            <div className="text-center">
              <div className="text-lg mb-1">No preview</div>
              <div className="text-xs text-gray-700">
                Start the agent and it will auto-detect your dev server,
                <br />
                or set a URL manually from the address bar
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add public/app/src/components/Preview/
git commit -m "feat: add PreviewPanel and AddressBar components"
```

---

## Task 11: Create DirectoryPicker and MainUI

**Files:**
- Create: `public/app/src/components/DirectoryPicker.tsx`
- Create: `public/app/src/components/MainUI.tsx`

- [ ] **Step 1: Create DirectoryPicker.tsx**

```tsx
import { useState, useEffect, useRef } from "react";
import { useAppStore } from "@/store/appStore";
import { checkDir, getHome, setCwd, loadState, setPreviewTarget } from "@/lib/api";

export default function DirectoryPicker() {
  const [path, setPath] = useState("");
  const [error, setError] = useState("");
  const [projects, setProjects] = useState<{ name: string; path: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const store = useAppStore();

  useEffect(() => {
    getHome().then((data) => {
      setProjects(data.projects || []);
      setPath(data.suggestions?.[0] || data.home || "");
    });
    inputRef.current?.focus();
  }, []);

  const open = async (dir: string) => {
    setError("");
    const result = await checkDir(dir);
    if (!result.valid) {
      setError("Directory not found");
      return;
    }
    await setCwd(result.path);
    store.setCwd(result.path);

    // Load saved state
    const saved = await loadState(result.path);
    if (saved?.state?.tabs?.length) {
      store.loadFromSaved(saved.state);
      // Restore preview proxy for any tab with a preview URL
      const restoredTab = saved.state.tabs.find((t: any) => t.previewUrl);
      if (restoredTab?.previewUrl) {
        setPreviewTarget(restoredTab.previewUrl);
      }
    } else {
      store.addTab();
    }

    store.setReady(true);
  };

  return (
    <div className="flex items-center justify-center h-full">
      <div className="w-full max-w-lg px-6">
        <div className="text-center mb-8">
          <div className="text-3xl text-accent mb-2">&#9672; Samara UI</div>
          <div className="text-gray-500 text-sm">Select a project directory</div>
        </div>

        <div className="mb-4">
          <input
            ref={inputRef}
            className="w-full bg-surface-1 border border-border rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-accent placeholder-gray-600 font-mono"
            placeholder="Enter project path..."
            value={path}
            onChange={(e) => setPath(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") open(path);
            }}
          />
          {error && <div className="text-red-400 text-xs mt-1">{error}</div>}
        </div>

        {projects.length > 0 && (
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="text-xs text-gray-500 px-3 py-2 bg-surface-1 border-b border-border font-medium">
              Projects
            </div>
            {projects.map((p) => (
              <div
                key={p.path}
                className="px-3 py-2 text-sm text-gray-300 hover:bg-surface-1 cursor-pointer border-b border-border last:border-0"
                onClick={() => open(p.path)}
              >
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-gray-600 font-mono">{p.path}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create MainUI.tsx**

```tsx
import { useRef } from "react";
import { useAppStore } from "@/store/appStore";
import TabBar from "@/components/TabBar/TabBar";
import ChatPanel from "@/components/Chat/ChatPanel";
import PreviewPanel from "@/components/Preview/PreviewPanel";
import Resizer from "@/components/Common/Resizer";

export default function MainUI() {
  const tabs = useAppStore((s) => s.tabs);
  const activeTabId = useAppStore((s) => s.activeTabId);
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const chatRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex flex-col h-full">
      <TabBar />
      <div className="flex-1 overflow-hidden">
        {activeTab ? (
          <div className="flex h-full" ref={containerRef}>
            <div className="flex flex-col h-full" ref={chatRef} style={{ width: "35%", minWidth: 280 }}>
              <ChatPanel tabId={activeTab.id} />
            </div>
            <Resizer panelRef={chatRef} containerRef={containerRef} />
            <PreviewPanel tabId={activeTab.id} />
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
```

- [ ] **Step 3: Commit**

```bash
git add public/app/src/components/DirectoryPicker.tsx public/app/src/components/MainUI.tsx
git commit -m "feat: add DirectoryPicker and MainUI components"
```

---

## Task 12: Wire App.tsx with all hooks and components

**Files:**
- Modify: `public/app/src/App.tsx`

- [ ] **Step 1: Update App.tsx**

```tsx
import { useAppStore } from "@/store/appStore";
import { useSocket } from "@/hooks/useSocket";
import { useAutoSave } from "@/hooks/useAutoSave";
import DirectoryPicker from "@/components/DirectoryPicker";
import MainUI from "@/components/MainUI";

export default function App() {
  const ready = useAppStore((s) => s.ready);

  useSocket();
  useAutoSave();

  return ready ? <MainUI /> : <DirectoryPicker />;
}
```

- [ ] **Step 2: Verify the full app renders with Vite dev server**

```bash
cd public/app && npm run dev
```

Expected: App loads at http://localhost:5173, shows directory picker. After selecting a project, shows tab bar + chat + preview.

- [ ] **Step 3: Commit**

```bash
git add public/app/src/App.tsx
git commit -m "feat: wire App.tsx with socket, auto-save, and routing"
```

---

## Task 13: Migrate Server to TypeScript

**Files:**
- Rename: `server/index.js` → `server/index.ts`
- Rename: `server/agent-manager.js` → `server/agent-manager.ts`
- Rename: `server/preview-browser.js` → `server/preview-browser.ts`
- Create: `server/types.ts`
- Create: `server/tsconfig.json`
- Modify: `package.json` (root)

- [ ] **Step 1: Create server/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "strict": true,
    "outDir": "dist",
    "noEmit": true,
    "paths": {
      "@shared/*": ["../shared/*"]
    }
  },
  "include": [".", "../shared"]
}
```

- [ ] **Step 2: Create server/types.ts**

```typescript
import type { Socket } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "@shared/types/socket";

export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export interface PreviewBrowserInterface {
  launch(uiUrl: string): Promise<void>;
  screenshot(agentId: string): Promise<string | null>;
  navigate(agentId: string, route: string): Promise<void>;
  refresh(agentId: string): Promise<void>;
  click(agentId: string, selector: string): Promise<string>;
  type(agentId: string, selector: string, text: string): Promise<string>;
  inspect(agentId: string, selector: string): Promise<string>;
  getUrl(agentId: string): Promise<string>;
  getPageContent(agentId: string, selector?: string): Promise<string>;
  close(): Promise<void>;
}
```

- [ ] **Step 3: Rename server files from .js to .ts and add type annotations**

Rename all three files. Add type annotations to function parameters and return types. Import shared types. The logic stays identical — this is purely adding `: string`, `: void`, interface declarations, etc.

Key changes per file:
- `server/index.ts`: Type `req`, `res` params. Type socket handlers. Import `TypedSocket`.
- `server/agent-manager.ts`: Type `runAgent` params. Type the MCP tool handlers. Import shared types.
- `server/preview-browser.ts`: Type all method params/returns. Type Playwright objects.

- [ ] **Step 4: Update root package.json**

Add/update:
```json
{
  "scripts": {
    "dev": "concurrently \"tsx server/index.ts\" \"cd public/app && npx vite\"",
    "build": "cd public/app && npm run build",
    "start": "tsx server/index.ts"
  },
  "devDependencies": {
    "concurrently": "^9.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.8.0",
    "@types/express": "^5.0.0"
  }
}
```

- [ ] **Step 5: Install root dependencies and verify server starts**

```bash
npm install
npm run dev
```

Expected: Both server and Vite start. App accessible at http://localhost:5173.

- [ ] **Step 6: Commit**

```bash
git add server/ package.json package-lock.json
git commit -m "feat: migrate server to TypeScript"
```

---

## Task 14: Update Express to serve Vite build in production

**Files:**
- Modify: `server/index.ts`

- [ ] **Step 1: Update the static file serving in server/index.ts**

Replace the old `/_app` static route to serve Vite's build output:

```typescript
import { existsSync } from "fs";

// In production, serve Vite build
const distPath = join(__dirname, "..", "public", "app", "dist");
if (existsSync(distPath)) {
  app.use("/_app", express.static(distPath));
  // SPA fallback
  app.get("/_app/*", (_req, res) => {
    res.sendFile(join(distPath, "index.html"));
  });
}
```

- [ ] **Step 2: Verify production build works**

```bash
cd public/app && npm run build
cd ../.. && npm start
```

Expected: App loads at http://localhost:3000/_app/

- [ ] **Step 3: Commit**

```bash
git add server/index.ts
git commit -m "feat: serve Vite production build from Express"
```

---

## Task 15: End-to-end verification and cleanup

- [ ] **Step 1: Full functional test**

Open http://localhost:5173 (dev mode). Verify:
1. Directory picker shows with project suggestions
2. Selecting a project loads saved state or creates first tab
3. Tab bar shows tabs with status dots
4. Chat input accepts text, sends to agent via socket
5. Agent responses stream in (text, tools, results)
6. Preview auto-detects URLs and shows iframe
7. Address bar navigation works
8. Zoom controls work
9. Panel resize works
10. New tab / close tab works
11. Clear conversation works
12. Rename tab works
13. Usage bar shows percentages
14. State saves on interval and restores on reload

- [ ] **Step 2: Delete old vanilla files**

```bash
rm public/app.js public/styles.css public/index.html
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: remove old vanilla JS files, React migration complete"
```

---

## Summary

| Task | Description | Est. Steps |
|------|-------------|------------|
| 1 | Scaffold Vite + React + TS | 8 |
| 2 | Shared types | 4 |
| 3 | Zustand store | 2 |
| 4 | lib/ utilities | 4 |
| 5 | useSocket hook | 2 |
| 6 | useAutoSave hook | 2 |
| 7 | Common components | 4 |
| 8 | TabBar components | 3 |
| 9 | Chat components | 5 |
| 10 | Preview components | 3 |
| 11 | DirectoryPicker + MainUI | 3 |
| 12 | Wire App.tsx | 3 |
| 13 | Server TS migration | 6 |
| 14 | Production build serving | 3 |
| 15 | E2E verification + cleanup | 3 |
| **Total** | | **55 steps** |
