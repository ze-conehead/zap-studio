import { t } from "./i18n";
import type Konva from "konva";
import {
  BLEED_PX,
  CANVAS,
  DPI,
  FOLD_X,
  MARKS_MARGIN_PX,
  PX_PER_MM,
  TRIM_RECT,
} from "./card";
import { ensureFontsLoaded } from "./fonts";
import { getFormat } from "./formats";

export type ExportMode = "trim" | "bleed" | "marks";

export const EXPORT_MODES: ExportMode[] = ["trim", "bleed", "marks"];

export function exportLabel(mode: ExportMode): string {
  const f = getFormat();
  if (mode === "trim") {
    return t("PNG – final size ({w} × {h} mm)", { w: f.trimMM.w, h: f.trimMM.h });
  }
  if (mode === "bleed") {
    return t("PNG – with {n} mm bleed", { n: f.bleedMM });
  }
  return t("PNG – bleed + crop marks");
}

// Konva node name for a condition case shown only as an editing preview.
export const COND_PREVIEW = "cond-preview";

interface ExportOpts {
  stage: Konva.Stage;
  stageWidth: number; // on-screen width the stage is currently drawn at
  mode: ExportMode;
}

// Renders the Konva stage at full 300 DPI and returns a PNG data URL.
export async function exportPng({ stage, stageWidth, mode }: ExportOpts): Promise<string> {
  await ensureFontsLoaded();

  // Guides (bleed/safe outlines + user guide lines) and the selection
  // transformer never belong in the file.
  const guideLayers = stage.find(".guides");
  const wasVisible = guideLayers.map((l) => l.visible());
  guideLayers.forEach((l) => l.visible(false));
  const transformers = stage.find("Transformer");
  const trWasVisible = transformers.map((n) => n.visible());
  transformers.forEach((n) => n.visible(false));
  // A condition case the metadata doesn't select is drawn in the editor
  // while it is selected, so it can be worked on — but it never prints.
  const previews = stage.find(`.${COND_PREVIEW}`);
  const pvWasVisible = previews.map((n) => n.visible());
  previews.forEach((n) => n.visible(false));
  stage.draw();

  const pixelRatio = CANVAS.w / stageWidth;
  const full = stage.toCanvas({ pixelRatio }) as HTMLCanvasElement;
  // full is CANVAS.w x CANVAS.h (trim + bleed on every side)

  guideLayers.forEach((l, i) => l.visible(wasVisible[i]));
  transformers.forEach((n, i) => n.visible(trWasVisible[i]));
  previews.forEach((n, i) => n.visible(pvWasVisible[i]));
  stage.draw();

  if (mode === "bleed") return full.toDataURL("image/png");

  if (mode === "trim") {
    const out = document.createElement("canvas");
    out.width = TRIM_RECT.w;
    out.height = TRIM_RECT.h;
    out
      .getContext("2d")!
      .drawImage(
        full,
        BLEED_PX,
        BLEED_PX,
        TRIM_RECT.w,
        TRIM_RECT.h,
        0,
        0,
        TRIM_RECT.w,
        TRIM_RECT.h,
      );
    return out.toDataURL("image/png");
  }

  // mode === "marks"
  const M = MARKS_MARGIN_PX;
  const out = document.createElement("canvas");
  out.width = CANVAS.w + M * 2;
  out.height = CANVAS.h + M * 2;
  const ctx = out.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(full, M, M);

  const gap = PX_PER_MM * 1.5;
  const len = PX_PER_MM * 3.5;
  const left = M + TRIM_RECT.x;
  const right = left + TRIM_RECT.w;
  const top = M + TRIM_RECT.y;
  const bottom = top + TRIM_RECT.h;

  ctx.strokeStyle = "#000000";
  ctx.lineWidth = Math.max(1, PX_PER_MM * 0.12);
  ctx.beginPath();
  const hMark = (x: number, y: number, dir: number) => {
    ctx.moveTo(x + dir * gap, y);
    ctx.lineTo(x + dir * (gap + len), y);
  };
  const vMark = (x: number, y: number, dir: number) => {
    ctx.moveTo(x, y + dir * gap);
    ctx.lineTo(x, y + dir * (gap + len));
  };
  // four corners
  hMark(left, top, -1); vMark(left, top, -1);
  hMark(right, top, 1); vMark(right, top, -1);
  hMark(left, bottom, -1); vMark(left, bottom, 1);
  hMark(right, bottom, 1); vMark(right, bottom, 1);
  ctx.stroke();

  // Fold ticks at every panel boundary (multi-panel formats).
  if (FOLD_X.length) {
    ctx.save();
    ctx.strokeStyle = "#000000";
    ctx.setLineDash([PX_PER_MM * 1.2, PX_PER_MM * 1.2]);
    ctx.beginPath();
    for (const fx of FOLD_X) {
      const x = M + fx;
      vMark(x, top, -1);
      vMark(x, bottom, 1);
    }
    ctx.stroke();
    ctx.restore();
  }

  return out.toDataURL("image/png");
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  downloadDataUrl(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const EXPORT_DPI = DPI;
