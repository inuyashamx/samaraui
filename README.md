<p align="center">
  <img src="docs/assets/logo.png" alt="SamaraUI" width="120" />
</p>

<h1 align="center">SamaraUI</h1>

<p align="center">
  <strong>A web-based UI for Claude Code agents with live preview</strong>
</p>

<p align="center">
  Chat with AI agents, watch them edit code, and see the results in a real-time browser preview — all in one window.
</p>

<p align="center">
  <a href="#installation">Installation</a> &bull;
  <a href="#features">Features</a> &bull;
  <a href="#usage">Usage</a> &bull;
  <a href="#architecture">Architecture</a> &bull;
  <a href="#contributing">Contributing</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.2.0-blue" alt="Version" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License" />
  <img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen" alt="Node" />
</p>

---

## What is SamaraUI?

SamaraUI gives Claude Code a visual interface. Instead of a terminal, you get a desktop-like workspace with chat panels, a live browser preview, and a full set of development tools — all powered by the [Claude Agent SDK](https://docs.anthropic.com/en/docs/claude-code/sdk).

You type a prompt, an agent writes the code, and you see the result update live in the preview panel. No copy-pasting, no manual refreshes.

<!-- Add screenshot here -->
<!-- ![SamaraUI](docs/assets/screenshot.png) -->

---

## Features

**Multi-agent workspace**
- Open multiple agent tabs, each with its own conversation and session
- Resume previous sessions across restarts
- Switch models per tab (Opus, Sonnet, Haiku)

**Live browser preview**
- Embedded Chromium preview powered by Playwright
- Agents can navigate, click, type, scroll, and screenshot the preview
- Address bar with manual navigation and refresh
- Element picker for inspecting the DOM

**Agent tools**
- Agents have access to Read, Write, Edit, Bash, Glob, Grep, WebSearch, WebFetch, and Agent (sub-agents)
- Custom MCP tools: `ScreenshotPreview`, `InspectElement`, `GetConsoleLogs`, `GetNetworkLogs`, `ClickElement`, `TypeInElement`, `ScrollPreview`, and more
- Image attachments — paste or attach images for visual context

**Development panels**
- **File Explorer** — browse project files
- **Git** — view status, diffs, and history
- **Terminal** — integrated xterm.js terminal
- **CLAUDE.md Editor** — edit project instructions inline
- **Claude Settings** — manage `settings.json` and `settings.local.json`
- **MCP Servers** — view configured MCP servers
- **Skills** — browse available skills
- **Usage Dashboard** — monitor API usage and costs
- **Activity Log** — real-time event stream from agents

**Keyboard shortcuts**
- `Ctrl+N` new tab, `Ctrl+W` close tab, `Ctrl+Tab` / `Ctrl+Shift+Tab` switch tabs
- `Ctrl+1/2/3` switch layout (split / chat / preview)
- Full menu bar with keyboard navigation

---

## Installation

### Prerequisites

- **Node.js** >= 18
- **Claude Code** authenticated (`claude` CLI must be logged in — SamaraUI uses your existing OAuth credentials)

### Install from npm

```bash
npm install -g samaraui
```

### Or install from source

```bash
git clone https://github.com/InuYashaMX/samara.git
cd samara
npm install && cd public/app && npm install && cd ../..
npm run build
npm link
```

### Verify

```bash
samaraui --version
```

---

## Usage

Open SamaraUI in any project directory:

```bash
cd your-project
samaraui
```

A browser window opens automatically with the full workspace. That's it.

```bash
# Open in a specific project
samaraui ~/projects/my-app

# Custom port
samaraui --port 8080

# Don't open browser automatically
samaraui --no-open
```

### CLI reference

```
Usage: samaraui [options] [directory]

Arguments:
  directory                Working directory for agents (default: current directory)

Options:
  -p, --port <port>        Port to run on (default: 4827)
  --no-open                Don't open browser automatically
  -V, --version            Output version number
  -h, --help               Display help
```

### Workflow

1. Run `samaraui` in your project
2. Type a prompt in the chat panel (e.g., "Add a login page with email and password")
3. The agent reads your code, makes changes, and refreshes the preview
4. You see the result live in the preview panel
5. Continue the conversation to iterate

### Live preview

The preview panel proxies your local dev server. When an agent detects a running server (e.g., `localhost:8081`), it automatically configures the preview. You can also set it manually via the address bar.

### Framework-specific instructions

SamaraUI works with any web project. For framework-specific instructions, add them to your project's `CLAUDE.md` file — agents read it automatically via the Claude Code SDK.

---

## Architecture

```
samaraui/
├── bin/                    # CLI entry point
│   ├── cli.js              # Node wrapper with tsx loader
│   └── _cli.ts             # Commander.js CLI definition
├── server/
│   ├── index.ts            # Express + Socket.io server, proxy, API routes
│   ├── agent-manager.ts    # Claude Agent SDK integration, MCP tools
│   └── preview-browser.ts  # Playwright browser management, CDP integration
├── shared/
│   └── types/              # Shared TypeScript types (agent, socket events)
├── public/app/             # React frontend (Vite + Tailwind)
│   └── src/
│       ├── components/     # UI components (Chat, Preview, Panels, MenuBar, TabBar)
│       ├── hooks/          # useSocket, useKeyboard, useAutoSave
│       ├── store/          # Zustand store (tabs, messages, layout)
│       └── lib/            # API client, socket client, constants
└── package.json
```

### How it works

1. **CLI** starts an Express server and launches a Playwright browser
2. **Server** manages agent sessions via the Claude Agent SDK, each tab = one agent conversation
3. **Socket.io** streams agent events (text, tool use, results) to the frontend in real time
4. **Preview proxy** forwards requests to your local dev server through Express, so the preview iframe avoids CORS issues
5. **Playwright** provides headless browser capabilities — agents can screenshot, inspect, click, and read console/network logs from your app
6. **Frontend** renders the workspace with React, Zustand for state, and Tailwind for styling

### Tech stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js + tsx |
| AI | Claude Agent SDK |
| Server | Express 5 + Socket.io |
| Browser | Playwright (Chromium) |
| Frontend | React 19 + Vite 6 + Tailwind 4 |
| State | Zustand |
| Terminal | xterm.js |
| CLI | Commander.js |

---

## Configuration

SamaraUI respects your existing Claude Code configuration:

- **`CLAUDE.md`** — project instructions (read by agents automatically)
- **`.claude/settings.json`** — project settings
- **`~/.claude/settings.json`** — user settings
- **OAuth credentials** — from `~/.claude/.credentials.json` (set up via `claude` CLI)

Agent sessions are persisted in `~/.samaraui/sessions/` and restored on restart.

---

## Development

If you want to contribute or hack on SamaraUI:

```bash
git clone https://github.com/InuYashaMX/samara.git
cd samara
npm install && cd public/app && npm install && cd ../..
npm run dev
```

This starts the Express server and Vite dev server concurrently with hot reload.

- Frontend: `http://localhost:5173` (HMR)
- Server: `http://localhost:3000`

Contributions are welcome. Please open an issue first to discuss what you'd like to change.

---

## License

[MIT](LICENSE)
