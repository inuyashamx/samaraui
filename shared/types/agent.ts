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
