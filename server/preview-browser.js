import { chromium } from "playwright";
import { mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

class PreviewBrowser {
  constructor() {
    this.context = null;
    this.page = null;
  }

  async launch(appUrl) {
    const userDataDir = mkdtempSync(join(tmpdir(), "claude-ui-"));

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
  }

  async _getPreviewFrame(agentId) {
    if (!this.page) return null;
    const iframeEl = await this.page.$(`#preview-frame-${agentId}`);
    if (!iframeEl) return null;
    return await iframeEl.contentFrame();
  }

  async screenshot(agentId) {
    if (!this.page) return null;
    // Temporarily show the tab panel if hidden so Playwright can capture it
    const wasHidden = await this.page.evaluate((id) => {
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
        await this.page.evaluate((id) => {
          const panel = document.getElementById(`tab-panel-${id}`);
          if (panel) panel.style.display = "none";
        }, agentId);
      }
      return null;
    }

    const buffer = await iframeEl.screenshot({ type: "png" });

    // Restore hidden state
    if (wasHidden) {
      await this.page.evaluate((id) => {
        const panel = document.getElementById(`tab-panel-${id}`);
        if (panel) panel.style.display = "none";
      }, agentId);
    }

    return buffer.toString("base64");
  }

  async navigate(agentId, route) {
    const frame = await this._getPreviewFrame(agentId);
    if (frame) {
      await frame.goto(frame.url().replace(/\/[^/]*$/, "") + route, {
        waitUntil: "domcontentloaded",
        timeout: 10000,
      }).catch(() => {});
    }
    await this.page.fill(`#preview-address-${agentId}`, route).catch(() => {});
  }

  async refresh(agentId) {
    const frame = await this._getPreviewFrame(agentId);
    if (frame) {
      await frame.evaluate(() => window.location.reload());
      await this.page.waitForTimeout(1500);
    }
  }

  async click(agentId, selector) {
    const frame = await this._getPreviewFrame(agentId);
    if (!frame) return "No preview frame found for this agent";
    try {
      await frame.click(selector, { timeout: 5000 });
      return `Clicked: ${selector}`;
    } catch (err) {
      return `Could not click "${selector}": ${err.message}`;
    }
  }

  async type(agentId, selector, text) {
    const frame = await this._getPreviewFrame(agentId);
    if (!frame) return "No preview frame found for this agent";
    try {
      await frame.fill(selector, text, { timeout: 5000 });
      return `Typed "${text}" into ${selector}`;
    } catch (err) {
      return `Could not type into "${selector}": ${err.message}`;
    }
  }

  async inspect(agentId, selector) {
    const frame = await this._getPreviewFrame(agentId);
    if (!frame) return "No preview frame found for this agent";
    try {
      const result = await frame.evaluate((sel) => {
        const els = document.querySelectorAll(sel);
        if (els.length === 0) return { found: 0 };
        const info = Array.from(els).slice(0, 10).map((el) => ({
          tag: el.tagName.toLowerCase(),
          id: el.id || undefined,
          classes: el.className || undefined,
          text: el.textContent?.slice(0, 100)?.trim() || undefined,
          visible: el.offsetParent !== null,
          children: el.children.length,
        }));
        return { found: els.length, elements: info };
      }, selector);
      return JSON.stringify(result, null, 2);
    } catch (err) {
      return `Inspect failed: ${err.message}`;
    }
  }

  async getUrl(agentId) {
    const frame = await this._getPreviewFrame(agentId);
    if (!frame) return "/";
    try {
      return new URL(frame.url()).pathname;
    } catch {
      return frame.url();
    }
  }

  async getPageContent(agentId, selector) {
    const frame = await this._getPreviewFrame(agentId);
    if (!frame) return "No preview frame found for this agent";
    try {
      const html = await frame.evaluate((sel) => {
        const el = sel ? document.querySelector(sel) : document.body;
        return el ? el.innerHTML.slice(0, 5000) : "Element not found";
      }, selector || null);
      return html;
    } catch (err) {
      return `Failed: ${err.message}`;
    }
  }

  async close() {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
  }
}

export default PreviewBrowser;
