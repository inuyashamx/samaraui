import { useEffect, useRef } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export default function Modal({ open, onClose, title, children }: ModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
    >
      <div className="bg-surface-2 border border-border rounded-lg shadow-2xl min-w-[320px] max-w-[500px]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-medium text-white">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white text-lg leading-none px-1"
          >
            &times;
          </button>
        </div>
        <div className="px-4 py-4 text-sm text-gray-300">{children}</div>
      </div>
    </div>
  );
}
