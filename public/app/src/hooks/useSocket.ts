import { useEffect } from "react";
import { getSocket } from "@/lib/socket";
import { useAppStore } from "@/store/appStore";
import { setPreviewTarget } from "@/lib/api";
import { URL_PATTERN } from "@/lib/constants";

export function useSocket() {
  useEffect(() => {
    const socket = getSocket();

    socket.on("connect", () => {
      useAppStore.getState().setConnected(true);
    });

    socket.on("disconnect", () => {
      useAppStore.getState().setConnected(false);
    });

    socket.on("agent:init", ({ agentId, sessionId, model }) => {
      const s = useAppStore.getState();
      s.updateTab(agentId, { sessionId, status: "running", model });
    });

    socket.on("agent:text", ({ agentId, text }) => {
      const s = useAppStore.getState();
      s.appendToLastAssistant(agentId, text);

      // Auto-detect preview URLs and configure proxy
      const match = text.match(URL_PATTERN);
      if (match) {
        const tab = s.tabs.find((t) => t.id === agentId);
        if (tab && !tab.previewUrl) {
          const url = match[0];
          s.updateTab(agentId, { previewUrl: url });
          setPreviewTarget(url);
        }
      }
    });

    socket.on("agent:tool_use", ({ agentId, toolUseId, tool, input }) => {
      const s = useAppStore.getState();
      s.addMessage(agentId, {
        role: "tool",
        content: "",
        toolUseId,
        toolName: tool,
        toolInput: input,
      });
    });

    socket.on("agent:tool_result", ({ agentId, content }) => {
      const s = useAppStore.getState();
      s.updateLastToolMessage(agentId, { toolResult: content });

      // Auto-detect preview URLs in tool results and configure proxy
      const match = content.match(URL_PATTERN);
      if (match) {
        const tab = s.tabs.find((t) => t.id === agentId);
        if (tab && !tab.previewUrl) {
          const url = match[0];
          s.updateTab(agentId, { previewUrl: url });
          setPreviewTarget(url);
        }
      }
    });

    socket.on("agent:tool_progress", ({ agentId, elapsed }) => {
      const s = useAppStore.getState();
      s.updateLastToolMessage(agentId, { elapsed });
    });

    socket.on("agent:result", ({ agentId, subtype, cost, turns, duration, sessionId, errors }) => {
      const s = useAppStore.getState();
      s.updateTab(agentId, {
        status: subtype === "success" ? "idle" : "error",
        sessionId,
        lastCost: cost,
        lastDuration: duration,
        lastTurns: turns,
      });
      if (errors) {
        s.addMessage(agentId, { role: "system", content: `Error: ${errors}` });
      }
    });

    socket.on("agent:error", ({ agentId, error }) => {
      const s = useAppStore.getState();
      s.updateTab(agentId, { status: "error" });
      s.addMessage(agentId, { role: "system", content: error });
    });

    socket.on("preview:navigate", ({ agentId, route }) => {
      const s = useAppStore.getState();
      s.updateTab(agentId, { previewRoute: route });
    });

    // Agent set a new preview URL
    socket.on("preview:set-url" as any, ({ agentId, url }: { agentId: string; url: string }) => {
      const s = useAppStore.getState();
      s.updateTab(agentId, { previewUrl: url, previewRoute: "/" });
      setPreviewTarget(url);
    });

    socket.on("preview:refresh", () => {
      // Handled by PreviewPanel component via store reactivity
    });

    // Server asks for current iframe URL (for agent GetPreviewURL tool)
    socket.on("preview:get-url", ({ agentId }) => {
      try {
        const iframe = document.getElementById(`preview-frame-${agentId}`) as HTMLIFrameElement;
        const url = iframe?.contentWindow?.location.pathname || "/";
        socket.emit("preview:current-url", { url });
      } catch {
        socket.emit("preview:current-url", { url: "/" });
      }
    });

    return () => {
      socket.removeAllListeners();
    };
  }, []);
}
