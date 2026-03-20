import { useCallback, useRef } from "react";

interface ResizerProps {
  panelRef: React.RefObject<HTMLDivElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export default function Resizer({ panelRef, containerRef }: ResizerProps) {
  const dragging = useRef(false);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const onMouseMove = (ev: MouseEvent) => {
        if (!dragging.current || !panelRef.current || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const newWidth = ev.clientX - rect.left;
        const maxWidth = rect.width - 300;
        panelRef.current.style.width = `${Math.max(300, Math.min(newWidth, maxWidth))}px`;
      };

      const onMouseUp = () => {
        dragging.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [panelRef, containerRef]
  );

  return (
    <div
      className="w-1 cursor-col-resize bg-border hover:bg-accent active:bg-accent shrink-0 transition-colors"
      onMouseDown={onMouseDown}
    />
  );
}
