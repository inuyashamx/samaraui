import { useEffect, useRef } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "@xterm/addon-fit";
import { getSocket } from "@/lib/socket";
import "xterm/css/xterm.css";

export default function TerminalPanel({ onClose }: { onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current || startedRef.current) return;
    startedRef.current = true;

    const term = new Terminal({
      fontSize: 13,
      fontFamily: "Consolas, 'Courier New', monospace",
      theme: {
        background: "#0f0f0f",
        foreground: "#e0e0e0",
        cursor: "#d97706",
        selectionBackground: "#d9770640",
      },
      cursorBlink: true,
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    fit.fit();

    termRef.current = term;
    fitRef.current = fit;

    const socket = getSocket();

    // Start terminal process on server
    socket.emit("terminal:start");

    // Receive output from server
    const onData = (data: string) => {
      term.write(data);
    };
    socket.on("terminal:data", onData as any);

    const onExit = () => {
      term.writeln("\r\n\x1b[90m[Terminal exited]\x1b[0m");
    };
    socket.on("terminal:exit", onExit as any);

    // Send input to server
    const disposeInput = term.onData((data) => {
      socket.emit("terminal:input", data);
    });

    // Handle resize
    const observer = new ResizeObserver(() => {
      fit.fit();
      socket.emit("terminal:resize", { cols: term.cols, rows: term.rows });
    });
    observer.observe(containerRef.current);

    return () => {
      disposeInput.dispose();
      socket.off("terminal:data", onData as any);
      socket.off("terminal:exit", onExit as any);
      observer.disconnect();
      term.dispose();
      startedRef.current = false;
    };
  }, []);

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface-1 shrink-0">
        <span className="text-xs font-medium text-gray-300">Terminal</span>
        <button className="text-gray-500 hover:text-white text-sm px-1" onClick={onClose}>✕</button>
      </div>
      <div ref={containerRef} className="flex-1 p-1 overflow-hidden" />
    </div>
  );
}
