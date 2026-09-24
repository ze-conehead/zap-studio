// The file-level actions (export a PNG, save/open a project, backups) shared
// by the menu bar and the toolbar, so both drive exactly the same code.

import { useRef, useState } from "react";
import { importBackup } from "../backup";
import { downloadDataUrl, exportPng, type ExportMode } from "../export";
import { useT } from "../i18n";
import { askConfirm } from "./ConfirmDialog";
import { useStore } from "../store";
import type { CanvasHandle } from "./EditorCanvas";

export interface FileActions {
  busy: string | null;
  runExport: (mode: ExportMode) => Promise<void>;
  loadBackup: (file: File) => Promise<void>;
  /** Hidden <input type="file"> ref — rendered once via `pickers`. */
  zipRef: React.RefObject<HTMLInputElement | null>;
  openZip: () => void;
}

export function useFileActions(
  canvas: React.MutableRefObject<CanvasHandle | null>,
): FileActions {
  const { state } = useStore();
  const t = useT();
  const { project, side } = state;
  const [busy, setBusy] = useState<string | null>(null);
  const zipRef = useRef<HTMLInputElement>(null);

  const safeName = () =>
    project.name.replace(/[^\w-]+/g, "_").slice(0, 40) || "sticker";

  const runExport = async (mode: ExportMode) => {
    const stage = canvas.current?.getStage();
    const w = canvas.current?.getStageWidth() ?? 0;
    if (!stage || !w) return;
    try {
      setBusy(t("Generating PNG …"));
      const url = await exportPng({ stage, stageWidth: w, mode });
      const face = project.back ? (side === "back" ? "_back" : "_front") : "";
      downloadDataUrl(url, `${safeName()}${face}_${mode}.png`);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const loadBackup = async (file: File) => {
    const ok = await askConfirm({
      title: t("Import project?"),
      body: t(
        "Projects and templates from the file are imported (existing ones with the same ID are overwritten). The page then reloads.",
      ),
      confirmLabel: t("Import project"),
    });
    if (!ok) return;
    try {
      setBusy(t("Importing project …"));
      const { projects, templates, includesApiKeys } = await importBackup(file);
      alert(
        t("{projects} project(s) and {templates} template(s) imported.", {
          projects,
          templates,
        }) +
          (includesApiKeys
            ? " " + t("API keys from the backup were restored too.")
            : ""),
      );
      location.reload();
    } catch (e) {
      alert((e as Error).message);
      setBusy(null);
    }
  };

  return {
    busy,
    runExport,
    loadBackup,
    zipRef,
    openZip: () => zipRef.current?.click(),
  };
}
