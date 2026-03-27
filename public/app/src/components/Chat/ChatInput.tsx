import { useState, useRef, useEffect, useCallback } from "react";
import { useAppStore } from "@/store/appStore";
import { getSocket } from "@/lib/socket";
import type { ImageAttachment } from "@shared/types/agent";

export default function ChatInput({ tabId }: { tabId: string }) {
  const [value, setValue] = useState("");
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const [isListening, setIsListening] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const tab = useAppStore((s) => s.tabs.find((t) => t.id === tabId));
  const addMessage = useAppStore((s) => s.addMessage);
  const updateTab = useAppStore((s) => s.updateTab);

  const isRunning = tab?.status === "running";

  // Focus input when tab becomes active
  const activeTabId = useAppStore((s) => s.activeTabId);
  useEffect(() => {
    if (activeTabId === tabId && inputRef.current) {
      inputRef.current.focus();
    }
  }, [activeTabId, tabId]);

  const addImageFiles = useCallback((files: FileList | File[]) => {
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        setImages((prev) => [...prev, { data: base64, mimeType: file.type }]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const send = () => {
    const text = value.trim();
    if ((!text && images.length === 0) || !tab) return;

    addMessage(tabId, {
      role: "user",
      content: text || "(images attached)",
      ...(images.length > 0 ? { images } : {}),
    });
    updateTab(tabId, { status: "running" });

    const socket = getSocket();
    const payload = {
      agentId: tabId,
      prompt: text || "See the attached images.",
      model: tab.model || undefined,
      images: images.length > 0 ? images : undefined,
    };

    if (tab.sessionId) {
      socket.emit("agent:message", { ...payload, sessionId: tab.sessionId });
    } else {
      socket.emit("agent:start", payload);
    }

    setValue("");
    setImages([]);
  };

  const interrupt = () => {
    getSocket().emit("agent:interrupt", { agentId: tabId });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (isRunning) return;
      send();
    }
  };

  // Paste images from clipboard
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length > 0) {
      addImageFiles(imageFiles);
    }
  }, [addImageFiles]);

  // Drag and drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer?.files) {
      addImageFiles(e.dataTransfer.files);
    }
  }, [addImageFiles]);

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleVoice = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "es-MX";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognitionRef.current = recognition;

    let finalTranscript = "";

    recognition.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          finalTranscript += transcript + " ";
        } else {
          interim = transcript;
        }
      }
      setValue((prev) => {
        // Replace any previous interim with current state
        const base = prev.replace(/\u200B.*$/, "").trimEnd();
        const combined = (base ? base + " " : "") + finalTranscript;
        return interim ? combined + "\u200B" + interim : combined.trimEnd();
      });
    };

    recognition.onend = () => {
      setIsListening(false);
      // Clean up zero-width space markers from interim results
      setValue((prev) => prev.replace(/\u200B/g, "").trimEnd());
      recognitionRef.current = null;
    };

    recognition.onerror = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.start();
    setIsListening(true);
  }, [isListening]);

  // Listen for element picker
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as string;
      setValue((prev) => prev ? prev + "\n" + detail : detail);
      inputRef.current?.focus();
    };
    window.addEventListener("preview:element-picked", handler);
    return () => window.removeEventListener("preview:element-picked", handler);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const hasSpeechSupport = typeof window !== "undefined" &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  return (
    <div className="p-3 border-t border-border shrink-0">
      {/* Image previews */}
      {images.length > 0 && (
        <div className="flex gap-2 mb-2 flex-wrap">
          {images.map((img, i) => (
            <div key={i} className="relative group">
              <img
                src={`data:${img.mimeType};base64,${img.data}`}
                alt=""
                className="h-16 w-16 object-cover rounded border border-border"
              />
              <button
                className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 text-white rounded-full text-xs leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => removeImage(i)}
              >
                x
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <div
          className="flex-1 flex flex-col"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <textarea
            ref={inputRef}
            data-chat-input
            className="flex-1 bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-white resize-none outline-none focus:border-accent placeholder-gray-600"
            placeholder={isRunning ? "Agent is working..." : "Ask the agent... (paste or drop images)"}
            rows={3}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            disabled={isRunning}
          />
        </div>
        <div className="flex flex-col gap-1 self-end">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) addImageFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            className="px-2 py-2 text-gray-500 hover:text-white text-sm rounded-lg border border-border hover:border-gray-500 transition-colors"
            onClick={() => fileRef.current?.click()}
            disabled={isRunning}
            title="Attach images"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="2" width="12" height="12" rx="2" />
              <circle cx="5.5" cy="5.5" r="1" fill="currentColor" stroke="none" />
              <path d="M2 11l3-3 2 2 3-3 4 4" />
            </svg>
          </button>
          {hasSpeechSupport && (
            <button
              className={`px-2 py-2 text-sm rounded-lg border transition-colors ${
                isListening
                  ? "text-red-400 border-red-500 bg-red-900/20 animate-pulse"
                  : "text-gray-500 hover:text-white border-border hover:border-gray-500"
              }`}
              onClick={toggleVoice}
              disabled={isRunning}
              title={isListening ? "Stop recording" : "Voice input"}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="5.5" y="1.5" width="5" height="9" rx="2.5" />
                <path d="M3 7.5a5 5 0 0010 0" />
                <line x1="8" y1="12.5" x2="8" y2="14.5" />
              </svg>
            </button>
          )}
          {isRunning ? (
            <button
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg shrink-0 transition-colors"
              onClick={interrupt}
            >
              Stop
            </button>
          ) : (
            <button
              className="px-4 py-2 bg-accent hover:bg-accent-light text-black text-sm font-medium rounded-lg shrink-0 transition-colors"
              onClick={send}
            >
              Send
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
