import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TooltipProvider } from "@/components/ui/tooltip";
import App from "./App.tsx";
import "./index.css";
// Applies the stored theme's CSS variables on import, before the first paint.
import "./theme";
import { startAutoBackup } from "./autobackup";
import { MemoryModeBanner, StorageErrorScreen } from "./components/StorageErrorScreen";
import { memoryMode, probeStorage } from "./idb";
import { purgeOldTrash } from "./persist";
import { t } from "./i18n";
import { setDefaultWorkspaceName } from "./workspace";

setDefaultWorkspaceName(t("Main project"));

const root = createRoot(document.getElementById("root")!);

// Everything the app stores goes through IndexedDB — if the browser can't
// use it, say so instead of hanging on "loading …".
probeStorage().then(
  () => {
    startAutoBackup();
    purgeOldTrash().catch(() => {});
    root.render(
      <StrictMode>
        <TooltipProvider delayDuration={300}>
          <App />
          {memoryMode() && <MemoryModeBanner />}
        </TooltipProvider>
      </StrictMode>,
    );
  },
  (error) => {
    console.error("IndexedDB unavailable", error);
    root.render(
      <StrictMode>
        <TooltipProvider delayDuration={300}>
          <StorageErrorScreen error={error} />
        </TooltipProvider>
      </StrictMode>,
    );
  },
);
