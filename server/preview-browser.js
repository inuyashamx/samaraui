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
      ],
      ignoreDefaultArgs: ["--enable-automation"],
    });

    // --app= creates the page automatically
    this.page = this.context.pages()[0];
    if (!this.page) {
      this.page = await this.context.newPage();
      await this.page.goto(appUrl, { waitUntil: "domcontentloaded" });
    }
    await this.page.waitForLoadState("domcontentloaded");
  }

  async _getPreviewFrame() {
    // Find the preview iframe in the page
    const frame = this.page.frame({ url: /.*/ });
    // Get all frames and find the preview one
    const frames = this.page.frames();
    for (const f of frames) {
      const url = f.url();
      if (url !== this.page.url() && !url.startsWith("about:")) {
        return f;
      }
    }
    return null;
  }

  async screenshot() {
    const frame = await this._getPreviewFrame();
    if (!frame) return null;

    // Screenshot the iframe element
    const iframeEl = await this.page.$("iframe.preview-frame");
    if (!iframeEl) return null;

    const buffer = await iframeEl.screenshot({ type: "png" });
    return buffer.toString("base64");
  }

  async navigate(route) {
    const frame = await this._getPreviewFrame();
    if (frame) {
      await frame.goto(frame.url().replace(/\/[^/]*$/, "") + route, {
        waitUntil: "domcontentloaded",
        timeout: 10000,
      }).catch(() => {});
    }
    // Also update the address bar input
    await this.page.fill('[id^="preview-address-"]', route).catch(() => {});
  }

  async refresh() {
    const frame = await this._getPreviewFrame();
    if (frame) {
      // Reload current URL in the frame, preserving the route
      await frame.evaluate(() => window.location.reload());
      await this.page.waitForTimeout(1500);
    }
  }

  async click(selector) {
    const frame = await this._getPreviewFrame();
    if (!frame) return "No preview frame found";
    try {
      await frame.click(selector, { timeout: 5000 });
      return `Clicked: ${selector}`;
    } catch (err) {
      return `Could not click "${selector}": ${err.message}`;
    }
  }

  async type(selector, text) {
    const frame = await this._getPreviewFrame();
    if (!frame) return "No preview frame found";
    try {
      await frame.fill(selector, text, { timeout: 5000 });
      return `Typed "${text}" into ${selector}`;
    } catch (err) {
      return `Could not type into "${selector}": ${err.message}`;
    }
  }

  async inspect(selector) {
    const frame = await this._getPreviewFrame();
    if (!frame) return "No preview frame found";
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

  async getUrl() {
    const frame = await this._getPreviewFrame();
    if (!frame) return "/";
    try {
      return new URL(frame.url()).pathname;
    } catch {
      return frame.url();
    }
  }

  async getPageContent(selector) {
    const frame = await this._getPreviewFrame();
    if (!frame) return "No preview frame found";
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
