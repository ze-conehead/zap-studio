// "Cut sheet": several finished card designs packed onto one transparent
// PNG at physical 300 DPI size, laid out so a Cricut Explore can Print then
// Cut each rounded card. Paginated to the machine's printable area.

import {
  BLEED_PX,
  CANVAS,
  CORNER_RADIUS_PX,
  PX_PER_MM,
  TRIM_RECT,
} from "./card";
import { gameKeyOf, getCatalog } from "./data/catalog";
import { GLOBAL_TEMPLATE_ID, isBackground, templateId } from "./factory";
import { getGameProject } from "./gameIndex";
import { loadAllProjects, loadProject } from "./persist";
import type { DemoCard } from "./demo";
import type { Project } from "./types";

// Cricut Explore "Print then Cut" printable area.
export const PRINT_W_MM = 171.45; // 6.75"
export const PRINT_H_MM = 234.95; // 9.25"

export interface SheetGame {
  gameKey: string;
  consoleName: string;
  gameTitle: string;
}

// Every catalogue game that has a saved sticker design.
export async function listGameDesigns(): Promise<SheetGame[]> {
  const projects = await loadAllProjects();
  const ids = new Set(projects.map((p) => p.id));
  const out: SheetGame[] = [];
  for (const c of getCatalog()) {
    for (const g of c.games) {
      const key = gameKeyOf(c, g);
      const pid = getGameProject(key);
      if (pid && ids.has(pid)) {
        out.push({ gameKey: key, consoleName: c.name, gameTitle: g.title });
      }
    }
  }
  return out;
}

// Load the finished design + its console/global template context for each
// selected game, shaped like a demo card so <CardStage> can render it.
export async function loadSheetCards(gameKeys: string[]): Promise<DemoCard[]> {
  const bgFill = (p?: Project) => {
    const bg = p?.layers.find(isBackground);
    return bg?.visible ? bg.fill : undefined;
  };
  const overlayable = (p?: Project) =>
    (p?.layers ?? []).filter((l) => !l.mainMask && !isBackground(l));

  const globalP = await loadProject(GLOBAL_TEMPLATE_ID);
  const globalBg = bgFill(globalP);
  const mainMask = globalP?.layers.find((l) => l.mainMask && l.visible);
  const globalLayers = overlayable(globalP);

  const meta = new Map<
    string,
    { consoleId: string; consoleName: string; gameTitle: string }
  >();
  for (const c of getCatalog()) {
    for (const g of c.games) {
      meta.set(gameKeyOf(c, g), {
        consoleId: c.id,
        consoleName: c.name,
        gameTitle: g.title,
      });
    }
  }

  const tplCache = new Map<string, Project | undefined>();
  const out: DemoCard[] = [];
  for (const gameKey of gameKeys) {
    const m = meta.get(gameKey);
    const pid = getGameProject(gameKey);
    if (!m || !pid) continue;
    const project = await loadProject(pid);
    if (!project) continue;
    if (!tplCache.has(m.consoleId)) {
      tplCache.set(m.consoleId, await loadProject(templateId(m.consoleId)));
    }
    const consoleP = tplCache.get(m.consoleId);
    out.push({
      key: gameKey,
      consoleName: m.consoleName,
      gameTitle: m.gameTitle,
      project,
      overlay: [...overlayable(consoleP), ...globalLayers],
      consoleBg: bgFill(consoleP),
      globalBg,
      mainMask,
      holo: false,
    });
  }
  return out;
}

export interface SheetOptions {
  gapMM: number; // blank space between cards (blade clearance)
  bleedMM: number; // colour kept past the rounded cut line
  background: "transparent" | "white";
}

export const DEFAULT_SHEET_OPTIONS: SheetOptions = {
  gapMM: 3,
  bleedMM: 1,
  background: "transparent",
};

export interface SheetPage {
  dataUrl: string;
  count: number; // cards on this page
  widthMM: number;
  heightMM: number;
}

export interface SheetResult {
  pages: SheetPage[];
  cols: number;
  rows: number;
  perPage: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("image failed to load"));
    img.src = src;
  });
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

// `cardImages` are full-canvas (trim + bleed) PNGs, one per card, in order.
export async function composeSheet(
  cardImages: string[],
  opts: SheetOptions,
): Promise<SheetResult> {
  if (!cardImages.length) throw new Error("no cards");

  const bleed = Math.max(0, opts.bleedMM) * PX_PER_MM;
  const gap = Math.max(0, opts.gapMM) * PX_PER_MM;
  // The cut shape: the trim rectangle grown by the kept bleed.
  const cellW = TRIM_RECT.w + bleed * 2;
  const cellH = TRIM_RECT.h + bleed * 2;
  const radius = CORNER_RADIUS_PX + bleed;

  const printW = PRINT_W_MM * PX_PER_MM;
  const printH = PRINT_H_MM * PX_PER_MM;
  const cols = Math.max(0, Math.floor((printW + gap) / (cellW + gap)));
  const rows = Math.max(0, Math.floor((printH + gap) / (cellH + gap)));
  if (cols < 1 || rows < 1) {
    throw new Error("card-too-big");
  }
  const perPage = cols * rows;
  const pageCount = Math.ceil(cardImages.length / perPage);

  const imgs = await Promise.all(cardImages.map(loadImage));
  const pages: SheetPage[] = [];

  for (let p = 0; p < pageCount; p++) {
    const slice = imgs.slice(p * perPage, p * perPage + perPage);
    const pcols = Math.min(cols, slice.length);
    const prows = Math.ceil(slice.length / cols);
    const pageW = Math.round(pcols * cellW + (pcols - 1) * gap);
    const pageH = Math.round(prows * cellH + (prows - 1) * gap);

    const canvas = document.createElement("canvas");
    canvas.width = pageW;
    canvas.height = pageH;
    const ctx = canvas.getContext("2d")!;
    if (opts.background === "white") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, pageW, pageH);
    }

    slice.forEach((img, i) => {
      const cx = (i % cols) * (cellW + gap);
      const cy = Math.floor(i / cols) * (cellH + gap);
      ctx.save();
      roundedRect(ctx, cx, cy, cellW, cellH, radius);
      ctx.clip();
      // The source PNG is CANVAS (trim + BLEED_PX). Line its trim box up with
      // the cell, so the cell shows `bleed` px of the design past the trim.
      ctx.drawImage(
        img,
        cx - (BLEED_PX - bleed),
        cy - (BLEED_PX - bleed),
        CANVAS.w,
        CANVAS.h,
      );
      ctx.restore();
    });

    pages.push({
      dataUrl: canvas.toDataURL("image/png"),
      count: slice.length,
      widthMM: pageW / PX_PER_MM,
      heightMM: pageH / PX_PER_MM,
    });
  }

  return { pages, cols, rows, perPage };
}
