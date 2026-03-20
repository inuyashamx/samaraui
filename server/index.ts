import express, { Request, Response, NextFunction } from "express";
import { createServer } from "http";
import http from "http";
import https from "https";
import { Server, Socket } from "socket.io";
import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "fs";
import { createHash } from "crypto";
import { homedir } from "os";
import AgentManager from "./agent-manager.js";
import PreviewBrowser from "./preview-browser.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function startServer({ port, cwd }: { port: number; cwd: string }): Promise<{ server: any; launchBrowser: (url: string) => Promise<void> }> {
  const app = express();
  const server = createServer(app);
  const io = new Server(server, { cors: { origin: "*" } });

  const resolvedCwd = resolve(cwd);
  let agentManager: AgentManager | null = new AgentManager(resolvedCwd);
  let currentCwd = resolvedCwd;
  let previewTarget: string | null = null;
  const previewBrowser = new PreviewBrowser();
  agentManager.setPreviewBrowser(previewBrowser);

  app.use(express.json({ limit: "50mb" }));

  // ── UI static files under /_app/ ──
  const distPath = join(__dirname, "..", "public", "app", "dist");
  if (existsSync(distPath)) {
    app.use("/_app", express.static(distPath));
    // SPA fallback: any /_app/* that isn't a static asset serves index.html
    app.get("/_app/{*path}", (req: Request, res: Response) => {
      res.sendFile(join(distPath, "index.html"));
    });
  } else {
    // Fallback to old public/ for development without build
    app.use("/_app", express.static(join(__dirname, "..", "public")));
  }

  // Root: serve UI only if no preview target is active
  app.get("/", (req: Request, res: Response, next: NextFunction) => {
    if (previewTarget) return next(); // let proxy handle it
    const distIndex = join(__dirname, "..", "public", "app", "dist", "index.html");
    if (existsSync(distIndex)) {
      res.sendFile(distIndex);
    } else {
      res.sendFile(join(__dirname, "..", "public", "index.html"));
    }
  });

  // ── API routes ──
  app.get("/api/init", (req: Request, res: Response) => {
    res.json({ cwd: currentCwd });
  });

  app.get("/api/check-dir", (req: Request, res: Response) => {
    const dir = req.query.path as string;
    if (!dir) return res.json({ valid: false });
    try {
      const resolved = resolve(dir);
      const s = statSync(resolved);
      res.json({ valid: s.isDirectory(), path: resolved });
    } catch {
      res.json({ valid: false });
    }
  });

  app.get("/api/home", (req: Request, res: Response) => {
    const home = homedir();
    const desktop = join(home, "Desktop");
    const onedrive = join(home, "OneDrive", "Escritorio");
    const docs = join(home, "Documents");
    const suggestions: string[] = [];
    for (const p of [home, desktop, onedrive, docs]) {
      try { if (statSync(p).isDirectory()) suggestions.push(p); } catch {}
    }
    const projectDirs: { name: string; path: string }[] = [];
    for (const base of [desktop, onedrive, join(onedrive, "Projects")]) {
      try {
        const entries = readdirSync(base, { withFileTypes: true });
        for (const e of entries) {
          if (e.isDirectory() && !e.name.startsWith(".")) {
            projectDirs.push({ name: e.name, path: join(base, e.name) });
          }
        }
      } catch {}
    }
    res.json({ home, suggestions, projects: projectDirs });
  });

  app.post("/api/set-preview", (req: Request, res: Response) => {
    let url = (req.body.url || "").trim() as string;
    if (url && !/^https?:\/\//.test(url)) {
      url = "http://" + url;
    }
    previewTarget = url || null;
    if (agentManager) agentManager.setPreviewBaseUrl(previewTarget);
    console.log(`  Preview target set: ${previewTarget}`);
    res.json({ ok: true, url: previewTarget });
  });

  // ── Usage endpoint ──
  let usageCache: { data: any; fetchedAt: number } = { data: null, fetchedAt: 0 };

  app.get("/api/usage", async (req: Request, res: Response) => {
    // Return cache if less than 30s old
    if (usageCache.data && Date.now() - usageCache.fetchedAt < 30000) {
      return res.json(usageCache.data);
    }

    try {
      const credsPath = join(homedir(), ".claude", ".credentials.json");
      const creds = JSON.parse(readFileSync(credsPath, "utf8"));
      const token = creds?.claudeAiOauth?.accessToken;
      if (!token) return res.json({ error: "No OAuth token found" });

      const response = await fetch("https://api.anthropic.com/api/oauth/usage", {
        headers: {
          "Authorization": `Bearer ${token}`,
          "anthropic-beta": "oauth-2025-04-20",
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        return res.json({ error: `API returned ${response.status}` });
      }

      const data = await response.json();
      usageCache = { data, fetchedAt: Date.now() };
      res.json(data);
    } catch (err: any) {
      res.json({ error: err.message });
    }
  });

  // ── State persistence ──
  const stateDir = join(homedir(), ".samara-ui", "sessions");

  function stateFile(dir: string): string {
    const hash = createHash("md5").update(dir).digest("hex").slice(0, 12);
    return join(stateDir, `${hash}.json`);
  }

  app.get("/api/state", (req: Request, res: Response) => {
    const dir = req.query.cwd as string;
    if (!dir) return res.json({ error: "cwd required" });
    try {
      const path = stateFile(dir);
      if (!existsSync(path)) return res.json(null);
      const data = JSON.parse(readFileSync(path, "utf8"));
      res.json(data);
    } catch {
      res.json(null);
    }
  });

  app.post("/api/state", (req: Request, res: Response) => {
    const { cwd: dir, state } = req.body;
    if (!dir || !state) return res.status(400).json({ error: "cwd and state required" });
    try {
      mkdirSync(stateDir, { recursive: true });
      writeFileSync(stateFile(dir), JSON.stringify(state, null, 2));
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/set-cwd", (req: Request, res: Response) => {
    const { cwd: newCwd } = req.body;
    if (!newCwd) return res.status(400).json({ error: "cwd required" });
    const resolved = resolve(newCwd);
    currentCwd = resolved;
    agentManager = new AgentManager(resolved);
    agentManager.setPreviewBrowser(previewBrowser);
    console.log(`  Working directory set: ${resolved}`);
    res.json({ cwd: resolved });
  });

  // ── Open external tools ──
  app.post("/api/open-external", async (req: Request, res: Response) => {
    const { type, cwd: dir } = req.body;
    const targetDir = dir || currentCwd;
    try {
      if (type === "terminal") {
        const { exec } = await import("child_process");
        if (process.platform === "win32") exec(`start cmd /K "cd /d ${targetDir}"`);
        else if (process.platform === "darwin") exec(`open -a Terminal "${targetDir}"`);
        else exec(`x-terminal-emulator --working-directory="${targetDir}" || xterm -e "cd ${targetDir} && bash"`);
      } else if (type === "vscode") {
        const { exec } = await import("child_process");
        exec(`code "${targetDir}"`);
      }
      res.json({ ok: true });
    } catch (err: any) {
      res.json({ error: err.message });
    }
  });

  // ── Phase 2 API endpoints ──

  app.get("/api/claude-md", (req: Request, res: Response) => {
    const paths = [
      join(currentCwd, "CLAUDE.md"),
      join(currentCwd, ".claude", "CLAUDE.md"),
    ];
    for (const p of paths) {
      if (existsSync(p)) {
        return res.json({ content: readFileSync(p, "utf8"), path: p });
      }
    }
    res.json({ content: null, path: null });
  });

  app.put("/api/claude-md", (req: Request, res: Response) => {
    const { content, path: filePath } = req.body;
    const target = filePath || join(currentCwd, "CLAUDE.md");
    try {
      writeFileSync(target, content, "utf8");
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/git/status", async (req: Request, res: Response) => {
    try {
      const { execSync } = await import("child_process");
      const output = execSync("git status --short", { cwd: currentCwd, encoding: "utf8", timeout: 5000 });
      const branch = execSync("git branch --show-current", { cwd: currentCwd, encoding: "utf8", timeout: 5000 }).trim();
      res.json({ branch, status: output });
    } catch (err: any) {
      res.json({ error: err.message });
    }
  });

  app.get("/api/git/log", async (req: Request, res: Response) => {
    try {
      const { execSync } = await import("child_process");
      const output = execSync('git log --oneline -20 --format="%h|%s|%cr|%an"', { cwd: currentCwd, encoding: "utf8", timeout: 5000 });
      const commits = output.trim().split("\n").filter(Boolean).map((line: string) => {
        const [hash, message, date, author] = line.split("|");
        return { hash, message, date, author };
      });
      res.json({ commits });
    } catch (err: any) {
      res.json({ error: err.message, commits: [] });
    }
  });

  app.get("/api/files", (req: Request, res: Response) => {
    const dir = (req.query.path as string) || currentCwd;
    try {
      const resolved = resolve(dir);
      // Security: must be within currentCwd
      if (!resolved.startsWith(currentCwd)) {
        return res.status(403).json({ error: "Access denied" });
      }
      const entries = readdirSync(resolved, { withFileTypes: true })
        .filter((e: any) => !e.name.startsWith(".") && e.name !== "node_modules")
        .map((e: any) => ({
          name: e.name,
          path: join(resolved, e.name),
          isDirectory: e.isDirectory(),
        }))
        .sort((a: any, b: any) => {
          if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
      res.json({ entries, path: resolved });
    } catch (err: any) {
      res.json({ error: err.message, entries: [] });
    }
  });

  app.get("/api/file", (req: Request, res: Response) => {
    const filePath = req.query.path as string;
    if (!filePath) return res.status(400).json({ error: "path required" });
    const resolved = resolve(filePath);
    if (!resolved.startsWith(currentCwd)) {
      return res.status(403).json({ error: "Access denied" });
    }
    try {
      const content = readFileSync(resolved, "utf8");
      res.json({ content, path: resolved });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/mcp-servers", (req: Request, res: Response) => {
    const mcpPath = join(currentCwd, ".mcp.json");
    try {
      if (!existsSync(mcpPath)) return res.json({ servers: [] });
      const data = JSON.parse(readFileSync(mcpPath, "utf8"));
      const servers = Object.entries(data.mcpServers || {}).map(([name, config]: [string, any]) => ({
        name,
        type: config.type || "stdio",
        command: config.command,
        args: config.args,
      }));
      res.json({ servers });
    } catch (err: any) {
      res.json({ error: err.message, servers: [] });
    }
  });

  app.get("/api/skills", (req: Request, res: Response) => {
    const skillsDir = join(currentCwd, ".claude", "skills");
    try {
      if (!existsSync(skillsDir)) return res.json({ skills: [] });
      const entries = readdirSync(skillsDir, { withFileTypes: true });
      const skills = entries
        .filter((e: any) => e.isDirectory())
        .map((e: any) => {
          const skillFile = join(skillsDir, e.name, "SKILL.md");
          return {
            name: e.name,
            hasSkillFile: existsSync(skillFile),
          };
        });
      res.json({ skills });
    } catch (err: any) {
      res.json({ error: err.message, skills: [] });
    }
  });

  app.get("/api/project-info", async (req: Request, res: Response) => {
    const info: any = { name: currentCwd.split(/[/\\]/).pop(), cwd: currentCwd };
    // Check for readme
    for (const name of ["README.md", "readme.md", "README"]) {
      const p = join(currentCwd, name);
      if (existsSync(p)) { info.readme = readFileSync(p, "utf8"); break; }
    }
    // Git info
    try {
      const { execSync } = await import("child_process");
      info.branch = execSync("git branch --show-current", { cwd: currentCwd, encoding: "utf8", timeout: 3000 }).trim();
      info.remote = execSync("git remote get-url origin", { cwd: currentCwd, encoding: "utf8", timeout: 3000 }).trim();
    } catch {}
    res.json(info);
  });

  // ── Reverse proxy: everything not /_app/ or /api/ goes to preview target ──
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Skip if no preview target or if it's a socket.io/api/_app request
    if (!previewTarget || req.path.startsWith("/_app") || req.path.startsWith("/api") || req.path.startsWith("/socket.io")) {
      return next();
    }

    const targetUrl = previewTarget + req.url;
    let url: URL;
    try {
      url = new URL(targetUrl);
    } catch {
      return next();
    }
    const getter = url.protocol === "https:" ? https : http;

    const proxyReq = getter.request(targetUrl, {
      method: req.method,
      headers: { ...req.headers, host: url.host },
    }, (proxyRes) => {
      const headers: any = { ...proxyRes.headers };
      delete headers["x-frame-options"];
      delete headers["content-security-policy"];
      res.writeHead(proxyRes.statusCode!, headers);
      proxyRes.pipe(res);
    });

    proxyReq.on("error", (err: Error) => {
      res.status(502).send("Preview server not reachable: " + err.message);
    });

    req.pipe(proxyReq);
  });

  // ── Socket.io ──
  io.on("connection", (socket: Socket) => {
    console.log("  Client connected");

    socket.on("agent:start", ({ agentId, prompt }: { agentId: string; prompt: string }) => {
      if (!agentManager) {
        socket.emit("agent:error", { agentId, error: "No working directory selected" });
        return;
      }
      console.log(`  Agent ${agentId} started`);
      agentManager.runAgent(agentId, prompt, socket);
    });

    socket.on("agent:message", ({ agentId, prompt }: { agentId: string; prompt: string }) => {
      if (!agentManager) {
        socket.emit("agent:error", { agentId, error: "No working directory selected" });
        return;
      }
      console.log(`  Agent ${agentId} continuing`);
      agentManager.runAgent(agentId, prompt, socket, true);
    });

    socket.on("agent:interrupt", ({ agentId }: { agentId: string }) => {
      console.log(`  Agent ${agentId} interrupted`);
      agentManager?.interrupt(agentId);
    });

    socket.on("disconnect", () => {
      console.log("  Client disconnected");
    });
  });

  await new Promise<void>((res) => {
    server.listen(port, () => res());
  });

  return {
    server,
    launchBrowser: async (url: string): Promise<void> => {
      await previewBrowser.launch(url);
    },
  };
}
