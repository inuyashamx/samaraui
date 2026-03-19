import express from "express";
import { createServer } from "http";
import http from "http";
import https from "https";
import { Server } from "socket.io";
import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "fs";
import { createHash } from "crypto";
import { homedir } from "os";
import AgentManager from "./agent-manager.js";
import PreviewBrowser from "./preview-browser.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function startServer({ port, cwd }) {
  const app = express();
  const server = createServer(app);
  const io = new Server(server, { cors: { origin: "*" } });

  let agentManager = null;
  let previewTarget = null;
  const previewBrowser = new PreviewBrowser();

  app.use(express.json());

  // ── UI static files under /_app/ ──
  app.use("/_app", express.static(join(__dirname, "..", "public")));

  // Root: serve UI only if no preview target is active
  app.get("/", (req, res, next) => {
    if (previewTarget) return next(); // let proxy handle it
    res.sendFile(join(__dirname, "..", "public", "index.html"));
  });

  // ── API routes ──
  app.get("/api/check-dir", (req, res) => {
    const dir = req.query.path;
    if (!dir) return res.json({ valid: false });
    try {
      const resolved = resolve(dir);
      const s = statSync(resolved);
      res.json({ valid: s.isDirectory(), path: resolved });
    } catch {
      res.json({ valid: false });
    }
  });

  app.get("/api/home", (req, res) => {
    const home = homedir();
    const desktop = join(home, "Desktop");
    const onedrive = join(home, "OneDrive", "Escritorio");
    const docs = join(home, "Documents");
    const suggestions = [];
    for (const p of [home, desktop, onedrive, docs]) {
      try { if (statSync(p).isDirectory()) suggestions.push(p); } catch {}
    }
    const projectDirs = [];
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

  app.post("/api/set-preview", (req, res) => {
    let url = (req.body.url || "").trim();
    if (url && !/^https?:\/\//.test(url)) {
      url = "http://" + url;
    }
    previewTarget = url || null;
    if (agentManager) agentManager.setPreviewBaseUrl(previewTarget);
    console.log(`  Preview target set: ${previewTarget}`);
    res.json({ ok: true, url: previewTarget });
  });

  // ── Usage endpoint ──
  let usageCache = { data: null, fetchedAt: 0 };

  app.get("/api/usage", async (req, res) => {
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
    } catch (err) {
      res.json({ error: err.message });
    }
  });

  // ── State persistence ──
  const stateDir = join(homedir(), ".samara-ui", "sessions");

  function stateFile(dir) {
    const hash = createHash("md5").update(dir).digest("hex").slice(0, 12);
    return join(stateDir, `${hash}.json`);
  }

  app.get("/api/state", (req, res) => {
    const dir = req.query.cwd;
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

  app.post("/api/state", (req, res) => {
    const { cwd: dir, state } = req.body;
    if (!dir || !state) return res.status(400).json({ error: "cwd and state required" });
    try {
      mkdirSync(stateDir, { recursive: true });
      writeFileSync(stateFile(dir), JSON.stringify(state, null, 2));
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/set-cwd", (req, res) => {
    const { cwd: newCwd } = req.body;
    if (!newCwd) return res.status(400).json({ error: "cwd required" });
    const resolved = resolve(newCwd);
    agentManager = new AgentManager(resolved);
    agentManager.setPreviewBrowser(previewBrowser);
    console.log(`  Working directory set: ${resolved}`);
    res.json({ cwd: resolved });
  });

  // ── Reverse proxy: everything not /_app/ or /api/ goes to preview target ──
  app.use((req, res, next) => {
    // Skip if no preview target or if it's a socket.io/api/_app request
    if (!previewTarget || req.path.startsWith("/_app") || req.path.startsWith("/api") || req.path.startsWith("/socket.io")) {
      return next();
    }

    const targetUrl = previewTarget + req.url;
    let url;
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
      const headers = { ...proxyRes.headers };
      delete headers["x-frame-options"];
      delete headers["content-security-policy"];
      res.writeHead(proxyRes.statusCode, headers);
      proxyRes.pipe(res);
    });

    proxyReq.on("error", (err) => {
      res.status(502).send("Preview server not reachable: " + err.message);
    });

    req.pipe(proxyReq);
  });

  // ── Socket.io ──
  io.on("connection", (socket) => {
    console.log("  Client connected");

    socket.on("agent:start", ({ agentId, prompt }) => {
      if (!agentManager) {
        socket.emit("agent:error", { agentId, error: "No working directory selected" });
        return;
      }
      console.log(`  Agent ${agentId} started`);
      agentManager.runAgent(agentId, prompt, socket);
    });

    socket.on("agent:message", ({ agentId, prompt }) => {
      if (!agentManager) {
        socket.emit("agent:error", { agentId, error: "No working directory selected" });
        return;
      }
      console.log(`  Agent ${agentId} continuing`);
      agentManager.runAgent(agentId, prompt, socket, true);
    });

    socket.on("agent:interrupt", ({ agentId }) => {
      console.log(`  Agent ${agentId} interrupted`);
      agentManager?.interrupt(agentId);
    });

    socket.on("disconnect", () => {
      console.log("  Client disconnected");
    });
  });

  await new Promise((res) => {
    server.listen(port, () => res());
  });

  return {
    server,
    launchBrowser: async (url) => {
      await previewBrowser.launch(url);
    },
  };
}
