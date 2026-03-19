// ── State ──
const state = {
  tabs: [],
  activeTabId: null,
  cwd: "",
  ready: false,
};

const socket = io();

// ── Directory Picker ──
async function showDirectoryPicker() {
  const app = document.getElementById("app");

  // Fetch project suggestions
  let projects = [];
  try {
    const res = await fetch("/api/home");
    const data = await res.json();
    projects = data.projects || [];
  } catch {}

  app.innerHTML = `
    <div class="flex items-center justify-center h-full">
      <div class="w-full max-w-md">
        <div class="text-center mb-6">
          <div class="text-5xl mb-4 opacity-30">⚡</div>
          <h1 class="text-xl font-semibold text-gray-200 mb-1">Samara Code UI</h1>
          <p class="text-xs text-gray-600 mb-1">Powered by Claude Code</p>
          <p class="text-sm text-gray-500">Select a working directory</p>
        </div>

        <!-- Path input -->
        <div class="flex gap-2 mb-4">
          <input
            type="text"
            id="dir-input"
            class="flex-1 bg-surface-1 border border-border rounded-lg px-4 py-3 text-sm text-gray-200 outline-none focus:border-accent font-mono"
            placeholder="Paste a folder path..."
            onkeydown="if(event.key==='Enter') openFolder()"
          >
          <button
            class="px-5 py-3 bg-accent hover:bg-accent-light text-black font-medium rounded-lg transition-colors text-sm shrink-0"
            onclick="openFolder()"
          >Open</button>
        </div>
        <div id="dir-error" class="text-xs text-red-400 mb-4 hidden"></div>

        <!-- Project suggestions -->
        ${projects.length > 0 ? `
          <div class="text-xs text-gray-500 mb-2">Projects</div>
          <div class="bg-surface-1 rounded-lg border border-border overflow-hidden max-h-72 overflow-y-auto">
            ${projects.map((p) => `
              <div class="dir-item" onclick="document.getElementById('dir-input').value='${p.path.replace(/\\/g, "\\\\")}'; openFolder()">
                <span class="text-gray-500 mr-2">📁</span>
                <span class="flex-1">${escapeHtml(p.name)}</span>
                <span class="text-xs text-gray-600 font-mono truncate ml-2 max-w-48">${escapeHtml(p.path)}</span>
              </div>
            `).join("")}
          </div>
        ` : ""}
      </div>
    </div>
  `;

  document.getElementById("dir-input").focus();
}

async function openFolder() {
  const input = document.getElementById("dir-input");
  const errorEl = document.getElementById("dir-error");
  const path = input.value.trim();
  if (!path) return;

  errorEl.classList.add("hidden");

  try {
    // Validate directory exists
    const checkRes = await fetch(`/api/check-dir?path=${encodeURIComponent(path)}`);
    const checkData = await checkRes.json();
    if (!checkData.valid) {
      errorEl.textContent = "Directory not found: " + path;
      errorEl.classList.remove("hidden");
      return;
    }

    // Set cwd
    const res = await fetch("/api/set-cwd", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cwd: checkData.path }),
    });
    const data = await res.json();

    state.cwd = data.cwd;
    state.ready = true;
    initMainUI();
  } catch (err) {
    errorEl.textContent = "Error: " + err.message;
    errorEl.classList.remove("hidden");
  }
}

function initMainUI() {
  const app = document.getElementById("app");
  app.innerHTML = `
    <div id="main-app" class="h-full flex flex-col">
      <!-- Tab bar -->
      <div class="flex items-center bg-surface-1 border-b border-border px-2 h-10 shrink-0">
        <div id="tab-bar" class="flex items-center gap-1 overflow-x-auto flex-1"></div>
        <div class="flex items-center gap-1 ml-2">
          <div id="usage-bar" class="flex items-center gap-2 mr-2" title="Claude Code usage"></div>
          <button
            class="px-2 py-1 text-xs bg-surface-2 hover:bg-surface-3 rounded text-gray-500 hover:text-white transition-colors"
            onclick="changeCwd()"
            title="Change directory"
          >📁</button>
          <button
            class="px-3 py-1 text-sm bg-surface-2 hover:bg-surface-3 rounded text-gray-400 hover:text-white transition-colors"
            title="New agent tab"
            onclick="createTab()"
          >+ New Agent</button>
        </div>
      </div>
      <!-- Tab content -->
      <div id="tab-content" class="flex-1 flex overflow-hidden"></div>
    </div>
  `;
  createTab("Agent 1");
  fetchUsage();
}

function changeCwd() {
  state.ready = false;
  state.tabs = [];
  state.activeTabId = null;
  // Clear all persistent panels
  const container = document.getElementById("tab-content");
  if (container) container.innerHTML = "";
  showDirectoryPicker();
}


// ── Preview control events ──
socket.on("preview:navigate", ({ agentId, route }) => {
  const tab = state.tabs.find((t) => t.id === agentId);
  if (!tab) return;

  tab.previewRoute = route;
  const frame = document.getElementById(`preview-frame-${tab.id}`);
  if (frame && tab.previewUrl) {
    frame.src = route;
  }
  const addr = document.getElementById(`preview-address-${tab.id}`);
  if (addr) addr.value = route;
});

socket.on("preview:refresh", ({ agentId }) => {
  const tab = state.tabs.find((t) => t.id === agentId);
  if (!tab) return;

  const frame = document.getElementById(`preview-frame-${tab.id}`);
  if (frame) {
    try {
      // Reload preserving current URL
      frame.contentWindow.location.reload();
    } catch {
      // Fallback if cross-origin
      frame.src = frame.src;
    }
  }
});

socket.on("preview:get-url", ({ agentId }) => {
  const tab = state.tabs.find((t) => t.id === agentId);
  if (!tab) return;

  const frame = document.getElementById(`preview-frame-${tab.id}`);
  let url = "/";
  try {
    url = frame?.contentWindow?.location?.pathname || "/";
  } catch { /* cross-origin fallback */ }

  socket.emit("preview:current-url", { url });
});


socket.on("agent:init", ({ agentId, sessionId, model }) => {
  const tab = state.tabs.find((t) => t.id === agentId);
  if (tab) {
    tab.sessionId = sessionId;
    tab.status = "running";
    tab.model = model;
    updateTabBar();
  }
});

socket.on("agent:text", ({ agentId, text }) => {
  const tab = state.tabs.find((t) => t.id === agentId);
  if (!tab) return;

  // Append to last assistant message or create new one
  const lastMsg = tab.messages[tab.messages.length - 1];
  if (lastMsg && lastMsg.role === "assistant") {
    lastMsg.content += text;
  } else {
    tab.messages.push({ role: "assistant", content: text });
  }

  // Auto-detect server URLs in assistant text
  if (!tab.previewUrl) {
    const urlMatch = text.match(/https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]):(\d+)/);
    if (urlMatch) {
      tab.previewUrl = urlMatch[0].replace("[::1]", "localhost").replace("127.0.0.1", "localhost");
      setPreviewTarget(tab.previewUrl);
      if (agentId === state.activeTabId) {
        renderTabContent(agentId);
        return;
      }
    }
  }

  renderChat(agentId);
});

socket.on("agent:tool_use", ({ agentId, toolUseId, tool, input }) => {
  const tab = state.tabs.find((t) => t.id === agentId);
  if (!tab) return;

  tab.messages.push({
    role: "tool",
    toolUseId,
    tool,
    input,
    content: `Using ${tool}`,
    result: null,
  });
  renderChat(agentId);
});

socket.on("agent:tool_result", ({ agentId, content }) => {
  const tab = state.tabs.find((t) => t.id === agentId);
  if (!tab) return;

  // Find the last tool message without a result
  for (let i = tab.messages.length - 1; i >= 0; i--) {
    if (tab.messages[i].role === "tool" && tab.messages[i].result === null) {
      tab.messages[i].result = content;
      break;
    }
  }

  // Auto-detect server URLs in output and set preview
  if (typeof content === "string" && !tab.previewUrl) {
    const urlMatch = content.match(/https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]):(\d+)/);
    if (urlMatch) {
      tab.previewUrl = urlMatch[0].replace("[::1]", "localhost").replace("127.0.0.1", "localhost");
      setPreviewTarget(tab.previewUrl);
      if (agentId === state.activeTabId) {
        renderTabContent(agentId);
        return;
      }
    }
  }

  renderChat(agentId);
});

socket.on("agent:tool_progress", ({ agentId, tool, elapsed }) => {
  const tab = state.tabs.find((t) => t.id === agentId);
  if (!tab) return;

  // Update the last tool message with elapsed time
  for (let i = tab.messages.length - 1; i >= 0; i--) {
    if (tab.messages[i].role === "tool" && tab.messages[i].result === null) {
      tab.messages[i].elapsed = elapsed;
      break;
    }
  }
  renderChat(agentId);
});

socket.on("agent:result", ({ agentId, result, errors, subtype, cost, turns, duration }) => {
  const tab = state.tabs.find((t) => t.id === agentId);
  if (!tab) return;

  tab.status = subtype === "success" ? "idle" : "error";

  if (errors && errors.length > 0) {
    tab.messages.push({
      role: "system",
      content: `Error: ${errors.join(", ")}`,
    });
  }

  if (cost !== undefined) {
    tab.lastCost = cost;
    tab.lastDuration = duration;
    tab.lastTurns = turns;
  }

  updateTabBar();
  if (agentId === state.activeTabId) {
    renderChat(agentId);
    updateInputArea(agentId);
  }
});

socket.on("agent:error", ({ agentId, error }) => {
  const tab = state.tabs.find((t) => t.id === agentId);
  if (!tab) return;

  tab.status = "error";
  tab.messages.push({ role: "system", content: `Error: ${error}` });
  updateTabBar();
  if (agentId === state.activeTabId) {
    renderChat(agentId);
    updateInputArea(agentId);
  }
});

// ── Tab Management ──
function createTab(name) {
  const id = `agent-${Date.now()}`;
  const tab = {
    id,
    name: name || `Agent ${state.tabs.length + 1}`,
    status: "idle", // idle | running | error
    messages: [],
    sessionId: null,
    previewUrl: "",
    previewRoute: "/",
    zoom: 100,
    model: null,
    lastCost: null,
    lastDuration: null,
    lastTurns: null,
    chatHidden: false,
  };
  state.tabs.push(tab);
  switchTab(id);
  return tab;
}

function closeTab(id) {
  const idx = state.tabs.findIndex((t) => t.id === id);
  if (idx === -1) return;

  // Interrupt if running
  const tab = state.tabs[idx];
  if (tab.status === "running") {
    socket.emit("agent:interrupt", { agentId: id });
  }

  state.tabs.splice(idx, 1);

  // Remove the persistent panel from DOM
  const panel = document.getElementById(`tab-panel-${id}`);
  if (panel) panel.remove();

  if (state.activeTabId === id) {
    const newActive = state.tabs[Math.min(idx, state.tabs.length - 1)];
    if (newActive) {
      switchTab(newActive.id);
    } else {
      state.activeTabId = null;
      renderEmpty();
    }
  }
  updateTabBar();
}

function switchTab(id) {
  state.activeTabId = id;
  updateTabBar();

  const container = document.getElementById("tab-content");

  // Hide all tab panels
  container.querySelectorAll(".tab-panel").forEach((el) => {
    el.style.display = "none";
  });

  // Show or create the panel for this tab
  let panel = document.getElementById(`tab-panel-${id}`);
  if (!panel) {
    panel = document.createElement("div");
    panel.id = `tab-panel-${id}`;
    panel.className = "tab-panel flex flex-1 overflow-hidden";
    panel.style.width = "100%";
    container.appendChild(panel);
    renderTabContent(id);
  } else {
    panel.style.display = "flex";
    // Re-render chat to pick up any messages received while tab was hidden
    renderChat(id);
  }

  // Focus input
  const input = document.getElementById(`chat-input-${id}`);
  if (input && !input.disabled) input.focus();
}

// ── Rendering ──
function updateTabBar() {
  const bar = document.getElementById("tab-bar");
  bar.innerHTML = state.tabs
    .map((tab) => {
      const active = tab.id === state.activeTabId ? "active" : "";
      const statusClass = tab.status;
      return `
        <div class="tab ${active}" data-tab-id="${tab.id}" onclick="switchTab('${tab.id}')">
          <span class="status-dot ${statusClass}"></span>
          <span>${escapeHtml(tab.name)}</span>
          <span class="close-tab" onclick="event.stopPropagation(); closeTab('${tab.id}')">&times;</span>
        </div>
      `;
    })
    .join("");
}

function renderTabContent(tabId) {
  const tab = state.tabs.find((t) => t.id === tabId);
  if (!tab) return renderEmpty();

  const panel = document.getElementById(`tab-panel-${tabId}`);
  if (!panel) return;
  panel.innerHTML = `
    <div class="flex flex-1 overflow-hidden" id="agent-layout-${tab.id}">
      <!-- Chat panel -->
      <div class="flex flex-col" id="chat-panel-${tab.id}" style="width: 35%; min-width: 280px;">
        <!-- Messages -->
        <div class="flex-1 overflow-y-auto" id="chat-messages-${tab.id}">
          ${tab.messages.length === 0 ? renderWelcome() : ""}
        </div>

        <!-- Input -->
        <div class="p-3 border-t border-border bg-surface-1">
          <div class="flex gap-2">
            <textarea
              class="chat-input"
              id="chat-input-${tab.id}"
              rows="2"
              placeholder="Send a message to Claude..."
              onkeydown="handleInputKeydown(event, '${tab.id}')"
              ${tab.status === "running" ? "disabled" : ""}
            ></textarea>
            ${tab.status === "running"
              ? `<button
                  class="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg transition-colors shrink-0"
                  onclick="interruptAgent('${tab.id}')"
                >Stop</button>`
              : `<button
                  class="px-4 py-2 bg-accent hover:bg-accent-light text-black font-medium rounded-lg transition-colors shrink-0"
                  onclick="sendMessage('${tab.id}')"
                >Send</button>`
            }
          </div>
        </div>
      </div>

      <!-- Resizer -->
      <div class="resizer" id="resizer-${tab.id}" onmousedown="startResize(event, '${tab.id}')"></div>

      <!-- Preview panel -->
      <div class="flex-1 flex flex-col min-w-0 bg-surface-2">
        <!-- Address bar -->
        <div class="flex items-center gap-2 px-2 py-1.5 bg-surface-1 border-b border-border">
          <button class="text-xs text-gray-500 hover:text-white px-1" onclick="previewGoBack('${tab.id}')" title="Back">◀</button>
          <button class="text-xs text-gray-500 hover:text-white px-1" onclick="refreshPreview('${tab.id}')" title="Refresh">↻</button>
          <input
            type="text"
            class="flex-1 bg-surface-2 border border-border rounded px-3 py-1 text-xs text-gray-300 outline-none focus:border-accent font-mono"
            id="preview-address-${tab.id}"
            value="${escapeHtml(tab.previewRoute || '/')}"
            onkeydown="if(event.key==='Enter') navigatePreviewAddress('${tab.id}')"
            placeholder="/"
          >
          <span class="text-xs text-gray-600 mx-1">|</span>
          <button class="text-xs text-gray-500 hover:text-white px-1" onclick="zoomPreview('${tab.id}', -10)" title="Zoom out">−</button>
          <span class="text-xs text-gray-500" id="zoom-level-${tab.id}">${tab.zoom || 100}%</span>
          <button class="text-xs text-gray-500 hover:text-white px-1" onclick="zoomPreview('${tab.id}', 10)" title="Zoom in">+</button>
          <button class="text-xs text-gray-500 hover:text-white px-1" onclick="zoomPreview('${tab.id}', 0)" title="Reset zoom">⟲</button>
          <span class="text-xs text-gray-600 mx-1">|</span>
          <button class="text-xs text-gray-500 hover:text-white px-1" onclick="openPreviewExternal('${tab.id}')" title="Open in browser">↗</button>
        </div>
        <div class="flex-1 overflow-hidden">
          ${tab.previewUrl
            ? `<iframe class="preview-frame" id="preview-frame-${tab.id}" src="${escapeHtml(tab.previewRoute || '/')}" style="transform: scale(${(tab.zoom || 100) / 100}); transform-origin: 0 0; width: ${10000 / (tab.zoom || 100)}%; height: ${10000 / (tab.zoom || 100)}%;"></iframe>`
            : `<div class="flex items-center justify-center h-full text-gray-600 text-sm">
                <div class="text-center">
                  <div class="text-4xl mb-3 opacity-30">🖥</div>
                  <p>Preview will appear when a dev server starts</p>
                  <div class="mt-3">
                    <input
                      type="text"
                      class="bg-surface-1 border border-border rounded-lg px-3 py-2 text-xs text-gray-300 outline-none focus:border-accent font-mono w-56 text-center"
                      placeholder="http://localhost:8081"
                      onkeydown="if(event.key==='Enter') { updatePreviewUrl('${tab.id}', this.value) }"
                    >
                  </div>
                </div>
              </div>`
          }
        </div>
      </div>
    </div>
  `;

  renderChat(tabId);

  // Track iframe navigation to update address bar
  const frame = document.getElementById(`preview-frame-${tab.id}`);
  if (frame) {
    frame.addEventListener("load", () => {
      try {
        const path = frame.contentWindow?.location?.pathname || "/";
        const addr = document.getElementById(`preview-address-${tab.id}`);
        if (addr) addr.value = path;
        tab.previewRoute = path;
        socket.emit("preview:url-update", { url: path });
      } catch { /* cross-origin */ }
    });
  }

  // Focus input
  const input = document.getElementById(`chat-input-${tab.id}`);
  if (input && !input.disabled) input.focus();
}

function renderChat(tabId) {
  const tab = state.tabs.find((t) => t.id === tabId);
  if (!tab || tabId !== state.activeTabId) return;

  const container = document.getElementById(`chat-messages-${tabId}`);
  if (!container) return;

  if (tab.messages.length === 0) {
    container.innerHTML = renderWelcome();
    return;
  }

  container.innerHTML = tab.messages
    .map((msg) => {
      if (msg.role === "user") {
        return `<div class="message user">
          <div class="text-xs text-gray-500 mb-1">You</div>
          <div>${escapeHtml(msg.content)}</div>
        </div>`;
      }

      if (msg.role === "assistant") {
        return `<div class="message assistant">
          <div class="text-xs text-accent mb-1">Claude</div>
          <div class="prose prose-invert prose-sm max-w-none">${renderMarkdown(msg.content)}</div>
        </div>`;
      }

      if (msg.role === "tool") {
        const desc = toolDescription(msg.tool, msg.input);
        const elapsed = msg.elapsed ? ` (${msg.elapsed.toFixed(1)}s)` : "";
        const running = msg.result === null;
        const icon = running ? "⏳" : "✓";
        return `<div class="message tool">
          <div class="text-xs text-gray-400">
            <span>${icon}</span> ${escapeHtml(desc)}${elapsed}
          </div>
        </div>`;
      }

      if (msg.role === "system") {
        return `<div class="message" style="background: #1a0000; border-left: 3px solid #ef4444;">
          <div class="text-xs text-red-400">${escapeHtml(msg.content)}</div>
        </div>`;
      }

      return "";
    })
    .join("");

  // Auto-scroll to bottom
  container.scrollTop = container.scrollHeight;

  // Highlight code blocks
  container.querySelectorAll("pre code").forEach((block) => {
    hljs.highlightElement(block);
  });
}

function renderWelcome() {
  return `
    <div class="flex items-center justify-center h-full text-gray-600">
      <div class="text-center max-w-md">
        <div class="text-5xl mb-4 opacity-20">⚡</div>
        <h2 class="text-lg font-medium text-gray-400 mb-2">Samara Code UI</h2>
        <p class="text-xs text-gray-600 mb-3">Powered by Claude Code</p>
        <p class="text-sm">Send a message to start working.</p>
        <p class="text-xs mt-2 text-gray-700">Full access to filesystem, terminal, and web tools.</p>
      </div>
    </div>
  `;
}

function renderEmpty() {
  const container = document.getElementById("tab-content");
  container.innerHTML = `
    <div class="flex items-center justify-center w-full text-gray-600">
      <div class="text-center">
        <div class="text-5xl mb-4 opacity-20">⚡</div>
        <h2 class="text-lg font-medium text-gray-400 mb-2">Samara Code UI</h2>
        <p class="text-xs text-gray-600 mb-3">Powered by Claude Code</p>
        <p class="text-sm">Click "+ New Agent" to start</p>
      </div>
    </div>
  `;
}

function updateInputArea(tabId) {
  const tab = state.tabs.find((t) => t.id === tabId);
  if (!tab) return;

  const input = document.getElementById(`chat-input-${tabId}`);
  if (input) input.disabled = tab.status === "running";

  // Swap Send/Stop button
  const btnContainer = input?.parentElement;
  if (!btnContainer) return;
  const btn = btnContainer.querySelector("button");
  if (!btn) return;

  if (tab.status === "running") {
    btn.className = "px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg transition-colors shrink-0";
    btn.textContent = "Stop";
    btn.onclick = () => interruptAgent(tabId);
  } else {
    btn.className = "px-4 py-2 bg-accent hover:bg-accent-light text-black font-medium rounded-lg transition-colors shrink-0";
    btn.textContent = "Send";
    btn.onclick = () => sendMessage(tabId);
    if (input) input.focus();
  }
}

// ── Actions ──
function sendMessage(tabId) {
  const tab = state.tabs.find((t) => t.id === tabId);
  const input = document.getElementById(`chat-input-${tabId}`);
  if (!tab || !input || tab.status === "running") return;

  const prompt = input.value.trim();
  if (!prompt) return;

  tab.messages.push({ role: "user", content: prompt });
  tab.status = "running";
  input.value = "";
  input.disabled = true;

  renderChat(tabId);
  updateTabBar();
  updateInputArea(tabId);

  // Use agent:message for multi-turn if we already have a session
  if (tab.sessionId) {
    socket.emit("agent:message", { agentId: tabId, prompt });
  } else {
    socket.emit("agent:start", { agentId: tabId, prompt });
  }
}

function toggleChat(tabId) {
  const tab = state.tabs.find((t) => t.id === tabId);
  if (!tab) return;
  tab.chatHidden = !tab.chatHidden;
  renderTabContent(tabId);
}

function interruptAgent(tabId) {
  socket.emit("agent:interrupt", { agentId: tabId });
}

function handleInputKeydown(event, tabId) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage(tabId);
  }
}

async function updatePreviewUrl(tabId, url) {
  const tab = state.tabs.find((t) => t.id === tabId);
  if (!tab) return;
  tab.previewUrl = url;

  if (url) await setPreviewTarget(url);
  renderTabContent(tabId);
}

function refreshPreview(tabId) {
  const frame = document.getElementById(`preview-frame-${tabId}`);
  if (!frame) return;
  try {
    frame.contentWindow.location.reload();
  } catch {
    frame.src = frame.src;
  }
}

async function setPreviewTarget(url) {
  await fetch("/api/set-preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
}

function openPreviewExternal(tabId) {
  const tab = state.tabs.find((t) => t.id === tabId);
  if (tab?.previewUrl) {
    const route = tab.previewRoute || "/";
    window.open(tab.previewUrl + route, "_blank");
  }
}

function zoomPreview(tabId, delta) {
  const tab = state.tabs.find((t) => t.id === tabId);
  if (!tab) return;

  if (delta === 0) {
    tab.zoom = 100;
  } else {
    tab.zoom = Math.max(30, Math.min(200, (tab.zoom || 100) + delta));
  }

  const frame = document.getElementById(`preview-frame-${tabId}`);
  if (frame) {
    const scale = tab.zoom / 100;
    frame.style.transform = `scale(${scale})`;
    frame.style.width = `${10000 / tab.zoom}%`;
    frame.style.height = `${10000 / tab.zoom}%`;
  }

  const label = document.getElementById(`zoom-level-${tabId}`);
  if (label) label.textContent = `${tab.zoom}%`;
}

function navigatePreviewAddress(tabId) {
  const addr = document.getElementById(`preview-address-${tabId}`);
  if (!addr) return;
  const route = addr.value.trim() || "/";
  const frame = document.getElementById(`preview-frame-${tabId}`);
  if (frame) {
    frame.src = route;
    const tab = state.tabs.find((t) => t.id === tabId);
    if (tab) tab.previewRoute = route;
  }
}

function previewGoBack(tabId) {
  const frame = document.getElementById(`preview-frame-${tabId}`);
  if (frame) {
    try { frame.contentWindow.history.back(); } catch { /* cross-origin */ }
  }
}

// ── Resize ──
function startResize(event, tabId) {
  event.preventDefault();
  const resizer = document.getElementById(`resizer-${tabId}`);
  const chatPanel = document.getElementById(`chat-panel-${tabId}`);
  const layout = document.getElementById(`agent-layout-${tabId}`);

  resizer.classList.add("active");

  const onMouseMove = (e) => {
    const rect = layout.getBoundingClientRect();
    const newWidth = e.clientX - rect.left;
    const minW = 300;
    const maxW = rect.width - 300;
    chatPanel.style.width = `${Math.max(minW, Math.min(maxW, newWidth))}px`;
  };

  const onMouseUp = () => {
    resizer.classList.remove("active");
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  };

  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);
}

// ── Helpers ──
function escapeHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function toolDescription(tool, input) {
  const descriptions = {
    "Read": () => `Reading ${input?.file_path || "file"}`,
    "Write": () => `Writing ${input?.file_path || "file"}`,
    "Edit": () => `Editing ${input?.file_path || "file"}`,
    "Bash": () => `Running: ${(input?.command || "").slice(0, 80)}`,
    "Glob": () => `Searching files: ${input?.pattern || ""}`,
    "Grep": () => `Searching for: ${input?.pattern || ""}`,
    "WebSearch": () => `Searching web...`,
    "WebFetch": () => `Fetching URL...`,
    "Agent": () => `Running sub-agent...`,
    "mcp__preview-tools__NavigatePreview": () => `Navigating preview to ${input?.route || "/"}`,
    "mcp__preview-tools__RefreshPreview": () => `Refreshing preview...`,
    "mcp__preview-tools__ScreenshotPreview": () => `Taking screenshot...`,
    "mcp__preview-tools__GetPreviewURL": () => `Getting current URL...`,
    "mcp__preview-tools__InspectElement": () => `Inspecting: ${input?.selector || ""}`,
    "mcp__preview-tools__GetPageContent": () => `Reading page content...`,
    "mcp__preview-tools__ClickElement": () => `Clicking: ${input?.selector || ""}`,
    "mcp__preview-tools__TypeInElement": () => `Typing in: ${input?.selector || ""}`,
  };
  const fn = descriptions[tool];
  return fn ? fn() : `${tool}`;
}

function renderMarkdown(text) {
  if (!text) return "";
  try {
    return marked.parse(text);
  } catch {
    return escapeHtml(text);
  }
}

// ── Usage Bar ──
async function fetchUsage() {
  const bar = document.getElementById("usage-bar");
  if (!bar) return;

  try {
    const res = await fetch("/api/usage");
    const data = await res.json();
    if (data.error) {
      bar.innerHTML = "";
      return;
    }
    bar.innerHTML = renderUsageBar(data);
  } catch {
    bar.innerHTML = "";
  }
}

function renderUsageBar(data) {
  const items = [];

  if (data.five_hour) {
    items.push({ label: "5h", pct: data.five_hour.utilization, resets: data.five_hour.resets_at });
  }
  if (data.seven_day) {
    items.push({ label: "7d", pct: data.seven_day.utilization, resets: data.seven_day.resets_at });
  }

  if (items.length === 0) return "";

  return items.map(({ label, pct, resets }) => {
    const color = pct > 80 ? "#ef4444" : pct > 50 ? "#f59e0b" : "#10b981";
    const resetTime = resets ? new Date(resets).toLocaleString() : "";
    return `
      <div class="flex items-center gap-1" title="${label} usage: ${pct.toFixed(1)}%${resetTime ? ' — resets ' + resetTime : ''}">
        <span class="text-xs text-gray-500">${label}</span>
        <div style="width: 48px; height: 6px; background: #1e1e2e; border-radius: 3px; overflow: hidden;">
          <div style="width: ${Math.min(pct, 100)}%; height: 100%; background: ${color}; border-radius: 3px; transition: width 0.3s;"></div>
        </div>
        <span class="text-xs text-gray-500">${Math.round(pct)}%</span>
      </div>
    `;
  }).join("");
}

// Refresh usage every 60s
setInterval(fetchUsage, 60000);

// ── Init ──
showDirectoryPicker();
