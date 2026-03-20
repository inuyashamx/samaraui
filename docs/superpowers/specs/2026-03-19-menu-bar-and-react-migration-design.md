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
- **Tailwind CSS v4** - utility-first styling
- **Zustand** - state management
- **Socket.io-client** - real-time communication
- **xterm.js** - embedded terminal (Phase 3)

### Server Stack

- **Express 5** - HTTP server (unchanged)
- **TypeScript** via tsx runtime
- **Socket.io** - real-time communication (unchanged)
- **Playwright** - preview browser automation (unchanged)
- **@anthropic-ai/claude-agent-sdk** - agent queries (unchanged)

### Vite + Express Integration

**Development:**
- Vite dev server on port 5173 (HMR, fast refresh)
- Express on port 3000 (API, socket.io, preview proxy)
- Frontend fetches from `localhost:3000/api/*`, socket.io connects to `localhost:3000`

**Production:**
- `vite build` outputs to `public/app/dist/`
- Express serves `dist/` as static files at `/_app/`
- Single port deployment

**Scripts:**
```json
{
  "dev": "concurrently \"tsx server/index.ts\" \"cd public/app && vite\"",
  "build": "cd public/app && vite build",
  "start": "tsx server/index.ts"
}
```

---

## Project Structure

### Frontend

```
public/
  app/
    index.html
    vite.config.ts
    tsconfig.json
    tailwind.config.ts
    package.json
    src/
      main.tsx                    # Entry point
      App.tsx                     # Root: MenuBar + TabBar + TabContent
      index.css                   # Tailwind imports + custom CSS

      types/
        agent.ts                  # Tab, Message, AgentStatus, ToolCall
        settings.ts               # Settings, MCPServer, Skill, Hook
        socket.ts                 # Socket event payloads
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

### Server

```
server/
  index.ts                        # Express + socket.io setup
  agent-manager.ts                # Agent lifecycle + MCP server
  preview-browser.ts              # Playwright preview control
  types.ts                        # Shared server-side types
```

---

## Menu Bar Specification

### File

| Item | Shortcut | Behavior | Phase |
|------|----------|----------|-------|
| New Agent Tab | Ctrl+T | Creates new tab with default name | 1 |
| Close Tab | Ctrl+W | Closes active tab, interrupts if running | 1 |
| Open Project... | Ctrl+O | Opens directory picker modal | 1 |
| Recent Projects | submenu | Lists last 10 projects from localStorage | 1 |
| Export Chat... | - | Downloads active chat as .md file | 2 |
| Export All Sessions... | - | Downloads zip of all sessions | 3 |
| Quit | Ctrl+Q | Saves state, closes window | 1 |

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
  openPanel: PanelType | null
  layout: 'split' | 'chat' | 'preview'
  commandPaletteOpen: boolean
  setActiveMenu: (menu: string | null) => void
  setOpenPanel: (panel: PanelType | null) => void
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
  previewUrl: string | null
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
  toolName?: string
  toolInput?: unknown
  timestamp: number
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

### Phase 1: React Migration + Menu Bar (core)

Migrate existing vanilla JS to React/TS. All current functionality preserved. Menu bar with functional items for everything that already exists plus trivial additions.

**Deliverables:**
- Vite + React + Tailwind + TS project scaffold
- Server migrated to TypeScript
- All current features working in React (tabs, chat, preview, state persistence)
- Menu bar rendered with all 7 menus
- Phase 1 items functional, Phase 2/3 items show "Coming soon" tooltip
- Keyboard shortcuts for Phase 1 items
- Zustand store replacing global state object

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

The migration from vanilla JS to React happens in Phase 1. Approach:

1. **Scaffold** Vite + React + TS project in `public/app/`
2. **Port state** - translate `state` object and `saveState`/`loadState` to Zustand store
3. **Port socket.io** - translate event handlers to `useSocket` hook
4. **Port UI** - translate `renderTabContent`, `renderChat`, `renderWelcome` etc. to React components
5. **Port styles** - translate `styles.css` to Tailwind classes + minimal custom CSS
6. **Add menu bar** - new component, wire to existing actions + stubs
7. **Update server** - rename .js to .ts, add type annotations, add new endpoints
8. **Verify** - all existing functionality works identically
9. **Remove old files** - delete `public/app.js`, `public/styles.css`, `public/index.html`

The old vanilla files are only removed after full verification that the React app is feature-complete.
