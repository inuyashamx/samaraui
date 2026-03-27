export interface Settings {
  theme: "dark" | "light";
  fontSize: number;
  defaultModel: string;
  defaultPermissionMode: string;
  apiKey: string | null;
  proxyUrl: string | null;
  previewPort: number | null;
  shortcuts: Record<string, string>;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "dark",
  fontSize: 13,
  defaultModel: "claude-opus-4-6-20250624",
  defaultPermissionMode: "bypassPermissions",
  apiKey: null,
  proxyUrl: null,
  previewPort: null,
  shortcuts: {},
};

export interface UsageData {
  five_hour: UsageEntry;
  seven_day: UsageEntry;
}

export interface UsageEntry {
  label: string;
  utilization: number;
  resets_at: string;
}
