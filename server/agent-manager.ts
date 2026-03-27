import { query, createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { Socket } from "socket.io";
import type PreviewBrowser from "./preview-browser.js";

const SYSTEM_PROMPT = `You have a live preview browser available via MCP tools.

## Preview Tools

- **SetPreviewURL** — Set the preview URL (e.g., "http://localhost:8081"). Use when the user asks to open a specific URL or dev server.
- **GetPreviewURL** — See what page the user is currently viewing.
- **NavigatePreview** — Navigate the preview to a route.
- **RefreshPreview** — Reload the preview after making code changes.
- **ScreenshotPreview** — Take a real screenshot of the preview for visual analysis.
- **InspectElement** — Query DOM elements by CSS selector.
- **GetPageContent** — Get innerHTML of an element or the page body.
- **ClickElement** — Click an element in the preview.
- **TypeInElement** — Type text into an input/textarea.
- **ScrollPreview** — Scroll the preview up or down.
- **GetConsoleLogs** — Get browser console output (logs, warnings, errors). Use to debug runtime issues.
- **GetNetworkLogs** — Get network requests/responses. Use to debug API calls and failed requests.

## Workflow

1. **CONTEXT** — Use GetPreviewURL/ScreenshotPreview to see the current state.
2. **ANALYZE** — Find the relevant code. Read it.
3. **IMPLEMENT** — Make changes with Edit/Write. Don't refresh during implementation.
4. **TEST** — RefreshPreview once after ALL edits, navigate to the page, ScreenshotPreview to verify.
5. **DEBUG** — If something looks wrong, use GetConsoleLogs to check for errors, GetNetworkLogs to check for failed API calls.

## Important

- NEVER refresh during implementation. Only RefreshPreview ONCE at the end.
- When debugging visual issues, ALWAYS check console logs and network requests before guessing at fixes.
- Be concise.`;

const POLYMER_PROMPT = `
## Polymer 1.x Reference — CRITICAL

This project uses **Polymer 1.x** (HTML Imports, NOT ES modules). You MUST follow these rules exactly.

### File Structure
- Components are \`.html\` files with \`<dom-module id="component-name">\`
- Imports use \`<link rel="import" href="...">\`, NEVER ES import/export
- Entry point is usually \`index.html\` or an app-shell element

### Element Definition
\`\`\`html
<dom-module id="my-element">
  <template>
    <style>/* :host, CSS here */</style>
    <!-- DOM here -->
  </template>
  <script>
    Polymer({
      is: 'my-element',
      properties: {
        name: { type: String, value: '', notify: true, observer: '_nameChanged' },
        items: { type: Array, value: function() { return []; } },
        count: { type: Number, computed: '_computeCount(items.length)' }
      },
      observers: [
        '_itemsChanged(items.splices)',
        '_nameAndAgeChanged(name, age)'
      ],
      listeners: { 'tap': '_onTap' },
      ready: function() { /* DOM is ready */ },
      attached: function() { /* in document */ },
      detached: function() { /* removed */ },
      _nameChanged: function(newVal, oldVal) {},
      _computeCount: function(len) { return len; }
    });
  </script>
</dom-module>
\`\`\`

### Data Binding — THE #1 SOURCE OF BUGS
- \`[[prop]]\` = one-way (host→child), \`{{prop}}\` = two-way
- Binding to **attribute**: \`attr$="[[val]]"\` (adds \`$\`), e.g. \`class$="[[cls]]"\`, \`href$="[[url]]"\`
- Binding to **property**: \`prop="[[val]]"\` (no \`$\`), e.g. \`value="{{input}}"\`
- \`class$="[[_computeClass(active)]]"\` — use computed for dynamic classes
- **NEVER** use template literals or JS expressions in bindings. Use computed functions:
  - WRONG: \`[[item.name + ' - ' + item.code]]\`
  - RIGHT: \`[[_formatLabel(item.name, item.code)]]\` with a method that returns the string

### Array/Object Mutation — THE #2 SOURCE OF BUGS
Polymer 1.x does NOT detect mutations via direct assignment. You MUST use:
- \`this.push('items', newItem)\` — NOT \`this.items.push(newItem)\`
- \`this.splice('items', index, 1)\` — NOT \`this.items.splice(index, 1)\`
- \`this.set('items.0.name', 'new')\` — NOT \`this.items[0].name = 'new'\`
- \`this.notifyPath('obj.nested.prop')\` — if you mutated and need to sync
- For full array replacement: \`this.set('items', newArray)\`

### Conditional & Repeat Templates
\`\`\`html
<template is="dom-repeat" items="[[list]]" as="item" index-as="idx">
  <span>[[item.name]]</span>
</template>

<template is="dom-if" if="[[showDetail]]">
  <detail-view data="[[selected]]"></detail-view>
</template>
\`\`\`
- \`dom-repeat\` default variable is \`item\`, override with \`as="thing"\`
- Access index with \`index\` (default) or \`index-as="i"\`
- \`dom-if\` elements are LAZY — they stamp async. Use \`restamp\` attribute if needed.

### Events & Listeners
- Use \`on-tap\` not \`on-click\` (tap handles mobile + desktop)
- \`on-*\` attributes: \`on-tap="_handleTap"\`, \`on-input="_onInput"\`
- Fire custom events: \`this.fire('my-event', { detail: data })\`
- Listen: \`listeners: { 'child-element.tap': '_onChildTap' }\`
- Get event model in dom-repeat: \`e.model.item\`, \`e.model.index\`

### Styling
- Use \`:host\` for the element itself, \`:host(.class)\` for conditional
- CSS custom properties: \`var(--my-color, fallback)\`
- Apply mixins: \`@apply --my-mixin;\`
- Style inside dom-module \`<template><style>\` only — no external CSS files
- Use \`::content\` (Polymer 1.x) for distributed children, NOT \`::slotted\`

### Common Polymer 1.x APIs
- \`this.$\` — static nodes by id: \`this.$.myInput\`
- \`this.$$('selector')\` — dynamic query (first match only)
- \`Polymer.dom(this.root)\` — scoped DOM manipulation
- \`Polymer.dom(node).querySelector()\` — query in local DOM
- \`this.toggleClass('active', bool, element)\`
- \`this.toggleAttribute('disabled', bool, element)\`
- \`this.async(fn, ms)\` — setTimeout with auto-binding
- \`this.debounce('name', fn, ms)\` — debounced calls
- \`this.importHref(url, onSuccess, onError, isAsync)\` — lazy import

### Behaviors (Polymer 1.x mixins)
\`\`\`js
Polymer({
  is: 'my-element',
  behaviors: [MyBehavior, Polymer.IronResizableBehavior],
});
\`\`\`

### NEVER DO (common mistakes with Polymer 1.x)
- NEVER use \`class={}\` or \`className\` — use \`class$="[[computed]]"\`
- NEVER use \`.innerHTML\` to update — use data binding
- NEVER use \`document.querySelector\` — use \`this.$$\` or \`Polymer.dom\`
- NEVER use \`addEventListener\` for declarative events — use \`on-*\` or \`listeners\`
- NEVER use arrow functions in Polymer({}) — \`this\` won't bind correctly
- NEVER use \`<slot>\` — use \`<content select="selector">\` (Polymer 1.x uses Shadow DOM v0)
- NEVER use \`connectedCallback/disconnectedCallback\` — use \`attached/detached\`
- NEVER use \`static get properties()\` — use \`properties: {}\` in Polymer({})
- NEVER use ES modules import/export — use HTML Imports
- NEVER directly set array/object properties — use Polymer mutation methods
`;


function detectPolymer(cwd: string): boolean {
  // Check common Polymer 1.x indicators
  const indicators = [
    join(cwd, "bower.json"),
    join(cwd, "bower_components"),
    join(cwd, "polymer.json"),
  ];
  for (const p of indicators) {
    if (existsSync(p)) return true;
  }
  // Check if index.html has HTML imports or Polymer references
  const indexPath = join(cwd, "index.html");
  if (existsSync(indexPath)) {
    try {
      const content = readFileSync(indexPath, "utf-8").slice(0, 5000);
      if (content.includes("webcomponentsjs") || content.includes("polymer.html") || content.includes("dom-module")) {
        return true;
      }
    } catch {}
  }
  return false;
}

interface AgentState {
  status: string;
  sessionId?: string;
  abortController?: AbortController;
}

class AgentManager {
  cwd: string;
  agents: Map<string, AgentState>;
  previewBrowser: PreviewBrowser | null;
  previewBaseUrl: string | null;

  constructor(cwd: string) {
    this.cwd = cwd;
    this.agents = new Map();
    this.previewBrowser = null;
    this.previewBaseUrl = null;
  }

  setPreviewBrowser(browser: PreviewBrowser): void {
    this.previewBrowser = browser;
  }

  setPreviewBaseUrl(url: string | null): void {
    this.previewBaseUrl = url;
  }

  _createPreviewServer(socket: Socket, agentId: string): any {
    const browser = this.previewBrowser;

    return createSdkMcpServer({
      name: "preview-tools",
      version: "1.0.0",
      tools: [
        tool(
          "GetPreviewURL",
          "Get the current URL/route showing in the preview. Use to understand what page the user is on.",
          {},
          async () => {
            if (!browser) return { content: [{ type: "text", text: "Preview browser not available." }] };
            const url = await browser.getUrl(agentId);
            return { content: [{ type: "text", text: `Current preview URL: ${url}` }] };
          }
        ),
        tool(
          "SetPreviewURL",
          "Set the preview URL to a dev server. Use when the user asks to open a specific localhost URL or when you detect a running server.",
          { url: z.string().describe("Full URL, e.g. 'http://localhost:8081'") },
          async ({ url }: { url: string }) => {
            let normalized = url.trim();
            if (!/^https?:\/\//.test(normalized)) normalized = `http://${normalized}`;
            // Configure the Express proxy
            socket.emit("preview:set-url", { agentId, url: normalized });
            return { content: [{ type: "text", text: `Preview URL set to ${normalized}. The preview panel will now show this URL.` }] };
          }
        ),
        tool(
          "NavigatePreview",
          "Navigate the preview to a specific route. Use to show the user which module you're working on.",
          { route: z.string().describe("Route to navigate to, e.g. '/' or '/modulo/clientes'") },
          async ({ route }: { route: string }) => {
            if (!browser) return { content: [{ type: "text", text: "Preview browser not available." }] };
            // Also emit socket event to update the address bar in UI
            socket.emit("preview:navigate", { agentId, route });
            await browser.navigate(agentId, route);
            return { content: [{ type: "text", text: `Preview navigated to ${route}` }] };
          }
        ),
        tool(
          "RefreshPreview",
          "Reload the preview to pick up code changes. Use after making edits.",
          {},
          async () => {
            if (!browser) return { content: [{ type: "text", text: "Preview browser not available." }] };
            socket.emit("preview:refresh", { agentId });
            await browser.refresh(agentId);
            return { content: [{ type: "text", text: "Preview refreshed" }] };
          }
        ),
        tool(
          "ScreenshotPreview",
          "Take a screenshot of the preview panel. Returns the image for visual analysis.",
          {},
          async () => {
            if (!browser) return { content: [{ type: "text", text: "Preview browser not available." }] };
            const data = await browser.screenshot(agentId);
            if (!data) {
              return { content: [{ type: "text", text: "Could not capture screenshot. Preview may not be loaded." }] };
            }
            return {
              content: [{
                type: "image",
                data,
                mimeType: "image/jpeg",
              }],
            };
          }
        ),
        tool(
          "InspectElement",
          "Query DOM elements in the preview by CSS selector. Returns info about matching elements (tag, classes, text, visibility).",
          { selector: z.string().describe("CSS selector, e.g. '.my-class', '#my-id', 'paper-button'") },
          async ({ selector }: { selector: string }) => {
            if (!browser) return { content: [{ type: "text", text: "Preview browser not available." }] };
            const result = await browser.inspect(agentId, selector);
            return { content: [{ type: "text", text: result }] };
          }
        ),
        tool(
          "GetPageContent",
          "Get the innerHTML of an element or the page body from the preview. Useful to check rendered DOM state.",
          { selector: z.string().optional().describe("CSS selector. Omit for full body.") },
          async ({ selector }: { selector?: string }) => {
            if (!browser) return { content: [{ type: "text", text: "Preview browser not available." }] };
            const html = await browser.getPageContent(agentId, selector);
            return { content: [{ type: "text", text: html }] };
          }
        ),
        tool(
          "ClickElement",
          "Click an element in the preview by CSS selector. Use to test interactions.",
          { selector: z.string().describe("CSS selector of element to click") },
          async ({ selector }: { selector: string }) => {
            if (!browser) return { content: [{ type: "text", text: "Preview browser not available." }] };
            const result = await browser.click(agentId, selector);
            return { content: [{ type: "text", text: result }] };
          }
        ),
        tool(
          "ScrollPreview",
          "Scroll the preview page up or down. Use to see content below or above the current viewport.",
          {
            direction: z.enum(["up", "down"]).describe("Scroll direction"),
            amount: z.number().optional().describe("Pixels to scroll (default 500)"),
          },
          async ({ direction, amount }: { direction: "up" | "down"; amount?: number }) => {
            if (!browser) return { content: [{ type: "text", text: "Preview browser not available." }] };
            const result = await browser.scroll(agentId, direction, amount);
            return { content: [{ type: "text", text: result }] };
          }
        ),
        tool(
          "TypeInElement",
          "Type text into an input or textarea in the preview.",
          {
            selector: z.string().describe("CSS selector of the input element"),
            text: z.string().describe("Text to type"),
          },
          async ({ selector, text }: { selector: string; text: string }) => {
            if (!browser) return { content: [{ type: "text", text: "Preview browser not available." }] };
            const result = await browser.type(agentId, selector, text);
            return { content: [{ type: "text", text: result }] };
          }
        ),
        tool(
          "GetConsoleLogs",
          "Get browser console logs from the preview. Returns log messages, warnings, and errors. Use to debug runtime issues after refreshing or interacting with the preview.",
          {
            level: z.enum(["log", "warning", "error", "info", "debug"]).optional().describe("Filter by log level. Omit for all levels."),
            clear: z.boolean().optional().describe("Clear logs after reading (default false)"),
          },
          async ({ level, clear }: { level?: string; clear?: boolean }) => {
            if (!browser) return { content: [{ type: "text", text: "Preview browser not available." }] };
            const logs = browser.getConsoleLogs(level, clear);
            if (logs.length === 0) return { content: [{ type: "text", text: "No console logs captured." }] };
            const formatted = logs.map((l) => {
              let line = `[${l.level.toUpperCase()}] ${l.text}`;
              if (l.url) line += ` (${l.url}:${l.line})`;
              return line;
            }).join("\n");
            return { content: [{ type: "text", text: formatted }] };
          }
        ),
        tool(
          "GetNetworkLogs",
          "Get network request logs from the preview. Shows method, URL, status, and timing. Use to debug API calls, failed requests, or slow responses.",
          {
            errorsOnly: z.boolean().optional().describe("Only show failed requests (status >= 400 or network errors)"),
            clear: z.boolean().optional().describe("Clear logs after reading (default false)"),
          },
          async ({ errorsOnly, clear }: { errorsOnly?: boolean; clear?: boolean }) => {
            if (!browser) return { content: [{ type: "text", text: "Preview browser not available." }] };
            const logs = browser.getNetworkLogs({ errorsOnly, clear });
            if (logs.length === 0) return { content: [{ type: "text", text: errorsOnly ? "No failed network requests." : "No network requests captured." }] };
            const formatted = logs.map((l) => {
              const status = l.error ? `FAILED (${l.error})` : String(l.status);
              const dur = l.duration ? `${l.duration}ms` : "—";
              return `${l.method} ${status} ${dur} ${l.url}`;
            }).join("\n");
            return { content: [{ type: "text", text: formatted }] };
          }
        ),
      ],
    });
  }

  async runAgent(agentId: string, prompt: string, socket: Socket, resume: boolean = false, clientSessionId?: string, model?: string): Promise<void> {
    const existing = this.agents.get(agentId);
    const sessionId = existing?.sessionId || clientSessionId || null;

    const abortController = new AbortController();
    this.agents.set(agentId, {
      status: "running",
      sessionId,
      abortController,
    });

    const previewServer = this._createPreviewServer(socket, agentId);

    const isPolymer = detectPolymer(this.cwd);
    const systemAppend = isPolymer ? SYSTEM_PROMPT + POLYMER_PROMPT : SYSTEM_PROMPT;
    if (isPolymer) console.log(`  Polymer 1.x detected in ${this.cwd}`);

    const options: any = {
      cwd: this.cwd,
      abortController,
      systemPrompt: {
        type: "preset",
        preset: "claude_code",
        append: systemAppend,
      },
      settingSources: ["project", "user", "local"],
      allowedTools: [
        "Read", "Write", "Edit", "Bash", "Glob", "Grep",
        "WebSearch", "WebFetch", "Agent"
      ],
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      mcpServers: {
        "preview-tools": previewServer,
      },
      ...(model ? { model } : {}),
    };

    if (resume && sessionId) {
      options.resume = sessionId;
    }

    try {
      for await (const message of query({ prompt, options })) {
        switch ((message as any).type) {
          case "system": {
            if ((message as any).subtype === "init") {
              this.agents.set(agentId, {
                ...this.agents.get(agentId),
                sessionId: (message as any).session_id,
              });
              socket.emit("agent:init", {
                agentId,
                sessionId: (message as any).session_id,
                model: (message as any).model,
                tools: (message as any).tools,
              });
            }
            break;
          }

          case "assistant": {
            const content = (message as any).message?.content || [];
            for (const block of content) {
              if (block.type === "text") {
                socket.emit("agent:text", { agentId, text: block.text });
              }
              if (block.type === "tool_use") {
                socket.emit("agent:tool_use", {
                  agentId,
                  toolUseId: block.id,
                  tool: block.name,
                  input: block.input,
                });
              }
            }
            break;
          }

          case "user": {
            if ((message as any).tool_use_result !== undefined) {
              const result = (message as any).tool_use_result;
              const text = typeof result === "string"
                ? result
                : JSON.stringify(result, null, 2);
              const summary = text.length > 2000
                ? text.slice(0, 2000) + "\n... (truncated)"
                : text;

              socket.emit("agent:tool_result", {
                agentId,
                content: summary,
              });
            }
            break;
          }

          case "tool_progress": {
            socket.emit("agent:tool_progress", {
              agentId,
              toolUseId: (message as any).tool_use_id,
              tool: (message as any).tool_name,
              elapsed: (message as any).elapsed_time_seconds,
            });
            break;
          }

          case "result": {
            const isSuccess = (message as any).subtype === "success";
            socket.emit("agent:result", {
              agentId,
              result: isSuccess ? (message as any).result : null,
              errors: isSuccess ? null : (message as any).errors,
              subtype: (message as any).subtype,
              cost: (message as any).total_cost_usd,
              turns: (message as any).num_turns,
              duration: (message as any).duration_ms,
              sessionId: (message as any).session_id,
            });
            this.agents.set(agentId, {
              ...this.agents.get(agentId),
              status: isSuccess ? "idle" : "error",
              sessionId: (message as any).session_id,
            });
            break;
          }
        }
      }
    } catch (err: any) {
      socket.emit("agent:error", { agentId, error: err.message });
      this.agents.set(agentId, {
        ...this.agents.get(agentId),
        status: "error",
      });
    }
  }

  interrupt(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent?.abortController) {
      agent.abortController.abort();
    }
  }

  getStatus(agentId: string): AgentState {
    return this.agents.get(agentId) || { status: "none" };
  }
}

export default AgentManager;
