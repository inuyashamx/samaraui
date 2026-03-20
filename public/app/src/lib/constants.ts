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
