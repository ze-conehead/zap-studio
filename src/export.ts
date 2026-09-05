import { t } from "./i18n";
import type Konva from "konva";
import {
  BLEED_PX,
  CANVAS,
  DPI,
  MARKS_MARGIN_PX,
  PX_PER_MM,
  TRIM_RECT,
} from "./card";
import { ensureFontsLoaded } from "./fonts";

export type ExportMode = "trim" | "bleed" | "marks";

export const EXPORT_MODES: ExportMode[] = ["trim", "bleed", "marks"];

export function exportLabel(mode: ExportMode): string {
  return t(
    {
      trim: "PNG – final size (54 × 85.6 mm)",
      bleed: "PNG – with 3 mm bleed",
      marks: "PNG – bleed + crop marks",
    }[mode],
  );
}

interface ExportOpts {
  stage: Konva.Stage;
  stageWidth: number; // on-screen width the stage is currently drawn at
  mode: ExportMode;
}

// Renders the Konva stage at full 300 DPI and returns a PNG data URL.
export async function exportPng({ stage, stageWidth, mode }: ExportOpts): Promise<string> {
  await ensureFontsLoaded();

  // Guides (bleed/safe outlines + user guide lines) never belong in the file.
  const guideLayers = stage.find(".guides");
  const wasVisible = guideLayers.map((l) => l.visible());
  guideLayers.forEach((l) => l.visible(false));
  stage.draw();

  const pixelRatio = CANVAS.w / stageWidth;
  const full = stage.toCanvas({ pixelRatio }) as HTMLCanvasElement;
  // full is CANVAS.w x CANVAS.h (trim + bleed on every side)

  guideLayers.forEach((l, i) => l.visible(wasVisible[i]));
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
