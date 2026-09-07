import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TooltipProvider } from "@/components/ui/tooltip";
import App from "./App.tsx";
import "./index.css";
// Applies the stored theme's CSS variables on import, before the first paint.
import "./theme";
import { startAutoBackup } from "./autobackup";
import { purgeOldTrash } from "./persist";

startAutoBackup();
void purgeOldTrash();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TooltipProvider delayDuration={300}>
      <App />
    </TooltipProvider>
  </StrictMode>,
);
