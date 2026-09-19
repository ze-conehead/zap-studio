// The file-level actions (export a PNG, save/open a project, backups) shared
// by the menu bar and the toolbar, so both drive exactly the same code.

import { useRef, useState } from "react";
import { exportBackup, importBackup } from "../backup";
import { downloadBlob, downloadDataUrl, exportPng, type ExportMode } from "../export";
import { getFormat } from "../formats";
import { useT } from "../i18n";
import { cardTrayPdf, type CardPdfPage } from "../pdf";
import { askConfirm } from "./ConfirmDialog";
import { serializeProject } from "../projectFile";
import { useStore } from "../store";
import type { CanvasHandle } from "./EditorCanvas";

export interface FileActions {
  busy: string | null;
  runExport: (mode: ExportMode) => Promise<void>;
  runCoverPdf: () => Promise<void>;
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

  // A double-sided print file for formats with both panels (a folded wrap)
  // and a back face (the wrap's inside) — one page per side, at trim+bleed
  // size, centered on an A4 sheet (whichever orientation fits) so a home
  // or shop duplex printer lands the cover in exactly the same spot on
  // both sides.
  const A4_MM = { w: 210, h: 297 };

  const runCoverPdf = async () => {
    const front = canvas.current?.getStage("front");
    const back = canvas.current?.getStage("back");
    const w = canvas.current?.getStageWidth() ?? 0;
    if (!front || !back || !w) return;
    try {
      setBusy(t("Generating PDF …"));
      const f = getFormat();
      const cardWidthMM = f.trimMM.w + f.bleedMM * 2;
      const cardHeightMM = f.trimMM.h + f.bleedMM * 2;
      const fitsPortrait = cardWidthMM <= A4_MM.w && cardHeightMM <= A4_MM.h;
      const fitsLandscape = cardWidthMM <= A4_MM.h && cardHeightMM <= A4_MM.w;
      if (!fitsPortrait && !fitsLandscape) {
        throw new Error(
          t("The cover ({w} × {h} mm) doesn't fit on an A4 sheet.", {
            w: Math.round(cardWidthMM),
            h: Math.round(cardHeightMM),
          }),
        );
      }
      const pageWidthMM = fitsPortrait ? A4_MM.w : A4_MM.h;
      const pageHeightMM = fitsPortrait ? A4_MM.h : A4_MM.w;
      const offsetXMM = (pageWidthMM - cardWidthMM) / 2;
      const offsetYMM = (pageHeightMM - cardHeightMM) / 2;
      const page = async (stage: typeof front): Promise<CardPdfPage> => ({
        imageDataUrl: await exportPng({ stage, stageWidth: w, mode: "bleed" }),
        cardWidthMM,
        cardHeightMM,
        pageWidthMM,
        pageHeightMM,
        offsetXMM,
        offsetYMM,
      });
      const blob = await cardTrayPdf([await page(front), await page(back)]);
      downloadBlob(blob, `${safeName()}_cover.pdf`);
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
    const ok = await askConfirm({
      title: t("Load backup?"),
      body: t(
        "Projects and templates from the file are imported (existing ones with the same ID are overwritten). The page then reloads.",
      ),
      confirmLabel: t("Load backup"),
    });
    if (!ok) return;
    try {
      setBusy(t("Loading backup …"));
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
    runCoverPdf,
    saveJson,
    saveBackup,
    loadBackup,
    jsonRef,
    zipRef,
    openJson: () => jsonRef.current?.click(),
    openZip: () => zipRef.current?.click(),
  };
}
