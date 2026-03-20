import { useAppStore } from "@/store/appStore";
import { useSocket } from "@/hooks/useSocket";
import { useAutoSave } from "@/hooks/useAutoSave";
import DirectoryPicker from "@/components/DirectoryPicker";
import MainUI from "@/components/MainUI";

export default function App() {
  const ready = useAppStore((s) => s.ready);

  useSocket();
  useAutoSave();

  return ready ? <MainUI /> : <DirectoryPicker />;
}
