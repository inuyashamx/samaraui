# Samara UI - Menu Bar & React Migration Design

## Overview

Migrate Samara UI from vanilla JS to a Vite + React + Tailwind + TypeScript stack, adding a desktop-style menu bar with full application functionality. The app retains its current chat + preview layout but gains project management, settings, tools, and configuration access via menus.

## Goals

- Migrate frontend to React/TS for scalability as features grow
- Migrate server to TypeScript for consistency and type safety
- Add a persistent menu bar (File, Project, Agent, View, Tools, Settings, Help)
- Structure for incremental feature delivery across 3 phases
- Keep the existing chat + preview layout unchanged

## Non-Goals

- Changing the core UX paradigm (no IDE transformation)
- Adding a bundled code editor
- Multi-user / auth system
- Mobile responsiveness (desktop-first app)

---

## Architecture

### Frontend Stack

- **Vite** - build tool, dev server with HMR
- **React 19** - UI framework
- **TypeScript** - type safety
- **Tailwind CSS v4** - utility-first styling (CSS-based config via `@theme` in `index.css`, no `tailwind.config` file)
- **Zustand** - state management
- **Socket.io-client** - real-time communication
- **xterm.js** - embedded terminal (Phase 3)

### Server Stack

- **Express 5** - HTTP server (migrated to TypeScript, API unchanged)
- **TypeScript** via `tsx` runtime
- **Socket.io** - real-time communication (unchanged)
- **Playwright** - preview browser automation (unchanged)
- **@anthropic-ai/claude-agent-sdk** - agent queries (unchanged)

### New Dependencies to Add

**Root package.json (server):**
- `tsx` - TypeScript execution for server
- `typescript` - type checking
- `concurrently` (devDep) - run server + vite in parallel

**Frontend package.json (`public/app/`):**
- `react`, `react-dom`
- `zustand`
- `socket.io-client`
- `tailwindcss`, `@tailwindcss/vite`
- `typescript`, `@types/react`, `@types/react-dom`
- `vite`, `@vitejs/plugin-react`

### Vite + Express Integration

**Development:**
- Vite dev server on port 5173 (HMR, fast refresh)
- Express on port 3000 (API, socket.io, preview proxy)
- Frontend fetches from `localhost:3000/api/*`, socket.io connects to `localhost:3000`

**Production:**
- `vite build` outputs to `public/app/dist/`
- Express serves `dist/` as static files at `/_app/`
- Single port deployment

**Scripts (root package.json):**
```json
{
  "dev": "concurrently \"tsx server/index.ts\" \"cd public/app && vite\"",
  "build": "cd public/app && vite build",
  "start": "tsx server/index.ts"
}
```

### Type Sharing Strategy

Shared types between server and client live in a top-level `shared/` directory:

```
shared/
  types/
    agent.ts        # Tab, Message, AgentStatus
    socket.ts       # Socket event names and payloads
    settings.ts     # Settings interfaces
```

Both `tsconfig.json` files (server and client) use path aliases to reference `shared/`:
```json
{ "paths": { "@shared/*": ["../../shared/*"] } }
```

Vite config adds the same alias for bundling.

---

## Project Structure

### Frontend

```
public/
  app/
    index.html
    vite.config.ts
    tsconfig.json
    package.json
    src/
      main.tsx                    # Entry point
      App.tsx                     # Root: MenuBar + TabBar + TabContent
      index.css                   # Tailwind v4 @theme config + custom CSS

      types/
        menu.ts                   # MenuItem, MenuSection

      hooks/
        useSocket.ts              # Socket.io connection + event handlers
        useAgentState.ts          # Tabs, messages, sessions
        usePreview.ts             # Preview URL detection, zoom, navigation
        useSettings.ts            # Settings read/write
        useKeyboard.ts            # Global keyboard shortcuts

      components/
        MenuBar/
          MenuBar.tsx             # File|Project|Agent|View|Tools|Settings|Help
          MenuDropdown.tsx        # Reusable dropdown with submenus

        TabBar/
          TabBar.tsx              # Tab strip + new tab + usage bar
          Tab.tsx                 # Individual tab with status dot

        Chat/
          ChatPanel.tsx           # Container: toolbar + messages + input
          ChatMessage.tsx         # Message render (user/assistant/tool/system)
          ChatInput.tsx           # Textarea + send/stop
          ChatToolbar.tsx         # Name + context menu

        Preview/
          PreviewPanel.tsx        # Container: address bar + iframe
          AddressBar.tsx          # URL, back, refresh, zoom, open browser

        Panels/
          SettingsPanel.tsx       # Settings modal/drawer
          ProjectInfo.tsx         # CLAUDE.md, MCP servers, skills, hooks
          FileExplorer.tsx        # Tree view of project
          Terminal.tsx            # Embedded terminal (xterm.js)
          ActivityLog.tsx         # Tool calls stream
          UsageDashboard.tsx      # Usage charts
          TemplatesManager.tsx    # Prompt & scaffold templates
          GitPanel.tsx            # Git status, log, diff

        Common/
          Modal.tsx               # Generic modal
          Dropdown.tsx            # Generic dropdown
          Resizer.tsx             # Drag handle between panels
          StatusDot.tsx           # idle/running/error indicator
          CommandPalette.tsx      # Ctrl+K command palette

      store/
        appStore.ts               # Zustand store with slices

      lib/
        socket.ts                 # Socket.io client singleton
        api.ts                    # Fetch helpers for /api/*
        constants.ts              # Models, default shortcuts, etc.
```

### Shared Types

```
shared/
  types/
    agent.ts                      # Tab, Message, AgentStatus, ToolCall
    socket.ts                     # Socket event payloads (client & server)
    settings.ts                   # Settings, MCPServer, Skill, Hook
```

### Server

```
server/
  index.ts                        # Express + socket.io setup
  agent-manager.ts                # Agent lifecycle + MCP server
  preview-browser.ts              # Playwright preview control
  types.ts                        # Server-only types
```

---

## Socket.io Events

### Client -> Server

| Event | Payload | Description |
|-------|---------|-------------|
| `agent:start` | `{ agentId, prompt, model?, maxTurns?, maxBudget?, permissionMode? }` | Start agent query. Optional fields override tab defaults. |
| `agent:message` | `{ agentId, prompt, model?, maxTurns?, maxBudget?, permissionMode? }` | Continue existing session (resume mode) |
| `agent:interrupt` | `{ agentId }` | Abort running agent |

### Server -> Client

| Event | Payload | Description |
|-------|---------|-------------|
| `agent:init` | `{ agentId, sessionId, model, tools }` | Agent session initialized |
| `agent:text` | `{ agentId, text }` | Assistant text chunk |
| `agent:tool_use` | `{ agentId, toolUseId, tool, input }` | Tool invocation started |
| `agent:tool_result` | `{ agentId, content }` | Tool result (truncated to 2000 chars) |
| `agent:tool_progress` | `{ agentId, toolUseId, tool, elapsed }` | Tool execution progress |
| `agent:result` | `{ agentId, result, errors, subtype, cost, turns, duration, sessionId }` | Agent query completed |
| `agent:error` | `{ agentId, error }` | Agent query failed |
| `preview:navigate` | `{ agentId, route }` | Agent navigated preview |
| `preview:refresh` | `{ agentId }` | Agent refreshed preview |
| `preview:current-url` | `{ url }` | Current preview URL response |
| `preview:url-update` | `{ agentId, url }` | Preview URL changed |

### Agent-Manager Changes for Per-Tab Settings

The `runAgent` method must accept and forward per-tab options to the SDK `query()` call:

```typescript
async runAgent(agentId: string, prompt: string, socket: Socket, options: {
  resume?: boolean
  model?: string
  maxTurns?: number
  maxBudget?: number
  permissionMode?: 'bypassPermissions' | 'default' | 'acceptEdits'
}) {
  const queryOptions = {
    ...baseOptions,
    ...(options.model && { model: options.model }),
    ...(options.maxTurns && { maxTurns: options.maxTurns }),
    ...(options.maxBudget && { maxBudgetUsd: options.maxBudget }),
    ...(options.permissionMode && { permissionMode: options.permissionMode }),
  }
}
```

---

## Menu Bar Specification

### Disabled Items

Phase 2/3 items render as greyed-out text with a tooltip "Coming soon". The `MenuItem` type includes:

```typescript
interface MenuItem {
  label: string
  shortcut?: string
  action?: () => void
  submenu?: MenuItem[]
  enabled: boolean           // false = greyed out + "Coming soon" tooltip
  separator?: boolean        // renders a divider line
}
```

### File

| Item | Shortcut | Behavior | Phase |
|------|----------|----------|-------|
| New Agent Tab | Ctrl+T | Creates new tab with default name | 1 |
| Close Tab | Ctrl+W | Closes active tab, interrupts if running | 1 |
| Open Project... | Ctrl+O | Opens directory picker as modal overlay | 1 |
| Recent Projects | submenu | Lists last 10 projects from localStorage | 1 |
| Export Chat... | - | Downloads active chat as .md file | 2 |
| Export All Sessions... | - | Downloads zip of all sessions | 3 |

Note: No Quit item. This is a browser app; closing is handled by the browser tab.

### Project

| Item | Shortcut | Behavior | Phase |
|------|----------|----------|-------|
| Project Info | - | Panel showing readme, git remote, branch | 2 |
| CLAUDE.md | - | Text editor for CLAUDE.md | 2 |
| .claude/settings.json | - | JSON editor for project settings | 2 |
| MCP Servers | - | List with connection status, add/remove | 2 |
| Skills | - | List with preview content | 2 |
| Hooks | - | List with inline editor | 3 |
| Git Status | - | Panel with git status output | 2 |
| Git Log | - | Panel with recent commits | 2 |
| Open in Terminal | - | Opens OS terminal at cwd | 1 |
| Open in VS Code | - | Runs `code .` at cwd | 1 |

### Agent

| Item | Shortcut | Behavior | Phase |
|------|----------|----------|-------|
| Clear Conversation | - | Clears messages, resets session | 1 |
| Rename Tab... | - | Inline rename input | 1 |
| Change Model | submenu | Opus 4 / Sonnet 4 / Haiku 4 | 1 |
| Max Turns | - | Numeric input, default unlimited | 1 |
| Max Budget | - | Dollar input, default $5.00 | 1 |
| Permission Mode | submenu | bypass / default / acceptEdits | 1 |
| System Prompt Override... | - | Textarea modal for custom append | 2 |
| Interrupt Agent | Esc | Aborts running agent | 1 |

### View

| Item | Shortcut | Behavior | Phase |
|------|----------|----------|-------|
| Toggle Chat Panel | Ctrl+1 | Show/hide chat panel | 1 |
| Toggle Preview Panel | Ctrl+2 | Show/hide preview panel | 1 |
| Focus Chat | Ctrl+L | Focus the chat textarea | 1 |
| Preview Zoom In | Ctrl+= | Increase preview zoom | 1 |
| Preview Zoom Out | Ctrl+- | Decrease preview zoom | 1 |
| Preview Zoom Reset | Ctrl+0 | Reset preview to 100% | 1 |
| Layout: Side by Side | - | Default split layout | 1 |
| Layout: Chat Only | - | Full width chat | 1 |
| Layout: Preview Only | - | Full width preview | 1 |
| Activity Log | - | Opens tool calls panel | 2 |
| Usage Dashboard | - | Opens usage charts panel | 3 |

### Tools

| Item | Shortcut | Behavior | Phase |
|------|----------|----------|-------|
| Terminal | Ctrl+` | Opens embedded terminal panel | 3 |
| File Explorer | - | Opens tree view panel | 2 |
| Screenshot Preview | - | Triggers manual screenshot | 1 |
| Inspect Element | - | Triggers DOM inspector | 1 |
| Templates | submenu | Prompt templates / Project scaffolds | 2 |
| Command Palette | Ctrl+K | Opens command palette overlay | 2 |
| Snippets Manager | - | Save/reuse prompt snippets | 3 |

### Settings

| Item | Behavior | Phase |
|------|----------|-------|
| General | Theme, font size, UI preferences | 2 |
| Default Model | Dropdown to set default model for new tabs | 1 |
| Default Permissions | Dropdown for default permission mode | 1 |
| API Key / Auth | Secure input for API key | 2 |
| Proxy Settings | Proxy URL configuration | 3 |
| Preview Server Config | Port, proxy behavior | 3 |
| Keyboard Shortcuts | Editable shortcut list | 3 |
| About Samara UI | Version info modal | 1 |

### Help

| Item | Shortcut | Behavior | Phase |
|------|----------|----------|-------|
| Documentation | - | Opens docs in browser | 1 |
| Keyboard Shortcuts | Ctrl+? | Modal with shortcut list | 1 |
| Report Issue | - | Opens GitHub issues | 1 |
| Claude Code Docs | - | Opens Claude Code docs | 1 |
| Agent SDK Reference | - | Opens SDK docs | 1 |
| About | - | Version, credits modal | 1 |

---

## State Management

### Zustand Store Slices

```typescript
interface AppStore {
  // Tabs & Agents
  tabs: Tab[]
  activeTabId: string
  addTab: () => void
  removeTab: (id: string) => void
  updateTab: (id: string, patch: Partial<Tab>) => void
  setActiveTab: (id: string) => void

  // App State
  cwd: string
  ready: boolean
  connected: boolean
  setCwd: (path: string) => void

  // Menu & UI
  activeMenu: string | null
  openPanels: PanelType[]        // Multiple panels can be open
  layout: 'split' | 'chat' | 'preview'
  commandPaletteOpen: boolean
  setActiveMenu: (menu: string | null) => void
  togglePanel: (panel: PanelType) => void
  setLayout: (layout: 'split' | 'chat' | 'preview') => void

  // Settings
  settings: Settings
  updateSettings: (patch: Partial<Settings>) => void

  // Usage
  usage: UsageData | null
  fetchUsage: () => Promise<void>
}
```

### Key Types

```typescript
interface Tab {
  id: string
  name: string
  status: 'idle' | 'running' | 'error'
  messages: Message[]
  sessionId: string | null
  previewUrl: string | null       // null = no preview (legacy "" normalized to null)
  previewRoute: string
  zoom: number
  model: string
  maxTurns: number | null
  maxBudget: number | null
  permissionMode: 'bypassPermissions' | 'default' | 'acceptEdits'
  systemPromptOverride: string | null
  lastCost: number | null
  lastDuration: number | null
  lastTurns: number | null
}

interface Message {
  role: 'user' | 'assistant' | 'tool' | 'system'
  content: string
  toolUseId?: string
  toolName?: string
  toolInput?: unknown
  toolResult?: string
  elapsed?: number
  timestamp?: number              // Optional for backward compat with saved sessions
}

type PanelType =
  | 'settings'
  | 'projectInfo'
  | 'claudeMd'
  | 'projectSettings'
  | 'mcpServers'
  | 'skills'
  | 'hooks'
  | 'git'
  | 'fileExplorer'
  | 'terminal'
  | 'activityLog'
  | 'usageDashboard'
  | 'templates'
  | 'snippets'
  | 'shortcuts'

interface Settings {
  theme: 'dark' | 'light'
  fontSize: number
  defaultModel: string
  defaultPermissionMode: string
  apiKey: string | null
  proxyUrl: string | null
  previewPort: number | null
  shortcuts: Record<string, string>
}
```

### Panel Rendering Strategy

Panels render as **slide-in drawers** from the right side, overlaying the preview panel. Multiple panels can be open simultaneously (stacked as tabs within the drawer area). Modal-type panels (About, Keyboard Shortcuts) render as centered modals instead.

- **Drawer panels**: Settings, ProjectInfo, CLAUDE.md, Git, FileExplorer, ActivityLog, Templates, Snippets, MCP Servers, Skills, Hooks, Usage Dashboard
- **Modal panels**: About, Keyboard Shortcuts, System Prompt Override
- **Bottom panel**: Terminal (docked at bottom, resizable)

---

## Error & Loading States

- **Socket disconnection**: Toast notification "Disconnected - reconnecting..." with auto-reconnect. Store sets `connected: false`, UI shows subtle indicator in the status area.
- **API errors**: Toast notifications with error message, auto-dismiss after 5s. Non-blocking.
- **Agent errors**: Displayed inline in chat as system messages (existing behavior preserved).
- **Panel loading**: Skeleton/spinner while fetching API data. Each panel manages its own loading state.
- **React error boundary**: Wraps each major section (MenuBar, TabBar, ChatPanel, PreviewPanel, Panels) independently so a crash in one section does not take down the whole app.

---

## Session Migration

Existing sessions saved in `~/.samara-ui/sessions/` use the vanilla JS shape. Phase 1 loads them with best-effort normalization:

- Missing fields get defaults (e.g., `model: "claude-sonnet-4-6"`, `maxTurns: null`, `permissionMode: "bypassPermissions"`)
- `previewUrl: ""` normalized to `null`
- Messages without `timestamp` are preserved as-is (field is optional)
- Messages without `toolUseId`/`toolResult`/`elapsed` are preserved (fields are optional)
- Unrecognized fields are silently dropped

No migration script needed; normalization happens at load time in the Zustand store's `loadState` action.

---

## API Endpoints

### Existing (unchanged)

```
GET  /api/check-dir?path=       # Validate directory exists
GET  /api/home                   # Suggested project paths
POST /api/set-preview            # Set preview target URL
GET  /api/usage                  # Claude Code usage (cached 30s)
POST /api/state                  # Save session state
GET  /api/state?cwd=             # Load session state
POST /api/set-cwd                # Set working directory
```

### New Endpoints

```
GET  /api/project-info           # { readme, gitRemote, branch, name }
GET  /api/claude-md              # Raw CLAUDE.md content
PUT  /api/claude-md              # Save CLAUDE.md content
GET  /api/project-settings       # .claude/settings.json content
PUT  /api/project-settings       # Save .claude/settings.json
GET  /api/mcp-servers            # [{ name, type, status, config }]
GET  /api/skills                 # [{ name, path, description }]
GET  /api/hooks                  # [{ event, matchers }]
GET  /api/git/status             # Git status output
GET  /api/git/log                # [{ hash, message, date, author }]
GET  /api/files?path=            # Directory listing for file explorer
GET  /api/file?path=             # File content (read-only)
GET  /api/settings               # Samara UI settings
PUT  /api/settings               # Save Samara UI settings
GET  /api/recent-projects        # [{ path, name, lastOpened }]
POST /api/open-external          # Open terminal/VS Code at cwd
```

---

## Implementation Phases

### Phase 1a: React Scaffold + Core Migration

Migrate existing vanilla JS to React/TS. All current functionality preserved. No menu bar yet.

**Deliverables:**
- Vite + React + Tailwind v4 + TS project scaffold in `public/app/`
- Shared types in `shared/types/`
- Server migrated to TypeScript (rename + type annotations, no new endpoints)
- Zustand store replacing global state object
- All current features working: tabs, chat, preview, state persistence, usage bar
- Socket.io events ported to `useSocket` hook
- Session load normalization for backward compatibility
- Error boundaries around major sections

### Phase 1b: Menu Bar + Keyboard Shortcuts

Add the menu bar and wire it to existing + trivial new actions.

**Deliverables:**
- Menu bar component with all 7 menus rendered
- Phase 1 items functional, Phase 2/3 items greyed out with "Coming soon" tooltip
- Keyboard shortcuts for all Phase 1 items
- Agent menu: model selection, max turns, max budget, permission mode (requires agent-manager changes)
- View menu: layout modes (split/chat/preview), panel toggles, zoom
- Open in Terminal / Open in VS Code (via `/api/open-external`)
- Open Project as modal overlay (reuses directory picker)
- Recent Projects in localStorage
- About modal, Help links
- Keyboard shortcuts reference modal

### Phase 2: Panels & Project Management

New panels and API endpoints for project introspection and management.

**Deliverables:**
- CLAUDE.md viewer/editor
- Project settings editor
- MCP Servers status panel
- Skills list panel
- Git status/log panel
- File explorer tree view
- Activity log panel
- Command palette (Ctrl+K)
- Prompt templates manager
- Settings panel (general, API key)
- Export chat as markdown
- System prompt override modal

### Phase 3: Advanced Tools

Complex features requiring significant new infrastructure.

**Deliverables:**
- Embedded terminal (xterm.js + node-pty)
- Usage dashboard with charts
- Hooks editor
- Snippets manager
- Keyboard shortcuts editor
- Proxy settings
- Export all sessions as zip
- Preview server configuration

---

## Migration Strategy

The migration from vanilla JS to React happens in Phase 1a. Approach:

1. **Scaffold** Vite + React + TS project in `public/app/`
2. **Create shared types** in `shared/types/` with path aliases
3. **Port state** - translate `state` object and `saveState`/`loadState` to Zustand store with session normalization
4. **Port socket.io** - translate event handlers to `useSocket` hook using shared payload types
5. **Port UI** - translate `renderTabContent`, `renderChat`, `renderWelcome` etc. to React components
6. **Port styles** - translate `styles.css` to Tailwind classes + minimal custom CSS
7. **Update server** - rename .js to .ts, add type annotations, update socket handlers to accept per-tab options
8. **Verify** - all existing functionality works identically
9. **Remove old files** - delete `public/app.js`, `public/styles.css`, `public/index.html`

The old vanilla files are only removed after full verification that the React app is feature-complete.
