import { query, createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
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

## Workflow

1. **CONTEXT** — Use GetPreviewURL/ScreenshotPreview to see the current state.
2. **ANALYZE** — Find the relevant code. Read it.
3. **IMPLEMENT** — Make changes with Edit/Write. Don't refresh during implementation.
4. **TEST** — RefreshPreview once after ALL edits, navigate to the page, ScreenshotPreview to verify.

## Important

- NEVER refresh during implementation. Only RefreshPreview ONCE at the end.
- Be concise.`;

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
      ],
    });
  }

  async runAgent(agentId: string, prompt: string, socket: Socket, resume: boolean = false): Promise<void> {
    const existing = this.agents.get(agentId);
    const sessionId = existing?.sessionId;

    const abortController = new AbortController();
    this.agents.set(agentId, {
      status: "running",
      sessionId,
      abortController,
    });

    const previewServer = this._createPreviewServer(socket, agentId);

    const options: any = {
      cwd: this.cwd,
      abortController,
      systemPrompt: {
        type: "preset",
        preset: "claude_code",
        append: SYSTEM_PROMPT,
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
