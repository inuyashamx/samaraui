const BASE = "";

export async function checkDir(path: string): Promise<{ valid: boolean; path: string }> {
  const res = await fetch(`${BASE}/api/check-dir?path=${encodeURIComponent(path)}`);
  return res.json();
}

export async function getHome(): Promise<{
  home: string;
  suggestions: string[];
  projects: { name: string; path: string }[];
}> {
  const res = await fetch(`${BASE}/api/home`);
  return res.json();
}

export async function setCwd(cwd: string): Promise<void> {
  await fetch(`${BASE}/api/set-cwd`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cwd }),
  });
}

export async function setPreviewTarget(url: string): Promise<void> {
  await fetch(`${BASE}/api/set-preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
}

export async function fetchUsage() {
  const res = await fetch(`${BASE}/api/usage`);
  if (!res.ok) return null;
  return res.json();
}

export async function saveState(cwd: string, state: unknown): Promise<void> {
  await fetch(`${BASE}/api/state`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cwd, state }),
  });
}

export async function loadState(cwd: string) {
  try {
    const res = await fetch(`${BASE}/api/state?cwd=${encodeURIComponent(cwd)}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export function sendBeaconState(cwd: string, state: unknown): void {
  const payload = JSON.stringify({ cwd, state });
  navigator.sendBeacon("/api/state", new Blob([payload], { type: "application/json" }));
}
