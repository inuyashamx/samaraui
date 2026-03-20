import { query, createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { readdirSync, readFileSync, existsSync } from "fs";
import { join, basename } from "path";

const SYSTEM_PROMPT = `You are a developer assistant. You have a live preview browser and project skills available.

## Preview Tools

- **GetPreviewURL** — See what page the user is currently viewing.
- **NavigatePreview** — Navigate the preview to a route.
- **RefreshPreview** — Reload the preview after making code changes.
- **ScreenshotPreview** — Take a real screenshot of the preview for visual analysis.
- **InspectElement** — Query DOM elements by CSS selector.
- **GetPageContent** — Get innerHTML of an element or the page body.
- **ClickElement** — Click an element in the preview.
- **TypeInElement** — Type text into an input/textarea.

## Skills

- **ListSkills** — List available project skills (context documents with patterns, API docs, schemas, etc.)
- **LoadSkill** — Load a skill by name to get its full content. ALWAYS load relevant skills before working on unfamiliar code.

## Workflow

1. **CONTEXT** — Use ListSkills to see what knowledge is available. Load relevant skills. Use GetPreviewURL/ScreenshotPreview to see the current state.
2. **ANALYZE** — Find the relevant code. Read it.
3. **IMPLEMENT** — Make changes with Edit/Write. Don't refresh during implementation.
4. **TEST** — RefreshPreview once after ALL edits, navigate to the page, ScreenshotPreview to verify.

## Important

- Load skills before working on unfamiliar patterns or APIs.
- NEVER refresh during implementation. Only RefreshPreview ONCE at the end.
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
        tool(
          "ListSkills",
          "List available project skills. Skills contain patterns, API docs, schemas, and other context. Always check this first when working on unfamiliar code.",
          {},
          async () => {
            const skills = this._findSkills();
            if (skills.length === 0) {
              return { content: [{ type: "text", text: "No skills found in this project." }] };
            }
            const list = skills.map((s) => `- **${s.name}**: ${s.path}`).join("\n");
            return { content: [{ type: "text", text: `Available skills:\n${list}\n\nUse LoadSkill to read any of these.` }] };
          }
        ),
        tool(
          "LoadSkill",
          "Load a project skill by name. Returns the full skill content with patterns, API docs, schemas, etc.",
          { name: z.string().describe("Skill name, e.g. 'sacs-backend-api', 'sacs-polymer-patterns'") },
          async ({ name }) => {
            const skills = this._findSkills();
            const skill = skills.find((s) => s.name === name || s.name.includes(name));
            if (!skill) {
              const available = skills.map((s) => s.name).join(", ");
              return { content: [{ type: "text", text: `Skill "${name}" not found. Available: ${available || "none"}` }] };
            }
            try {
              const content = readFileSync(skill.path, "utf8");
              return { content: [{ type: "text", text: content }] };
            } catch (err) {
              return { content: [{ type: "text", text: `Error reading skill: ${err.message}` }] };
            }
          }
        ),
      ],
    });
  }

  _findSkills() {
    const skills = [];
    // Check .claude/skills/ in the working directory
    const skillsDir = join(this.cwd, ".claude", "skills");
    if (existsSync(skillsDir)) {
      try {
        for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
          if (entry.isDirectory()) {
            const skillFile = join(skillsDir, entry.name, "SKILL.md");
            if (existsSync(skillFile)) {
              skills.push({ name: entry.name, path: skillFile });
            }
          }
        }
      } catch {}
    }
    return skills;
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
