// The file-level actions (export a PNG, save/open a project, backups) shared
// by the menu bar and the toolbar, so both drive exactly the same code.

import { useRef, useState } from "react";
import { exportBackup, importBackup } from "../backup";
import { downloadBlob, downloadDataUrl, exportPng, type ExportMode } from "../export";
import { getFormat } from "../formats";
import { useT } from "../i18n";
import { cardTrayPdf, type CardPdfPage } from "../pdf";
import { serializeProject } from "../projectFile";
import { useStore } from "../store";
import type { CanvasHandle } from "./EditorCanvas";

export interface FileActions {
  busy: string | null;
  runExport: (mode: ExportMode) => Promise<void>;
  runCardTrayExport: () => Promise<void>;
  saveJson: () => void;
  saveBackup: () => Promise<void>;
  loadBackup: (file: File) => Promise<void>;
  /** Hidden <input type="file"> refs — render them once via `pickers`. */
  jsonRef: React.RefObject<HTMLInputElement | null>;
  zipRef: React.RefObject<HTMLInputElement | null>;
  openJson: () => void;
  openZip: () => void;
}

export function useFileActions(
  canvas: React.MutableRefObject<CanvasHandle | null>,
): FileActions {
  const { state } = useStore();
  const t = useT();
  const { project, side } = state;
  const [busy, setBusy] = useState<string | null>(null);
  const jsonRef = useRef<HTMLInputElement>(null);
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

  // A print-ready PDF for a printer's own card tray (e.g. Canon's): one page
  // per face, sized exactly to the card — no bleed, no marks. Both faces if
  // there's a back, so the user just flips the card between pages.
  const runCardTrayExport = async () => {
    const w = canvas.current?.getStageWidth() ?? 0;
    const front = canvas.current?.getStage("front");
    if (!front || !w) return;
    try {
      setBusy(t("Generating PDF …"));
      const { trimMM } = getFormat();
      const pages: CardPdfPage[] = [
        {
          imageDataUrl: await exportPng({ stage: front, stageWidth: w, mode: "trim" }),
          widthMM: trimMM.w,
          heightMM: trimMM.h,
        },
      ];
      const back = project.back ? canvas.current?.getStage("back") : undefined;
      if (back) {
        pages.push({
          imageDataUrl: await exportPng({ stage: back, stageWidth: w, mode: "trim" }),
          widthMM: trimMM.w,
          heightMM: trimMM.h,
        });
      }
      const blob = await cardTrayPdf(pages);
      downloadBlob(blob, `${safeName()}_card-tray.pdf`);
      alert(
        t(
          "In the print dialog, pick the card-sized paper/media your printer's tray uses and print at Actual size / 100 % — never “Fit to page”, which would rescale it. Two pages means front + back: print one, flip the card, print the other.",
        ),
      );
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const saveJson = () => {
    const blob = new Blob([serializeProject(project)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    downloadDataUrl(url, `${safeName()}.json`);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const saveBackup = async () => {
    try {
      setBusy(t("Packing backup …"));
      const { blob, name } = await exportBackup();
      downloadBlob(blob, name);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const loadBackup = async (file: File) => {
    if (
      !confirm(
        t(
          "Load backup? Projects and templates from the file are imported (existing ones with the same ID are overwritten). The page then reloads.",
        ),
      )
    ) {
      return;
    }
    try {
      setBusy(t("Loading backup …"));
      const { projects, templates } = await importBackup(file);
      alert(
        t("{projects} project(s) and {templates} template(s) imported.", {
          projects,
          templates,
        }),
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
    runCardTrayExport,
    saveJson,
    saveBackup,
    loadBackup,
    jsonRef,
    zipRef,
    openJson: () => jsonRef.current?.click(),
    openZip: () => zipRef.current?.click(),
  };
}
