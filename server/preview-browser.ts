import { chromium, BrowserContext, Page, Frame, CDPSession } from "playwright";
import { mkdirSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

interface ConsoleEntry {
  level: string;
  text: string;
  timestamp: number;
  url?: string;
  line?: number;
}

interface NetworkEntry {
  method: string;
  url: string;
  status: number | null;
  type: string;
  duration: number | null;
  error?: string;
  timestamp: number;
}

const MAX_LOG_ENTRIES = 200;

class PreviewBrowser {
  context: BrowserContext | null;
  page: Page | null;
  private cdpSession: CDPSession | null;
  private consoleLogs: ConsoleEntry[];
  private networkLogs: NetworkEntry[];
  private pendingRequests: Map<string, { method: string; url: string; type: string; timestamp: number }>;

  constructor() {
    this.context = null;
    this.page = null;
    this.cdpSession = null;
    this.consoleLogs = [];
    this.networkLogs = [];
    this.pendingRequests = new Map();
  }

  async launch(appUrl: string): Promise<void> {
    // Persistent profile so localStorage, cache, cookies survive restarts
    const userDataDir = join(homedir(), ".samara-ui", "browser-profile");
    if (!existsSync(userDataDir)) mkdirSync(userDataDir, { recursive: true });

    this.context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      channel: "msedge",
      viewport: null,
      args: [
        "--app=" + appUrl,
        "--start-maximized",
        "--disable-extensions",
        "--lang=en",
        "--disable-features=TranslateUI",
      ],
      ignoreDefaultArgs: ["--enable-automation", "--no-sandbox"],
    });

    // --app= creates the page automatically
    this.page = this.context.pages()[0];
    if (!this.page) {
      this.page = await this.context.newPage();
      await this.page.goto(appUrl, { waitUntil: "domcontentloaded" });
    }
    await this.page.waitForLoadState("domcontentloaded");

    // Set up CDP listeners for console and network capture
    await this._setupCdpListeners();
  }

  private async _setupCdpListeners(): Promise<void> {
    if (!this.page) return;
    try {
      this.cdpSession = await this.page.context().newCDPSession(this.page);

      // Console logs
      await this.cdpSession.send("Runtime.enable");
      this.cdpSession.on("Runtime.consoleAPICalled", (params: any) => {
        const text = params.args
          .map((a: any) => a.value ?? a.description ?? JSON.stringify(a))
          .join(" ");
        this.consoleLogs.push({
          level: params.type,
          text,
          timestamp: Date.now(),
        });
        if (this.consoleLogs.length > MAX_LOG_ENTRIES) this.consoleLogs.shift();
      });

      // JS exceptions
      this.cdpSession.on("Runtime.exceptionThrown", (params: any) => {
        const desc = params.exceptionDetails?.exception?.description
          || params.exceptionDetails?.text
          || "Unknown error";
        this.consoleLogs.push({
          level: "error",
          text: desc,
          timestamp: Date.now(),
          url: params.exceptionDetails?.url,
          line: params.exceptionDetails?.lineNumber,
        });
        if (this.consoleLogs.length > MAX_LOG_ENTRIES) this.consoleLogs.shift();
      });

      // Network
      await this.cdpSession.send("Network.enable");
      this.cdpSession.on("Network.requestWillBeSent", (params: any) => {
        this.pendingRequests.set(params.requestId, {
          method: params.request.method,
          url: params.request.url,
          type: params.type || "Other",
          timestamp: Date.now(),
        });
      });

      this.cdpSession.on("Network.responseReceived", (params: any) => {
        const req = this.pendingRequests.get(params.requestId);
        if (req) {
          this.networkLogs.push({
            ...req,
            status: params.response.status,
            duration: Date.now() - req.timestamp,
          });
          this.pendingRequests.delete(params.requestId);
          if (this.networkLogs.length > MAX_LOG_ENTRIES) this.networkLogs.shift();
        }
      });

      this.cdpSession.on("Network.loadingFailed", (params: any) => {
        const req = this.pendingRequests.get(params.requestId);
        if (req) {
          this.networkLogs.push({
            ...req,
            status: null,
            duration: Date.now() - req.timestamp,
            error: params.errorText || "Failed",
          });
          this.pendingRequests.delete(params.requestId);
          if (this.networkLogs.length > MAX_LOG_ENTRIES) this.networkLogs.shift();
        }
      });
    } catch (err) {
      console.error("  CDP listener setup failed:", err);
    }
  }

  async _getPreviewFrame(agentId: string): Promise<Frame | null> {
    if (!this.page) return null;
    const iframeEl = await this.page.$(`#preview-frame-${agentId}`);
    if (!iframeEl) return null;
    return await iframeEl.contentFrame();
  }

  async screenshot(agentId: string): Promise<string | null> {
    if (!this.page) return null;
    // Temporarily show the tab panel if hidden so Playwright can capture it
    const wasHidden = await this.page.evaluate((id: string) => {
      const panel = document.getElementById(`tab-panel-${id}`);
      if (!panel) return false;
      if (panel.style.display === "none") {
        panel.style.display = "flex";
        return true;
      }
      return false;
    }, agentId);

    const iframeEl = await this.page.$(`#preview-frame-${agentId}`);
    if (!iframeEl) {
      if (wasHidden) {
        await this.page.evaluate((id: string) => {
          const panel = document.getElementById(`tab-panel-${id}`);
          if (panel) panel.style.display = "none";
        }, agentId);
      }
      return null;
    }

    // Capture full-page screenshot from inside the iframe frame
    const frame = await iframeEl.contentFrame();
    let buffer: Buffer;
    if (frame) {
      // Use CDP on the iframe's frame to get full page screenshot
      try {
        const cdp = await this.page!.context().newCDPSession(await frame.page()!);
        // Get the frame tree to find the iframe's frameId
        const { frameTree } = await cdp.send("Page.getFrameTree");
        const findFrame = (tree: any): string | null => {
          if (tree.frame.url === frame.url()) return tree.frame.id;
          for (const child of tree.childFrames || []) {
            const found = findFrame(child);
            if (found) return found;
          }
          return null;
        };
        const frameId = findFrame(frameTree);

        // Get full page dimensions from inside the iframe
        const metrics = await frame.evaluate(() => ({
          width: Math.max(document.documentElement.scrollWidth, document.documentElement.clientWidth),
          height: Math.max(document.documentElement.scrollHeight, document.documentElement.clientHeight),
        }));

        // Cap height to avoid massive screenshots (max ~4000px)
        const captureHeight = Math.min(metrics.height, 4000);

        // Take full page screenshot via CDP
        const clip = { x: 0, y: 0, width: metrics.width, height: captureHeight, scale: 1 };
        const result = await cdp.send("Page.captureScreenshot", {
          format: "jpeg",
          quality: 75,
          clip,
          captureBeyondViewport: true,
        });
        await cdp.detach();
        buffer = Buffer.from(result.data, "base64");
      } catch {
        // Fallback to element screenshot
        buffer = await iframeEl.screenshot({ type: "jpeg", quality: 80, scale: "css" });
      }
    } else {
      buffer = await iframeEl.screenshot({ type: "jpeg", quality: 80, scale: "css" });
    }

    // Restore hidden state
    if (wasHidden) {
      await this.page.evaluate((id: string) => {
        const panel = document.getElementById(`tab-panel-${id}`);
        if (panel) panel.style.display = "none";
      }, agentId);
    }

    return buffer.toString("base64");
  }

  async navigate(agentId: string, route: string): Promise<void> {
    const frame = await this._getPreviewFrame(agentId);
    if (frame) {
      await frame.goto(frame.url().replace(/\/[^/]*$/, "") + route, {
        waitUntil: "domcontentloaded",
        timeout: 10000,
      }).catch(() => {});
    }
    await this.page!.fill(`#preview-address-${agentId}`, route).catch(() => {});
  }

  async refresh(agentId: string): Promise<void> {
    const frame = await this._getPreviewFrame(agentId);
    if (frame) {
      await frame.evaluate(() => window.location.reload());
      await this.page!.waitForTimeout(1500);
    }
  }

  async click(agentId: string, selector: string): Promise<string> {
    const frame = await this._getPreviewFrame(agentId);
    if (!frame) return "No preview frame found for this agent";
    try {
      await frame.click(selector, { timeout: 5000 });
      return `Clicked: ${selector}`;
    } catch (err: any) {
      return `Could not click "${selector}": ${err.message}`;
    }
  }

  async type(agentId: string, selector: string, text: string): Promise<string> {
    const frame = await this._getPreviewFrame(agentId);
    if (!frame) return "No preview frame found for this agent";
    try {
      await frame.fill(selector, text, { timeout: 5000 });
      return `Typed "${text}" into ${selector}`;
    } catch (err: any) {
      return `Could not type into "${selector}": ${err.message}`;
    }
  }

  async inspect(agentId: string, selector: string): Promise<string> {
    const frame = await this._getPreviewFrame(agentId);
    if (!frame) return "No preview frame found for this agent";
    try {
      const result = await frame.evaluate((sel: string) => {
        const els = document.querySelectorAll(sel);
        if (els.length === 0) return { found: 0 };
        const info = Array.from(els).slice(0, 10).map((el) => ({
          tag: el.tagName.toLowerCase(),
          id: (el as HTMLElement).id || undefined,
          classes: (el as HTMLElement).className || undefined,
          text: el.textContent?.slice(0, 100)?.trim() || undefined,
          visible: (el as HTMLElement).offsetParent !== null,
          children: el.children.length,
        }));
        return { found: els.length, elements: info };
      }, selector);
      return JSON.stringify(result, null, 2);
    } catch (err: any) {
      return `Inspect failed: ${err.message}`;
    }
  }

  async scroll(agentId: string, direction: "up" | "down", amount?: number): Promise<string> {
    const frame = await this._getPreviewFrame(agentId);
    if (!frame) return "No preview frame found for this agent";
    try {
      const pixels = amount || 500;
      const delta = direction === "down" ? pixels : -pixels;
      await frame.evaluate((d: number) => window.scrollBy(0, d), delta);
      return `Scrolled ${direction} by ${pixels}px`;
    } catch (err: any) {
      return `Scroll failed: ${err.message}`;
    }
  }

  async getUrl(agentId: string): Promise<string> {
    const frame = await this._getPreviewFrame(agentId);
    if (!frame) return "/";
    try {
      return new URL(frame.url()).pathname;
    } catch {
      return frame.url();
    }
  }

  async getPageContent(agentId: string, selector?: string): Promise<string> {
    const frame = await this._getPreviewFrame(agentId);
    if (!frame) return "No preview frame found for this agent";
    try {
      const html = await frame.evaluate((sel: string | null) => {
        const el = sel ? document.querySelector(sel) : document.body;
        return el ? el.innerHTML.slice(0, 5000) : "Element not found";
      }, selector || null);
      return html;
    } catch (err: any) {
      return `Failed: ${err.message}`;
    }
  }

  getConsoleLogs(level?: string, clear: boolean = false): ConsoleEntry[] {
    let logs = this.consoleLogs;
    if (level) logs = logs.filter((l) => l.level === level);
    const result = [...logs];
    if (clear) {
      if (level) {
        this.consoleLogs = this.consoleLogs.filter((l) => l.level !== level);
      } else {
        this.consoleLogs = [];
      }
    }
    return result;
  }

  getNetworkLogs(options?: { errorsOnly?: boolean; clear?: boolean }): NetworkEntry[] {
    let logs = this.networkLogs;
    if (options?.errorsOnly) logs = logs.filter((l) => l.error || (l.status && l.status >= 400));
    const result = [...logs];
    if (options?.clear) this.networkLogs = [];
    return result;
  }

  async clearCache(): Promise<void> {
    if (!this.context) return;
    // Clear all browser caches, cookies, and storage
    await this.context.clearCookies();
    // Clear cache via CDP session
    for (const page of this.context.pages()) {
      try {
        const cdp = await page.context().newCDPSession(page);
        await cdp.send("Network.clearBrowserCache");
        await cdp.detach();
      } catch {}
    }
  }

  async close(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
  }
}

export default PreviewBrowser;
