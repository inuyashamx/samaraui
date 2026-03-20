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
  "terminal:data": (data: string) => void;
  "terminal:exit": (payload: { code: number }) => void;
}

export interface ClientToServerEvents {
  "agent:start": (payload: AgentStartPayload) => void;
  "agent:message": (payload: AgentStartPayload) => void;
  "agent:interrupt": (payload: { agentId: string }) => void;
  "preview:url-update": (payload: { url: string }) => void;
  "preview:current-url": (payload: { url: string }) => void;
  "terminal:start": () => void;
  "terminal:input": (data: string) => void;
  "terminal:resize": (payload: { cols: number; rows: number }) => void;
}
