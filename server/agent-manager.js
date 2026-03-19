import { query, createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

const SYSTEM_PROMPT = `You are a developer assistant working on a Polymer web application. You have a live preview browser that shows the running app, and powerful tools to control and inspect it.

## Preview Tools

- **GetPreviewURL** — See what page the user is currently viewing.
- **NavigatePreview** — Navigate the preview to a route (e.g., "/modulo/clientes").
- **RefreshPreview** — Reload the preview after making code changes.
- **ScreenshotPreview** — Take a real screenshot of the preview. Returns an image you can analyze.
- **InspectElement** — Query DOM elements by CSS selector. Returns tag, classes, text, visibility.
- **GetPageContent** — Get innerHTML of an element or the full page body.
- **ClickElement** — Click an element in the preview by CSS selector.
- **TypeInElement** — Type text into an input/textarea by CSS selector.

## Workflow

When the user asks you to fix, change, or add something:

1. **CONTEXT** — Use GetPreviewURL to see where the user is. Use ScreenshotPreview if you need to see the visual state.
2. **ANALYZE** — Find the relevant module/component in the code. Read it.
3. **NAVIGATE** — Use NavigatePreview to go to the relevant page so the user sees you found it.
4. **CLARIFY** — If ambiguous, ask. For complex changes, propose a numbered plan and wait.
5. **IMPLEMENT** — Make changes with Edit/Write. Don't refresh during implementation.
6. **TEST** — RefreshPreview, NavigatePreview to the page, ScreenshotPreview to verify. Tell the user what changed and ask them to verify.

## Important

- ALWAYS check context first — the user might be on a different page than what they're asking about.
- Navigate BEFORE starting changes.
- NEVER refresh the preview during implementation. Only use RefreshPreview ONCE at the very end after ALL edits are complete.
- After ALL changes are done, RefreshPreview once, navigate to the affected page, and tell the user to verify.
- Be concise.`;

class AgentManager {
  constructor(cwd) {
    this.cwd = cwd;
    this.agents = new Map();
    this.previewBrowser = null;
  }

  setPreviewBrowser(browser) {
    this.previewBrowser = browser;
  }

  setPreviewBaseUrl(url) {
    this.previewBaseUrl = url;
  }

  _createPreviewServer(socket, agentId) {
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
          "NavigatePreview",
          "Navigate the preview to a specific route. Use to show the user which module you're working on.",
          { route: z.string().describe("Route to navigate to, e.g. '/' or '/modulo/clientes'") },
          async ({ route }) => {
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
                mimeType: "image/png",
              }],
            };
          }
        ),
        tool(
          "InspectElement",
          "Query DOM elements in the preview by CSS selector. Returns info about matching elements (tag, classes, text, visibility).",
          { selector: z.string().describe("CSS selector, e.g. '.my-class', '#my-id', 'paper-button'") },
          async ({ selector }) => {
            if (!browser) return { content: [{ type: "text", text: "Preview browser not available." }] };
            const result = await browser.inspect(agentId, selector);
            return { content: [{ type: "text", text: result }] };
          }
        ),
        tool(
          "GetPageContent",
          "Get the innerHTML of an element or the page body from the preview. Useful to check rendered DOM state.",
          { selector: z.string().optional().describe("CSS selector. Omit for full body.") },
          async ({ selector }) => {
            if (!browser) return { content: [{ type: "text", text: "Preview browser not available." }] };
            const html = await browser.getPageContent(agentId, selector);
            return { content: [{ type: "text", text: html }] };
          }
        ),
        tool(
          "ClickElement",
          "Click an element in the preview by CSS selector. Use to test interactions.",
          { selector: z.string().describe("CSS selector of element to click") },
          async ({ selector }) => {
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
          async ({ selector, text }) => {
            if (!browser) return { content: [{ type: "text", text: "Preview browser not available." }] };
            const result = await browser.type(agentId, selector, text);
            return { content: [{ type: "text", text: result }] };
          }
        ),
      ],
    });
  }

  async runAgent(agentId, prompt, socket, resume = false) {
    const existing = this.agents.get(agentId);
    const sessionId = existing?.sessionId;

    const abortController = new AbortController();
    this.agents.set(agentId, {
      status: "running",
      sessionId,
      abortController,
    });

    const previewServer = this._createPreviewServer(socket, agentId);

    const options = {
      cwd: this.cwd,
      abortController,
      systemPrompt: {
        type: "preset",
        preset: "claude_code",
        append: SYSTEM_PROMPT,
      },
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
        switch (message.type) {
          case "system": {
            if (message.subtype === "init") {
              this.agents.set(agentId, {
                ...this.agents.get(agentId),
                sessionId: message.session_id,
              });
              socket.emit("agent:init", {
                agentId,
                sessionId: message.session_id,
                model: message.model,
                tools: message.tools,
              });
            }
            break;
          }

          case "assistant": {
            const content = message.message?.content || [];
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
            if (message.tool_use_result !== undefined) {
              const result = message.tool_use_result;
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
              toolUseId: message.tool_use_id,
              tool: message.tool_name,
              elapsed: message.elapsed_time_seconds,
            });
            break;
          }

          case "result": {
            const isSuccess = message.subtype === "success";
            socket.emit("agent:result", {
              agentId,
              result: isSuccess ? message.result : null,
              errors: isSuccess ? null : message.errors,
              subtype: message.subtype,
              cost: message.total_cost_usd,
              turns: message.num_turns,
              duration: message.duration_ms,
              sessionId: message.session_id,
            });
            this.agents.set(agentId, {
              ...this.agents.get(agentId),
              status: isSuccess ? "idle" : "error",
              sessionId: message.session_id,
            });
            break;
          }
        }
      }
    } catch (err) {
      socket.emit("agent:error", { agentId, error: err.message });
      this.agents.set(agentId, {
        ...this.agents.get(agentId),
        status: "error",
      });
    }
  }

  interrupt(agentId) {
    const agent = this.agents.get(agentId);
    if (agent?.abortController) {
      agent.abortController.abort();
    }
  }

  getStatus(agentId) {
    return this.agents.get(agentId) || { status: "none" };
  }
}

export default AgentManager;
